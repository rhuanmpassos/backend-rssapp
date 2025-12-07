import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomFeedDto } from './dto/create-custom-feed.dto';
import { UpdateCustomFeedDto } from './dto/update-custom-feed.dto';
import { CreateCustomFeedItemDto } from './dto/create-custom-feed-item.dto';
import { PlaywrightService } from '../../scraper/playwright.service';
import { RssParserService } from '../../scraper/rss-parser.service';

@Injectable()
export class CustomFeedService {
  private readonly logger = new Logger(CustomFeedService.name);

  constructor(
    private prisma: PrismaService,
    private playwrightService: PlaywrightService,
    private rssParserService: RssParserService,
  ) { }

  async create(dto: CreateCustomFeedDto) {
    // Check if slug already exists
    const existing = await this.prisma.customFeed.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('A feed with this slug already exists');
    }

    const feed = await this.prisma.customFeed.create({
      data: {
        title: dto.title,
        description: dto.description,
        slug: dto.slug,
        siteUrl: dto.siteUrl,
        categoryId: dto.categoryId,
      },
      include: {
        category: true,
      },
    });

    this.logger.log(`Custom feed created: ${dto.slug}`);
    return feed;
  }

  async findAll() {
    return this.prisma.customFeed.findMany({
      include: {
        category: true,
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublicFeeds() {
    return this.prisma.customFeed.findMany({
      where: {
        siteUrl: { not: null },
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchPublicFeeds(query?: string) {
    const where: any = {
      siteUrl: { not: null },
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
        { siteUrl: { contains: query, mode: 'insensitive' } },
      ];
    }

    return this.prisma.customFeed.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async findOne(slug: string) {
    const feed = await this.prisma.customFeed.findUnique({
      where: { slug },
      include: {
        items: {
          orderBy: { publishedAt: 'desc' },
        },
        category: true,
        _count: {
          select: { items: true },
        },
      },
    });

    if (!feed) {
      throw new NotFoundException('Custom feed not found');
    }

    return feed;
  }

  async findOneById(id: string) {
    const feed = await this.prisma.customFeed.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { publishedAt: 'desc' },
        },
        category: true,
        _count: {
          select: { items: true },
        },
      },
    });

    if (!feed) {
      throw new NotFoundException('Custom feed not found');
    }

    return feed;
  }

  async update(id: string, dto: UpdateCustomFeedDto) {
    const feed = await this.prisma.customFeed.findUnique({
      where: { id },
    });

    if (!feed) {
      throw new NotFoundException('Custom feed not found');
    }

    // If slug is being updated, check for duplicates
    if (dto.slug && dto.slug !== feed.slug) {
      const existing = await this.prisma.customFeed.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new BadRequestException('A feed with this slug already exists');
      }
    }

    return this.prisma.customFeed.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        slug: dto.slug,
        siteUrl: dto.siteUrl,
        categoryId: dto.categoryId,
      },
      include: {
        category: true,
      },
    });
  }

  async delete(id: string) {
    const feed = await this.prisma.customFeed.findUnique({
      where: { id },
    });

    if (!feed) {
      throw new NotFoundException('Custom feed not found');
    }

    await this.prisma.customFeed.delete({
      where: { id },
    });

    this.logger.log(`Custom feed deleted: ${feed.slug}`);
    return { message: 'Custom feed deleted successfully' };
  }

  async addItem(feedId: string, dto: CreateCustomFeedItemDto) {
    const feed = await this.prisma.customFeed.findUnique({
      where: { id: feedId },
    });

    if (!feed) {
      throw new NotFoundException('Custom feed not found');
    }

    // Extract content from link if content is not provided
    let content = dto.content;
    if (!content && dto.link) {
      try {
        const scraped = await this.playwrightService.scrapePage(dto.link);
        content = scraped?.excerpt || scraped?.description;
      } catch (error) {
        this.logger.warn(`Failed to scrape content from ${dto.link}: ${error}`);
      }
    }

    const item = await this.prisma.customFeedItem.create({
      data: {
        feedId,
        title: dto.title,
        subtitle: dto.subtitle,
        link: dto.link,
        imageUrl: dto.imageUrl,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
        content,
      },
    });

    this.logger.log(`Item added to feed ${feed.slug}: ${dto.title}`);
    return item;
  }

  async updateItem(itemId: string, dto: Partial<CreateCustomFeedItemDto>) {
    const item = await this.prisma.customFeedItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Feed item not found');
    }

    return this.prisma.customFeedItem.update({
      where: { id: itemId },
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        link: dto.link,
        imageUrl: dto.imageUrl,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        content: dto.content,
      },
    });
  }

  async deleteItem(itemId: string) {
    const item = await this.prisma.customFeedItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Feed item not found');
    }

    await this.prisma.customFeedItem.delete({
      where: { id: itemId },
    });

    return { message: 'Feed item deleted successfully' };
  }

  async getRssXml(slug: string): Promise<string> {
    const feed = await this.findOne(slug);

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const feedUrl = `${baseUrl}/api/v1/custom-feeds/${slug}/rss.xml`;

    // Extract site base URL for resolving relative image paths
    let siteBaseUrl = '';
    if (feed.siteUrl) {
      try {
        const url = new URL(feed.siteUrl);
        siteBaseUrl = `${url.protocol}//${url.hostname}`;
      } catch {
        siteBaseUrl = '';
      }
    }
    this.logger.debug(`Site base URL for resolving images: ${siteBaseUrl}`);

    let items: any[] = [];

    // Se o feed tem configuração de scraper, extrair dinamicamente
    if (feed.siteUrl) {
      // Primeiro, tentar descobrir RSS automaticamente
      if (!feed.articleSelector || !feed.selectors) {
        try {
          this.logger.log(`Trying to discover RSS feed for: ${feed.slug}`);
          const rssUrl = await this.discoverRssFeed(feed.siteUrl);
          if (rssUrl) {
            const parsed = await this.rssParserService.parseUrl(rssUrl);
            if (parsed && parsed.items) {
              items = parsed.items.map(item => ({
                title: item.title,
                subtitle: item.excerpt,
                link: item.url,
                imageUrl: item.thumbnailUrl, // Already resolved by rssParserService
                publishedAt: item.publishedAt,
              }));
              this.logger.log(`Using discovered RSS feed with ${items.length} items`);

              // Log sample item for debugging
              if (items.length > 0) {
                this.logger.debug(`Sample RSS item: title="${items[0].title}", imageUrl="${items[0].imageUrl}"`);
              }
            }
          }
        } catch (error) {
          this.logger.warn(`RSS discovery failed: ${error}`);
        }
      }

      // Se não encontrou RSS, tentar extrair usando heurísticas automáticas
      if (items.length === 0) {
        try {
          this.logger.log(`Trying automatic extraction with heuristics for feed: ${feed.slug}`);
          items = await this.extractWithHeuristics(feed.siteUrl);

          // Resolve relative URLs from heuristics extraction
          items = items.map(item => ({
            ...item,
            imageUrl: this.resolveImageUrl(item.imageUrl || item.image, siteBaseUrl),
            image: this.resolveImageUrl(item.image || item.imageUrl, siteBaseUrl),
          }));

          this.logger.log(`Extracted ${items.length} items with heuristics`);
          if (items.length > 0) {
            this.logger.debug(`Sample heuristic item: title="${items[0].title}", imageUrl="${items[0].imageUrl}"`);
          }
        } catch (error) {
          this.logger.error(`Failed to extract articles for feed ${feed.slug}: ${error}`);
          items = feed.items || [];
        }
      }
    } else {
      // Se não tem siteUrl, usar itens do banco
      items = feed.items || [];
    }

    this.logger.log(`Generating RSS XML with ${items.length} items for feed: ${slug}`);

    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title><![CDATA[${feed.title}]]></title>
    <description><![CDATA[${feed.description || ''}]]></description>
    <link>${feedUrl}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <pubDate>${feed.updatedAt.toUTCString()}</pubDate>
    <generator>RSS App Custom Feed Generator</generator>
`;

    for (const item of items) {
      rss += `    <item>
      <title><![CDATA[${item.title || 'Sem título'}]]></title>
      <description><![CDATA[${item.subtitle || item.title || ''}]]></description>
      <link>${item.link || item.url}</link>
      <guid isPermaLink="true">${item.link || item.url}</guid>
      <pubDate>${item.publishedAt ? new Date(item.publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
`;

      if (item.imageUrl || item.image) {
        // Resolve relative URL if needed
        let imageUrl = item.imageUrl || item.image;
        imageUrl = this.resolveImageUrl(imageUrl, siteBaseUrl);

        rss += `      <media:content url="${imageUrl}" type="image/jpeg" />
      <enclosure url="${imageUrl}" type="image/jpeg" />
`;
      }

      if (item.content) {
        rss += `      <content:encoded><![CDATA[${item.content}]]></content:encoded>
`;
      }

      rss += `    </item>
`;
    }

    rss += `  </channel>
</rss>`;

    return rss;
  }

  /**
   * Resolve relative image URLs to absolute URLs
   */
  private resolveImageUrl(imageUrl: string | undefined | null, baseUrl: string): string | undefined {
    if (!imageUrl) return undefined;

    // Already absolute URL
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }

    // Relative URL - resolve against base
    if (baseUrl && imageUrl.startsWith('/')) {
      const resolved = `${baseUrl}${imageUrl}`;
      this.logger.debug(`Resolved relative image: ${imageUrl} -> ${resolved}`);
      return resolved;
    }

    // Protocol-relative URL
    if (imageUrl.startsWith('//')) {
      return `https:${imageUrl}`;
    }

    return imageUrl;
  }

  private async discoverRssFeed(siteUrl: string): Promise<string | null> {
    try {
      // Try to discover RSS feed using the existing service
      const scraped = await this.playwrightService.scrapePage(siteUrl);
      if (scraped && scraped.html) {
        const rssUrl = await this.rssParserService.discoverRssUrl(scraped.html, siteUrl);
        if (rssUrl) {
          return rssUrl;
        }
      }

      // Try common RSS paths
      const baseUrl = new URL(siteUrl);
      const commonPaths = [
        '/feed',
        '/rss',
        '/rss.xml',
        '/feed.xml',
        '/atom.xml',
        '/feeds/posts/default',
        '/blog/feed',
      ];

      for (const path of commonPaths) {
        try {
          const testUrl = `${baseUrl.origin}${path}`;
          const parsed = await this.rssParserService.parseUrl(testUrl);
          if (parsed && parsed.items && parsed.items.length > 0) {
            return testUrl;
          }
        } catch {
          continue;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to discover RSS feed: ${error}`);
      return null;
    }
  }

  private async extractWithHeuristics(siteUrl: string): Promise<any[]> {
    const playwrightService = this.playwrightService as any;
    const browser = await playwrightService.getBrowser();
    const context = await browser.newContext({
      userAgent: playwrightService.userAgent || 'Mozilla/5.0 (compatible; RSSApp/1.0)',
    });
    const page = await context.newPage();

    try {
      await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const articles = await page.evaluate(() => {
        const results: any[] = [];

        // Heurísticas comuns para encontrar artigos
        const articleSelectors = [
          'article',
          '[role="article"]',
          '.post',
          '.news-item',
          '.article',
          '.entry',
          '.story',
          '[class*="article"]',
          '[class*="post"]',
          '[class*="news"]',
          '[class*="item"]',
        ];

        let articleElements: NodeListOf<Element> | null = null;

        // Tentar cada seletor até encontrar elementos
        for (const selector of articleSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length >= 3) { // Pelo menos 3 artigos
            articleElements = elements;
            break;
          }
        }

        if (!articleElements || articleElements.length === 0) {
          return [];
        }

        articleElements.forEach((articleEl) => {
          try {
            const article: any = {};

            // Título - procurar h1, h2, h3, ou .title
            const titleSelectors = ['h1 a', 'h2 a', 'h3 a', 'h1', 'h2', 'h3', '.title', '.post-title', 'a[href]'];
            for (const sel of titleSelectors) {
              const el = articleEl.querySelector(sel);
              if (el) {
                article.title = el.textContent?.trim() || null;
                // Se for um link, pegar o href também
                if (el.tagName === 'A' || el.querySelector('a')) {
                  const linkEl = el.tagName === 'A' ? el : el.querySelector('a');
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
                if (article.title) break;
              }
            }

            // Link - se não encontrou no título, procurar qualquer link
            if (!article.link) {
              const linkEl = articleEl.querySelector('a[href]');
              if (linkEl) {
                const href = linkEl.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  article.link = href.startsWith('http')
                    ? href
                    : new URL(href, window.location.href).href;
                  article.url = article.link;
                }
              }
            }

            // Subtítulo - procurar .excerpt, .summary, primeiro parágrafo
            const subtitleSelectors = ['.excerpt', '.summary', '.lead', 'p', '.description'];
            for (const sel of subtitleSelectors) {
              const el = articleEl.querySelector(sel);
              if (el) {
                const text = el.textContent?.trim();
                if (text && text.length > 20) { // Pelo menos 20 caracteres
                  article.subtitle = text;
                  break;
                }
              }
            }

            // Imagem - procurar img dentro do artigo
            const imgEl = articleEl.querySelector('img');
            if (imgEl) {
              const src = imgEl.getAttribute('src') ||
                imgEl.getAttribute('data-src') ||
                (imgEl as HTMLImageElement).src;
              if (src) {
                article.imageUrl = src.startsWith('http')
                  ? src
                  : new URL(src, window.location.href).href;
                article.image = article.imageUrl;
              }
            }

            // Data - procurar time, .date, [datetime]
            const dateSelectors = ['time', '.date', '.published', '[datetime]', '[data-date]'];
            for (const sel of dateSelectors) {
              const el = articleEl.querySelector(sel);
              if (el) {
                const dateStr = el.getAttribute('datetime') ||
                  el.getAttribute('data-date') ||
                  el.getAttribute('content') ||
                  el.textContent?.trim();
                if (dateStr) {
                  article.publishedAt = dateStr;
                  break;
                }
              }
            }

            // Só adicionar se tiver título e link
            if (article.title && article.link) {
              results.push(article);
            }
          } catch (e) {
            // Skip invalid articles
            console.error('Error extracting article:', e);
          }
        });

        return results;
      });

      await context.close();

      // Limitar a 20 itens
      return articles.slice(0, 20);
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  private async extractArticlesDynamically(feed: any): Promise<any[]> {
    const playwrightService = this.playwrightService as any;
    const browser = await playwrightService.getBrowser();
    const context = await browser.newContext({
      userAgent: playwrightService.userAgent || 'Mozilla/5.0 (compatible; RSSApp/1.0)',
    });
    const page = await context.newPage();

    try {
      await page.goto(feed.siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for JS to render

      const articles = await page.evaluate((config: any) => {
        const results: any[] = [];
        const articleElements = document.querySelectorAll(config.articleSelector);

        articleElements.forEach((articleEl) => {
          try {
            const article: any = {};
            const selectors = config.selectors;

            // Extract title
            if (selectors.title) {
              const titleEl = articleEl.querySelector(selectors.title);
              if (titleEl) {
                article.title = titleEl.textContent?.trim() || null;
              }
            }

            // Extract link
            if (selectors.link) {
              const linkEl = articleEl.querySelector(selectors.link);
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
            if (selectors.subtitle) {
              const subtitleEl = articleEl.querySelector(selectors.subtitle);
              if (subtitleEl) {
                article.subtitle = subtitleEl.textContent?.trim() || null;
              }
            }

            // Extract image
            if (selectors.image) {
              const imageEl = articleEl.querySelector(selectors.image);
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
            if (selectors.publishedAt) {
              const dateEl = articleEl.querySelector(selectors.publishedAt);
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
      }, {
        articleSelector: feed.articleSelector,
        selectors: feed.selectors,
      });

      await context.close();

      // Limitar a 20 itens para performance (o app vai pegar só 5 mesmo)
      return articles.slice(0, 20);
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(name: string) {
    // Check if category already exists
    const existing = await this.prisma.category.findUnique({
      where: { name },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.category.create({
      data: { name },
    });
  }
}
