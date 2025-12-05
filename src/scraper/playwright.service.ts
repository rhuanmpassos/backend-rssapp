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
}

@Injectable()
export class PlaywrightService implements OnModuleDestroy {
  private readonly logger = new Logger(PlaywrightService.name);
  private browser: Browser | null = null;
  private readonly timeout: number;
  private readonly userAgent: string;

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

      // Extract metadata
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

        // Get title
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

        // Get thumbnail
        const thumbnailUrl =
          getMeta('og:image') ||
          getMeta('twitter:image') ||
          document.querySelector('article img')?.getAttribute('src') ||
          null;

        // Get author
        const author =
          getMeta('author') ||
          getMeta('article:author') ||
          document.querySelector('[rel="author"]')?.textContent?.trim() ||
          null;

        // Get published date
        const publishedStr =
          getMeta('article:published_time') ||
          getMeta('datePublished') ||
          document.querySelector('time')?.getAttribute('datetime') ||
          null;

        // Get canonical URL
        const canonicalUrl = getLink('canonical') || null;

        return {
          title,
          description,
          thumbnailUrl,
          author,
          publishedStr,
          canonicalUrl,
        };
      });

      const html = await page.content();

      await context.close();

      return {
        title: metadata.title || 'Untitled',
        description: metadata.description || undefined,
        excerpt: this.truncateExcerpt(metadata.description),
        thumbnailUrl: metadata.thumbnailUrl
          ? this.resolveUrl(metadata.thumbnailUrl, url)
          : undefined,
        author: metadata.author || undefined,
        publishedAt: metadata.publishedStr
          ? new Date(metadata.publishedStr)
          : undefined,
        canonicalUrl: metadata.canonicalUrl
          ? this.resolveUrl(metadata.canonicalUrl, url)
          : undefined,
        html,
      };
    } catch (error) {
      this.logger.error(`Failed to scrape page ${url}: ${error}`);
      return null;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
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

      // Extract article links
      const links = await page.evaluate(() => {
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
            'article a',
            '[role="article"] a',
          ],
        };

        const hostname = window.location.hostname.toLowerCase();
        const specificSelectors = siteSpecificSelectors[hostname] || [];

        // Combine all selectors
        const allSelectors = [
          ...specificSelectors,
          'article a',
          '.post a',
          '.entry a',
          '[class*="article"] a',
          '[class*="post"] a',
          '[class*="news"] a',
          '[class*="noticia"] a',
          'main a',
          '.content a',
          '[role="article"] a',
        ];

        for (const selector of allSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => {
              const href = el.getAttribute('href');
              if (href && !seen.has(href)) {
                // Filter for article-like URLs
                const hrefLower = href.toLowerCase();
                const hostname = window.location.hostname.toLowerCase();
                
                // G1-specific filtering
                if (hostname === 'g1.globo.com') {
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
                    hrefLower.includes('/post/') ||
                    hrefLower.match(/\d{4}\/\d{2}\/\d{2}/) || // Date pattern
                    (hrefLower.length > 20 && !hrefLower.includes('#'))
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
      });

      await context.close();

      // Resolve relative URLs and filter
      return links
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
              path.startsWith('/category') ||
              path.startsWith('/author') ||
              path.startsWith('/page') ||
              path.includes('login') ||
              path.includes('register')
            ) {
              return false;
            }
            return true;
          } catch {
            return false;
          }
        })
        .slice(0, 20); // Limit to 20 articles
    } catch (error) {
      this.logger.error(`Failed to scrape article links from ${url}: ${error}`);
      return [];
    } finally {
      if (page) {
        await page.close().catch(() => {});
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



