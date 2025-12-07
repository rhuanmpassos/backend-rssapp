import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, Page } from 'playwright';

export interface ScrapedPage {
  title: string;
  description?: string;
  excerpt?: string;
  thumbnailUrl?: string;
  author?: string;
  publishedAt?: Date;
  canonicalUrl?: string;
  html: string;
  confidence: number; // 0-5 confidence score
}

@Injectable()
export class PlaywrightService implements OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightService.name);
  private browser: Browser | null = null;
  private readonly timeout: number;
  private readonly userAgent: string;

  // Expanded article selectors for better discovery
  private readonly ARTICLE_SELECTORS = [
    // Schema.org structured data
    '[itemtype*="schema.org/Article"]',
    '[itemtype*="schema.org/NewsArticle"]',
    '[itemtype*="schema.org/BlogPosting"]',
    // Standard semantic elements
    'article',
    'main article',
    '[role="article"]',
    // Common class patterns
    '[class*="article"]',
    '[class*="post"]',
    '[class*="story"]',
    '[class*="news-item"]',
    '[class*="entry"]',
    '[class*="content-item"]',
    '[class*="feed-item"]',
    '[class*="card-news"]',
    '[class*="noticia"]',
    '[class*="materia"]',
    // Data attributes
    '[data-testid*="article"]',
    '[data-component*="article"]',
    '[data-type="article"]',
  ];

  constructor(private configService: ConfigService) {
    this.timeout = this.configService.get<number>('PLAYWRIGHT_TIMEOUT', 30000);
    this.userAgent = this.configService.get<string>(
      'USER_AGENT',
      'Mozilla/5.0 (compatible; RSSApp/1.0; +https://github.com/rssapp)',
    );
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--no-zygote',
        ],
      });
    }
    return this.browser;
  }

  async scrapePage(url: string): Promise<ScrapedPage | null> {
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: this.userAgent,
        viewport: { width: 1280, height: 720 },
      });

      page = await context.newPage();

      // Block unnecessary resources for faster loading
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      this.logger.debug(`Scraping page: ${url}`);

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout,
      });

      // Wait a bit for JS to render
      await page.waitForTimeout(2000);

      // First, try to extract JSON-LD structured data (most reliable)
      const jsonLdData = await this.extractJsonLd(page);

      // Then extract Open Graph and meta tags
      const metadata = await page.evaluate(() => {
        const getMeta = (name: string): string | null => {
          const el =
            document.querySelector(`meta[property="${name}"]`) ||
            document.querySelector(`meta[name="${name}"]`);
          return el?.getAttribute('content') || null;
        };

        const getLink = (rel: string): string | null => {
          const el = document.querySelector(`link[rel="${rel}"]`);
          return el?.getAttribute('href') || null;
        };

        // Get title - prioritize structured sources
        const title =
          getMeta('og:title') ||
          getMeta('twitter:title') ||
          document.querySelector('h1')?.textContent?.trim() ||
          document.title;

        // Get description (meta description or first paragraph - NO LLM!)
        let description =
          getMeta('og:description') ||
          getMeta('twitter:description') ||
          getMeta('description');

        if (!description) {
          // Try to get first paragraph from article
          const article = document.querySelector('article');
          const firstP = article?.querySelector('p') || document.querySelector('main p');
          description = firstP?.textContent?.trim() || null;
        }

        // Get thumbnails - try multiple sources
        const thumbnailUrl =
          getMeta('og:image') ||
          getMeta('og:image:url') ||
          getMeta('twitter:image') ||
          getMeta('twitter:image:src') ||
          document.querySelector('article img')?.getAttribute('src') ||
          document.querySelector('[class*="article"] img')?.getAttribute('src') ||
          document.querySelector('main img')?.getAttribute('src') ||
          null;

        // Get author - try multiple sources
        const author =
          getMeta('author') ||
          getMeta('article:author') ||
          getMeta('twitter:creator') ||
          document.querySelector('[rel="author"]')?.textContent?.trim() ||
          document.querySelector('[class*="author"]')?.textContent?.trim() ||
          document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
          null;

        // Get published date - try multiple sources
        const publishedStr =
          getMeta('article:published_time') ||
          getMeta('datePublished') ||
          getMeta('date') ||
          document.querySelector('time')?.getAttribute('datetime') ||
          document.querySelector('[itemprop="datePublished"]')?.getAttribute('content') ||
          null;

        // Get canonical URL
        const canonicalUrl = getLink('canonical') || null;

        // Detect page type/schema
        const pageType = getMeta('og:type') || null;

        return {
          title,
          description,
          thumbnailUrl,
          author,
          publishedStr,
          canonicalUrl,
          pageType,
        };
      });

      const html = await page.content();

      await context.close();

      // Merge JSON-LD data with meta data (JSON-LD takes priority if available)
      const finalTitle = jsonLdData?.headline || jsonLdData?.name || metadata.title || 'Untitled';
      const finalDescription = jsonLdData?.description || metadata.description;
      const finalThumbnail = this.extractThumbnailFromJsonLd(jsonLdData) || metadata.thumbnailUrl;
      const finalAuthor = this.extractAuthorFromJsonLd(jsonLdData) || metadata.author;
      const finalPublished = jsonLdData?.datePublished || metadata.publishedStr;

      // Calculate confidence score
      const confidence = this.calculateConfidence({
        title: finalTitle,
        description: finalDescription || undefined,
        thumbnailUrl: finalThumbnail || undefined,
        author: finalAuthor || undefined,
        publishedAt: finalPublished || undefined,
        hasJsonLd: !!jsonLdData,
      });

      if (confidence < 2) {
        this.logger.warn(`Low confidence extraction for ${url}: score ${confidence}/5`);
      }

      return {
        title: finalTitle,
        description: finalDescription || undefined,
        excerpt: this.truncateExcerpt(finalDescription),
        thumbnailUrl: finalThumbnail
          ? this.resolveUrl(finalThumbnail, url)
          : undefined,
        author: finalAuthor || undefined,
        publishedAt: finalPublished
          ? new Date(finalPublished)
          : undefined,
        canonicalUrl: metadata.canonicalUrl
          ? this.resolveUrl(metadata.canonicalUrl, url)
          : undefined,
        html,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Failed to scrape page ${url}: ${error}`);
      return null;
    } finally {
      if (page) {
        await page.close().catch(() => { });
      }
    }
  }

  /**
   * Extract JSON-LD structured data from page
   * This is the most reliable source of article metadata
   */
  private async extractJsonLd(page: Page): Promise<any | null> {
    try {
      const jsonLdItems = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        const items: any[] = [];

        scripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent || '{}');
            // Handle @graph arrays
            if (data['@graph'] && Array.isArray(data['@graph'])) {
              items.push(...data['@graph']);
            } else {
              items.push(data);
            }
          } catch {
            // Skip invalid JSON
          }
        });

        return items;
      });

      // Find article-related schema types
      const articleTypes = ['NewsArticle', 'Article', 'BlogPosting', 'WebPage', 'ReportageNewsArticle'];

      for (const item of jsonLdItems) {
        const itemType = item['@type'];
        if (articleTypes.includes(itemType) || (Array.isArray(itemType) && itemType.some(t => articleTypes.includes(t)))) {
          this.logger.debug(`Found JSON-LD article data: ${itemType}`);
          return item;
        }
      }

      return null;
    } catch (error) {
      this.logger.debug(`Failed to extract JSON-LD: ${error}`);
      return null;
    }
  }

  /**
   * Extract thumbnail URL from JSON-LD image property
   */
  private extractThumbnailFromJsonLd(jsonLd: any): string | null {
    if (!jsonLd) return null;

    const image = jsonLd.image || jsonLd.thumbnailUrl;

    if (!image) return null;

    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return image[0]?.url || image[0] || null;
    if (typeof image === 'object') return image.url || image.contentUrl || null;

    return null;
  }

  /**
   * Extract author from JSON-LD author property
   */
  private extractAuthorFromJsonLd(jsonLd: any): string | null {
    if (!jsonLd) return null;

    const author = jsonLd.author;

    if (!author) return null;

    if (typeof author === 'string') return author;
    if (Array.isArray(author)) return author[0]?.name || null;
    if (typeof author === 'object') return author.name || null;

    return null;
  }

  /**
   * Calculate confidence score (0-5) based on extracted fields
   */
  private calculateConfidence(data: {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    author?: string;
    publishedAt?: string;
    hasJsonLd: boolean;
  }): number {
    let score = 0;

    if (data.title && data.title !== 'Untitled') score++;
    if (data.description && data.description.length > 20) score++;
    if (data.thumbnailUrl) score++;
    if (data.author) score++;
    if (data.publishedAt) score++;

    // Bonus for having JSON-LD (more reliable)
    if (data.hasJsonLd && score > 0) {
      this.logger.debug('JSON-LD data found, high confidence');
    }

    return score;
  }

  async scrapeArticleLinks(url: string): Promise<string[]> {
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();
      const context = await browser.newContext({
        userAgent: this.userAgent,
      });

      page = await context.newPage();

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout,
      });

      await page.waitForTimeout(2000);

      // Extract article links using expanded selectors
      const articleSelectors = this.ARTICLE_SELECTORS;

      const links = await page.evaluate((selectors) => {
        const articleLinks: string[] = [];
        const seen = new Set<string>();

        // Site-specific selectors (for Brazilian news sites like G1)
        const siteSpecificSelectors: Record<string, string[]> = {
          'g1.globo.com': [
            'a[href*="/noticia/"]',
            'a[href*="/mundo/"]',
            'a[href*="/brasil/"]',
            'a[href*="/economia/"]',
            'a[href*="/tecnologia/"]',
            'a[href*="/politica/"]',
            'a[href*="/esporte/"]',
            'a[href*="/ciencia/"]',
            '.bstn-fd-item a',
            '.feed-post-body-title a',
            '.feed-post-body-resumo a',
            '[data-priority] a',
            '[class*="feed-post"] a',
            '[class*="bstn"] a',
          ],
          'oglobo.globo.com': [
            'a[href*="/brasil/"]',
            'a[href*="/politica/"]',
            'a[href*="/economia/"]',
            '[class*="teaser"] a',
          ],
          'folha.uol.com.br': [
            'a[href*="/cotidiano/"]',
            'a[href*="/poder/"]',
            'a[href*="/mercado/"]',
            '[class*="c-headline"] a',
          ],
          'estadao.com.br': [
            'a[href*="/brasil/"]',
            'a[href*="/politica/"]',
            'a[href*="/economia/"]',
            '[class*="card"] a',
          ],
        };

        const hostname = window.location.hostname.toLowerCase();
        const specificSelectors = siteSpecificSelectors[hostname] || [];

        // Combine all selectors - specific first, then generic
        const allSelectors = [
          ...specificSelectors,
          ...selectors.map(s => `${s} a`),
          'main a',
          '.content a',
        ];

        for (const selector of allSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => {
              const href = el.getAttribute('href');
              if (href && !seen.has(href)) {
                // Filter for article-like URLs
                const hrefLower = href.toLowerCase();
                const currentHostname = window.location.hostname.toLowerCase();

                // G1-specific filtering
                if (currentHostname === 'g1.globo.com') {
                  if (
                    hrefLower.includes('/noticia/') ||
                    hrefLower.includes('/mundo/') ||
                    hrefLower.includes('/brasil/') ||
                    hrefLower.includes('/economia/') ||
                    hrefLower.includes('/tecnologia/') ||
                    hrefLower.includes('/politica/') ||
                    hrefLower.includes('/esporte/') ||
                    hrefLower.includes('/ciencia/') ||
                    hrefLower.match(/\/\d{4}\/\d{2}\/\d{2}\//) // Date pattern in G1 URLs
                  ) {
                    seen.add(href);
                    articleLinks.push(href);
                  }
                } else {
                  // Generic filtering for other sites
                  if (
                    hrefLower.includes('/noticia/') ||
                    hrefLower.includes('/news/') ||
                    hrefLower.includes('/article/') ||
                    hrefLower.includes('/articles/') ||
                    hrefLower.includes('/post/') ||
                    hrefLower.includes('/posts/') ||
                    hrefLower.includes('/blog/') ||
                    hrefLower.includes('/story/') ||
                    hrefLower.includes('/materia/') ||
                    hrefLower.match(/\d{4}\/\d{2}\/\d{2}/) || // Date pattern
                    hrefLower.match(/\d{4}\/\d{2}\//) || // Year/month pattern
                    (hrefLower.length > 30 && !hrefLower.includes('#') && !hrefLower.includes('?'))
                  ) {
                    seen.add(href);
                    articleLinks.push(href);
                  }
                }
              }
            });
          } catch {
            // Skip invalid selectors
          }
        }

        return articleLinks;
      }, this.ARTICLE_SELECTORS);

      await context.close();

      // Resolve relative URLs and filter
      const resolvedLinks = links
        .map((link) => {
          try {
            return new URL(link, url).href;
          } catch {
            return null;
          }
        })
        .filter((link): link is string => {
          if (!link) return false;
          // Filter out non-article links
          try {
            const parsed = new URL(link);
            const path = parsed.pathname;
            // Skip common non-article paths
            if (
              path === '/' ||
              path.startsWith('/tag') ||
              path.startsWith('/tags') ||
              path.startsWith('/category') ||
              path.startsWith('/categories') ||
              path.startsWith('/author') ||
              path.startsWith('/page') ||
              path.startsWith('/search') ||
              path.startsWith('/login') ||
              path.startsWith('/register') ||
              path.startsWith('/signin') ||
              path.startsWith('/signup') ||
              path.includes('login') ||
              path.includes('register') ||
              path.includes('subscribe') ||
              path.includes('newsletter')
            ) {
              return false;
            }
            return true;
          } catch {
            return false;
          }
        });

      // Remove duplicates and limit
      const uniqueLinks = [...new Set(resolvedLinks)].slice(0, 30);

      this.logger.log(`Found ${uniqueLinks.length} unique article links from ${url}`);

      return uniqueLinks;
    } catch (error) {
      this.logger.error(`Failed to scrape article links from ${url}: ${error}`);
      return [];
    } finally {
      if (page) {
        await page.close().catch(() => { });
      }
    }
  }

  async checkXRobotsTag(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(5000),
      });

      const xRobotsTag = response.headers.get('x-robots-tag');
      if (xRobotsTag) {
        const directives = xRobotsTag.toLowerCase();
        if (directives.includes('noindex') || directives.includes('none')) {
          return false; // Not allowed
        }
      }

      return true; // Allowed
    } catch {
      return true; // Allow on error
    }
  }

  private truncateExcerpt(text: string | null | undefined): string | undefined {
    if (!text) return undefined;
    // Limit to 500 characters (NO LLM summarization!)
    if (text.length > 500) {
      return text.slice(0, 497) + '...';
    }
    return text;
  }

  private resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }
}




