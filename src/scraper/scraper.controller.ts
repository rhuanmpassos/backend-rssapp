import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PlaywrightService } from './playwright.service';

interface ExtractContentDto {
  url: string;
  selectors?: {
    title?: string;
    subtitle?: string;
    image?: string;
    publishedAt?: string;
    content?: string;
  };
}

interface ExtractMultipleDto {
  siteUrl: string;
  articleSelector: string;
  selectors: {
    title: string;
    link: string;
    subtitle?: string;
    image?: string;
    publishedAt?: string;
  };
}

@Controller('scraper')
export class ScraperController {
  constructor(private readonly playwrightService: PlaywrightService) {}

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  async extractContent(@Body() dto: ExtractContentDto) {
    const { url, selectors = {} } = dto;

    try {
      // Scrape the page
      const scraped = await this.playwrightService.scrapePage(url);
      
      if (!scraped) {
        throw new Error('Failed to scrape page');
      }

      // If custom selectors are provided, use them
      if (Object.keys(selectors).length > 0) {
        return await this.extractWithSelectors(url, selectors);
      }

      // Otherwise return the default scraped data
      return {
        title: scraped.title,
        subtitle: scraped.description || scraped.excerpt,
        imageUrl: scraped.thumbnailUrl,
        publishedAt: scraped.publishedAt?.toISOString(),
        content: scraped.html,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('extract-multiple')
  @HttpCode(HttpStatus.OK)
  async extractMultiple(@Body() dto: ExtractMultipleDto) {
    const { siteUrl, articleSelector, selectors } = dto;

    try {
      const playwrightService = this.playwrightService as any;
      const browser = await playwrightService.getBrowser();
      const context = await browser.newContext({
        userAgent: playwrightService.userAgent || 'Mozilla/5.0 (compatible; RSSApp/1.0)',
      });
      const page = await context.newPage();

      try {
        await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000); // Wait for JS to render

        const articles = await page.evaluate((config: ExtractMultipleDto) => {
          const results: any[] = [];
          const articleElements = document.querySelectorAll(config.articleSelector);

          articleElements.forEach((articleEl) => {
            try {
              const article: any = {};

              // Extract title
              if (config.selectors.title) {
                const titleEl = articleEl.querySelector(config.selectors.title);
                if (titleEl) {
                  article.title = titleEl.textContent?.trim() || null;
                }
              }

              // Extract link
              if (config.selectors.link) {
                const linkEl = articleEl.querySelector(config.selectors.link);
                if (linkEl) {
                  const href = linkEl.getAttribute('href');
                  if (href) {
                    article.link = href.startsWith('http') 
                      ? href 
                      : new URL(href, window.location.href).href;
                    article.url = article.link;
                  }
                }
              }

              // Extract subtitle
              if (config.selectors.subtitle) {
                const subtitleEl = articleEl.querySelector(config.selectors.subtitle);
                if (subtitleEl) {
                  article.subtitle = subtitleEl.textContent?.trim() || null;
                }
              }

              // Extract image
              if (config.selectors.image) {
                const imageEl = articleEl.querySelector(config.selectors.image);
                if (imageEl) {
                  const src = imageEl.getAttribute('src') || 
                             imageEl.getAttribute('data-src') ||
                             (imageEl as HTMLImageElement).src;
                  if (src) {
                    article.imageUrl = src.startsWith('http') 
                      ? src 
                      : new URL(src, window.location.href).href;
                    article.image = article.imageUrl;
                  }
                }
              }

              // Extract published date
              if (config.selectors.publishedAt) {
                const dateEl = articleEl.querySelector(config.selectors.publishedAt);
                if (dateEl) {
                  const dateStr = dateEl.getAttribute('datetime') || 
                                dateEl.getAttribute('content') ||
                                dateEl.textContent?.trim();
                  if (dateStr) {
                    article.publishedAt = dateStr;
                  }
                }
              }

              // Only add if we have at least title and link
              if (article.title && article.link) {
                results.push(article);
              }
            } catch (e) {
              // Skip invalid articles
              console.error('Error extracting article:', e);
            }
          });

          return results;
        }, dto);

        await context.close();

        return {
          articles,
          count: articles.length
        };
      } catch (error) {
        await context.close();
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }

  private async extractWithSelectors(
    url: string,
    selectors: ExtractContentDto['selectors'],
  ): Promise<any> {
    // First try to scrape with default method
    const scraped = await this.playwrightService.scrapePage(url);
    
    // Use Playwright directly to evaluate custom selectors
    const playwrightService = this.playwrightService as any;
    const browser = await playwrightService.getBrowser();
    const context = await browser.newContext({
      userAgent: playwrightService.userAgent || 'Mozilla/5.0 (compatible; RSSApp/1.0)',
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const extracted = await page.evaluate((sel: ExtractContentDto['selectors']) => {
        const result: any = {};

        if (sel?.title) {
          try {
            const el = document.querySelector(sel.title);
            result.title = el?.textContent?.trim() || null;
          } catch (e) {
            result.title = null;
          }
        }

        if (sel?.subtitle) {
          try {
            const el = document.querySelector(sel.subtitle);
            result.subtitle = el?.textContent?.trim() || null;
          } catch (e) {
            result.subtitle = null;
          }
        }

        if (sel?.image) {
          try {
            const el = document.querySelector(sel.image);
            if (el) {
              result.imageUrl = el.getAttribute('src') || 
                              el.getAttribute('href') || 
                              el.getAttribute('content') || 
                              (el as HTMLImageElement).src || 
                              null;
            }
          } catch (e) {
            result.imageUrl = null;
          }
        }

        if (sel?.publishedAt) {
          try {
            const el = document.querySelector(sel.publishedAt);
            if (el) {
              result.publishedAt = el.getAttribute('datetime') || 
                                  el.getAttribute('content') || 
                                  el.textContent?.trim() || 
                                  null;
            }
          } catch (e) {
            result.publishedAt = null;
          }
        }

        if (sel?.content) {
          try {
            const el = document.querySelector(sel.content);
            result.content = el?.textContent?.trim() || 
                            el?.innerHTML || 
                            null;
          } catch (e) {
            result.content = null;
          }
        }

        return result;
      }, selectors);

      // Merge with scraped data (use extracted if available, otherwise use scraped)
      return {
        title: extracted.title || scraped?.title || 'Untitled',
        subtitle: extracted.subtitle || scraped?.description || scraped?.excerpt,
        imageUrl: extracted.imageUrl || scraped?.thumbnailUrl,
        publishedAt: extracted.publishedAt 
          ? new Date(extracted.publishedAt).toISOString()
          : scraped?.publishedAt?.toISOString(),
        content: extracted.content || scraped?.html,
      };
    } finally {
      await context.close();
    }
  }

}
