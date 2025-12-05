"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CustomFeedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomFeedService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const playwright_service_1 = require("../../scraper/playwright.service");
const rss_parser_service_1 = require("../../scraper/rss-parser.service");
let CustomFeedService = CustomFeedService_1 = class CustomFeedService {
    constructor(prisma, playwrightService, rssParserService) {
        this.prisma = prisma;
        this.playwrightService = playwrightService;
        this.rssParserService = rssParserService;
        this.logger = new common_1.Logger(CustomFeedService_1.name);
    }
    async create(dto) {
        const existing = await this.prisma.customFeed.findUnique({
            where: { slug: dto.slug },
        });
        if (existing) {
            throw new common_1.BadRequestException('A feed with this slug already exists');
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
    async searchPublicFeeds(query) {
        const where = {
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
    async findOne(slug) {
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
            throw new common_1.NotFoundException('Custom feed not found');
        }
        return feed;
    }
    async findOneById(id) {
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
            throw new common_1.NotFoundException('Custom feed not found');
        }
        return feed;
    }
    async update(id, dto) {
        const feed = await this.prisma.customFeed.findUnique({
            where: { id },
        });
        if (!feed) {
            throw new common_1.NotFoundException('Custom feed not found');
        }
        if (dto.slug && dto.slug !== feed.slug) {
            const existing = await this.prisma.customFeed.findUnique({
                where: { slug: dto.slug },
            });
            if (existing) {
                throw new common_1.BadRequestException('A feed with this slug already exists');
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
    async delete(id) {
        const feed = await this.prisma.customFeed.findUnique({
            where: { id },
        });
        if (!feed) {
            throw new common_1.NotFoundException('Custom feed not found');
        }
        await this.prisma.customFeed.delete({
            where: { id },
        });
        this.logger.log(`Custom feed deleted: ${feed.slug}`);
        return { message: 'Custom feed deleted successfully' };
    }
    async addItem(feedId, dto) {
        const feed = await this.prisma.customFeed.findUnique({
            where: { id: feedId },
        });
        if (!feed) {
            throw new common_1.NotFoundException('Custom feed not found');
        }
        let content = dto.content;
        if (!content && dto.link) {
            try {
                const scraped = await this.playwrightService.scrapePage(dto.link);
                content = scraped?.excerpt || scraped?.description;
            }
            catch (error) {
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
    async updateItem(itemId, dto) {
        const item = await this.prisma.customFeedItem.findUnique({
            where: { id: itemId },
        });
        if (!item) {
            throw new common_1.NotFoundException('Feed item not found');
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
    async deleteItem(itemId) {
        const item = await this.prisma.customFeedItem.findUnique({
            where: { id: itemId },
        });
        if (!item) {
            throw new common_1.NotFoundException('Feed item not found');
        }
        await this.prisma.customFeedItem.delete({
            where: { id: itemId },
        });
        return { message: 'Feed item deleted successfully' };
    }
    async getRssXml(slug) {
        const feed = await this.findOne(slug);
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const feedUrl = `${baseUrl}/api/v1/custom-feeds/${slug}/rss.xml`;
        let items = [];
        if (feed.siteUrl) {
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
                                imageUrl: item.thumbnailUrl,
                                publishedAt: item.publishedAt,
                            }));
                            this.logger.log(`Using discovered RSS feed with ${items.length} items`);
                        }
                    }
                }
                catch (error) {
                    this.logger.warn(`RSS discovery failed: ${error}`);
                }
            }
            if (items.length === 0) {
                try {
                    this.logger.log(`Trying automatic extraction with heuristics for feed: ${feed.slug}`);
                    items = await this.extractWithHeuristics(feed.siteUrl);
                }
                catch (error) {
                    this.logger.error(`Failed to extract articles for feed ${feed.slug}: ${error}`);
                    items = feed.items || [];
                }
            }
        }
        else {
            items = feed.items || [];
        }
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
                const imageUrl = item.imageUrl || item.image;
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
    async discoverRssFeed(siteUrl) {
        try {
            const scraped = await this.playwrightService.scrapePage(siteUrl);
            if (scraped && scraped.html) {
                const rssUrl = await this.rssParserService.discoverRssUrl(scraped.html, siteUrl);
                if (rssUrl) {
                    return rssUrl;
                }
            }
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
                }
                catch {
                    continue;
                }
            }
            return null;
        }
        catch (error) {
            this.logger.warn(`Failed to discover RSS feed: ${error}`);
            return null;
        }
    }
    async extractWithHeuristics(siteUrl) {
        const playwrightService = this.playwrightService;
        const browser = await playwrightService.getBrowser();
        const context = await browser.newContext({
            userAgent: playwrightService.userAgent || 'Mozilla/5.0 (compatible; RSSApp/1.0)',
        });
        const page = await context.newPage();
        try {
            await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            const articles = await page.evaluate(() => {
                const results = [];
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
                let articleElements = null;
                for (const selector of articleSelectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length >= 3) {
                        articleElements = elements;
                        break;
                    }
                }
                if (!articleElements || articleElements.length === 0) {
                    return [];
                }
                articleElements.forEach((articleEl) => {
                    try {
                        const article = {};
                        const titleSelectors = ['h1 a', 'h2 a', 'h3 a', 'h1', 'h2', 'h3', '.title', '.post-title', 'a[href]'];
                        for (const sel of titleSelectors) {
                            const el = articleEl.querySelector(sel);
                            if (el) {
                                article.title = el.textContent?.trim() || null;
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
                                if (article.title)
                                    break;
                            }
                        }
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
                        const subtitleSelectors = ['.excerpt', '.summary', '.lead', 'p', '.description'];
                        for (const sel of subtitleSelectors) {
                            const el = articleEl.querySelector(sel);
                            if (el) {
                                const text = el.textContent?.trim();
                                if (text && text.length > 20) {
                                    article.subtitle = text;
                                    break;
                                }
                            }
                        }
                        const imgEl = articleEl.querySelector('img');
                        if (imgEl) {
                            const src = imgEl.getAttribute('src') ||
                                imgEl.getAttribute('data-src') ||
                                imgEl.src;
                            if (src) {
                                article.imageUrl = src.startsWith('http')
                                    ? src
                                    : new URL(src, window.location.href).href;
                                article.image = article.imageUrl;
                            }
                        }
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
                        if (article.title && article.link) {
                            results.push(article);
                        }
                    }
                    catch (e) {
                        console.error('Error extracting article:', e);
                    }
                });
                return results;
            });
            await context.close();
            return articles.slice(0, 20);
        }
        catch (error) {
            await context.close();
            throw error;
        }
    }
    async extractArticlesDynamically(feed) {
        const playwrightService = this.playwrightService;
        const browser = await playwrightService.getBrowser();
        const context = await browser.newContext({
            userAgent: playwrightService.userAgent || 'Mozilla/5.0 (compatible; RSSApp/1.0)',
        });
        const page = await context.newPage();
        try {
            await page.goto(feed.siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            const articles = await page.evaluate((config) => {
                const results = [];
                const articleElements = document.querySelectorAll(config.articleSelector);
                articleElements.forEach((articleEl) => {
                    try {
                        const article = {};
                        const selectors = config.selectors;
                        if (selectors.title) {
                            const titleEl = articleEl.querySelector(selectors.title);
                            if (titleEl) {
                                article.title = titleEl.textContent?.trim() || null;
                            }
                        }
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
                        if (selectors.subtitle) {
                            const subtitleEl = articleEl.querySelector(selectors.subtitle);
                            if (subtitleEl) {
                                article.subtitle = subtitleEl.textContent?.trim() || null;
                            }
                        }
                        if (selectors.image) {
                            const imageEl = articleEl.querySelector(selectors.image);
                            if (imageEl) {
                                const src = imageEl.getAttribute('src') ||
                                    imageEl.getAttribute('data-src') ||
                                    imageEl.src;
                                if (src) {
                                    article.imageUrl = src.startsWith('http')
                                        ? src
                                        : new URL(src, window.location.href).href;
                                    article.image = article.imageUrl;
                                }
                            }
                        }
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
                        if (article.title && article.link) {
                            results.push(article);
                        }
                    }
                    catch (e) {
                        console.error('Error extracting article:', e);
                    }
                });
                return results;
            }, {
                articleSelector: feed.articleSelector,
                selectors: feed.selectors,
            });
            await context.close();
            return articles.slice(0, 20);
        }
        catch (error) {
            await context.close();
            throw error;
        }
    }
    async getCategories() {
        return this.prisma.category.findMany({
            orderBy: { name: 'asc' },
        });
    }
    async createCategory(name) {
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
};
exports.CustomFeedService = CustomFeedService;
exports.CustomFeedService = CustomFeedService = CustomFeedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        playwright_service_1.PlaywrightService,
        rss_parser_service_1.RssParserService])
], CustomFeedService);
//# sourceMappingURL=custom-feed.service.js.map