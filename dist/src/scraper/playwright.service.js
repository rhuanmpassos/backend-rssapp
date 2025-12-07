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
var PlaywrightService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const playwright_1 = require("playwright");
let PlaywrightService = PlaywrightService_1 = class PlaywrightService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(PlaywrightService_1.name);
        this.browser = null;
        this.ARTICLE_SELECTORS = [
            '[itemtype*="schema.org/Article"]',
            '[itemtype*="schema.org/NewsArticle"]',
            '[itemtype*="schema.org/BlogPosting"]',
            'article',
            'main article',
            '[role="article"]',
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
            '[data-testid*="article"]',
            '[data-component*="article"]',
            '[data-type="article"]',
        ];
        this.timeout = this.configService.get('PLAYWRIGHT_TIMEOUT', 30000);
        this.userAgent = this.configService.get('USER_AGENT', 'Mozilla/5.0 (compatible; RSSApp/1.0; +https://github.com/rssapp)');
    }
    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
    async getBrowser() {
        if (!this.browser) {
            this.browser = await playwright_1.chromium.launch({
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
    async scrapePage(url) {
        let page = null;
        try {
            const browser = await this.getBrowser();
            const context = await browser.newContext({
                userAgent: this.userAgent,
                viewport: { width: 1280, height: 720 },
            });
            page = await context.newPage();
            await page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                    route.abort();
                }
                else {
                    route.continue();
                }
            });
            this.logger.debug(`Scraping page: ${url}`);
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeout,
            });
            await page.waitForTimeout(2000);
            const jsonLdData = await this.extractJsonLd(page);
            const metadata = await page.evaluate(() => {
                const getMeta = (name) => {
                    const el = document.querySelector(`meta[property="${name}"]`) ||
                        document.querySelector(`meta[name="${name}"]`);
                    return el?.getAttribute('content') || null;
                };
                const getLink = (rel) => {
                    const el = document.querySelector(`link[rel="${rel}"]`);
                    return el?.getAttribute('href') || null;
                };
                const title = getMeta('og:title') ||
                    getMeta('twitter:title') ||
                    document.querySelector('h1')?.textContent?.trim() ||
                    document.title;
                let description = getMeta('og:description') ||
                    getMeta('twitter:description') ||
                    getMeta('description');
                if (!description) {
                    const article = document.querySelector('article');
                    const firstP = article?.querySelector('p') || document.querySelector('main p');
                    description = firstP?.textContent?.trim() || null;
                }
                const thumbnailUrl = getMeta('og:image') ||
                    getMeta('og:image:url') ||
                    getMeta('twitter:image') ||
                    getMeta('twitter:image:src') ||
                    document.querySelector('article img')?.getAttribute('src') ||
                    document.querySelector('[class*="article"] img')?.getAttribute('src') ||
                    document.querySelector('main img')?.getAttribute('src') ||
                    null;
                const author = getMeta('author') ||
                    getMeta('article:author') ||
                    getMeta('twitter:creator') ||
                    document.querySelector('[rel="author"]')?.textContent?.trim() ||
                    document.querySelector('[class*="author"]')?.textContent?.trim() ||
                    document.querySelector('[itemprop="author"]')?.textContent?.trim() ||
                    null;
                const publishedStr = getMeta('article:published_time') ||
                    getMeta('datePublished') ||
                    getMeta('date') ||
                    document.querySelector('time')?.getAttribute('datetime') ||
                    document.querySelector('[itemprop="datePublished"]')?.getAttribute('content') ||
                    null;
                const canonicalUrl = getLink('canonical') || null;
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
            const finalTitle = jsonLdData?.headline || jsonLdData?.name || metadata.title || 'Untitled';
            const finalDescription = jsonLdData?.description || metadata.description;
            const finalThumbnail = this.extractThumbnailFromJsonLd(jsonLdData) || metadata.thumbnailUrl;
            const finalAuthor = this.extractAuthorFromJsonLd(jsonLdData) || metadata.author;
            const finalPublished = jsonLdData?.datePublished || metadata.publishedStr;
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
        }
        catch (error) {
            this.logger.error(`Failed to scrape page ${url}: ${error}`);
            return null;
        }
        finally {
            if (page) {
                await page.close().catch(() => { });
            }
        }
    }
    async extractJsonLd(page) {
        try {
            const jsonLdItems = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                const items = [];
                scripts.forEach((script) => {
                    try {
                        const data = JSON.parse(script.textContent || '{}');
                        if (data['@graph'] && Array.isArray(data['@graph'])) {
                            items.push(...data['@graph']);
                        }
                        else {
                            items.push(data);
                        }
                    }
                    catch {
                    }
                });
                return items;
            });
            const articleTypes = ['NewsArticle', 'Article', 'BlogPosting', 'WebPage', 'ReportageNewsArticle'];
            for (const item of jsonLdItems) {
                const itemType = item['@type'];
                if (articleTypes.includes(itemType) || (Array.isArray(itemType) && itemType.some(t => articleTypes.includes(t)))) {
                    this.logger.debug(`Found JSON-LD article data: ${itemType}`);
                    return item;
                }
            }
            return null;
        }
        catch (error) {
            this.logger.debug(`Failed to extract JSON-LD: ${error}`);
            return null;
        }
    }
    extractThumbnailFromJsonLd(jsonLd) {
        if (!jsonLd)
            return null;
        const image = jsonLd.image || jsonLd.thumbnailUrl;
        if (!image)
            return null;
        if (typeof image === 'string')
            return image;
        if (Array.isArray(image))
            return image[0]?.url || image[0] || null;
        if (typeof image === 'object')
            return image.url || image.contentUrl || null;
        return null;
    }
    extractAuthorFromJsonLd(jsonLd) {
        if (!jsonLd)
            return null;
        const author = jsonLd.author;
        if (!author)
            return null;
        if (typeof author === 'string')
            return author;
        if (Array.isArray(author))
            return author[0]?.name || null;
        if (typeof author === 'object')
            return author.name || null;
        return null;
    }
    calculateConfidence(data) {
        let score = 0;
        if (data.title && data.title !== 'Untitled')
            score++;
        if (data.description && data.description.length > 20)
            score++;
        if (data.thumbnailUrl)
            score++;
        if (data.author)
            score++;
        if (data.publishedAt)
            score++;
        if (data.hasJsonLd && score > 0) {
            this.logger.debug('JSON-LD data found, high confidence');
        }
        return score;
    }
    async scrapeArticleLinks(url) {
        let page = null;
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
            const articleSelectors = this.ARTICLE_SELECTORS;
            const links = await page.evaluate((selectors) => {
                const articleLinks = [];
                const seen = new Set();
                const siteSpecificSelectors = {
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
                                const hrefLower = href.toLowerCase();
                                const currentHostname = window.location.hostname.toLowerCase();
                                if (currentHostname === 'g1.globo.com') {
                                    if (hrefLower.includes('/noticia/') ||
                                        hrefLower.includes('/mundo/') ||
                                        hrefLower.includes('/brasil/') ||
                                        hrefLower.includes('/economia/') ||
                                        hrefLower.includes('/tecnologia/') ||
                                        hrefLower.includes('/politica/') ||
                                        hrefLower.includes('/esporte/') ||
                                        hrefLower.includes('/ciencia/') ||
                                        hrefLower.match(/\/\d{4}\/\d{2}\/\d{2}\//)) {
                                        seen.add(href);
                                        articleLinks.push(href);
                                    }
                                }
                                else {
                                    if (hrefLower.includes('/noticia/') ||
                                        hrefLower.includes('/news/') ||
                                        hrefLower.includes('/article/') ||
                                        hrefLower.includes('/articles/') ||
                                        hrefLower.includes('/post/') ||
                                        hrefLower.includes('/posts/') ||
                                        hrefLower.includes('/blog/') ||
                                        hrefLower.includes('/story/') ||
                                        hrefLower.includes('/materia/') ||
                                        hrefLower.match(/\d{4}\/\d{2}\/\d{2}/) ||
                                        hrefLower.match(/\d{4}\/\d{2}\//) ||
                                        (hrefLower.length > 30 && !hrefLower.includes('#') && !hrefLower.includes('?'))) {
                                        seen.add(href);
                                        articleLinks.push(href);
                                    }
                                }
                            }
                        });
                    }
                    catch {
                    }
                }
                return articleLinks;
            }, this.ARTICLE_SELECTORS);
            await context.close();
            const resolvedLinks = links
                .map((link) => {
                try {
                    return new URL(link, url).href;
                }
                catch {
                    return null;
                }
            })
                .filter((link) => {
                if (!link)
                    return false;
                try {
                    const parsed = new URL(link);
                    const path = parsed.pathname;
                    if (path === '/' ||
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
                        path.includes('newsletter')) {
                        return false;
                    }
                    return true;
                }
                catch {
                    return false;
                }
            });
            const uniqueLinks = [...new Set(resolvedLinks)].slice(0, 30);
            this.logger.log(`Found ${uniqueLinks.length} unique article links from ${url}`);
            return uniqueLinks;
        }
        catch (error) {
            this.logger.error(`Failed to scrape article links from ${url}: ${error}`);
            return [];
        }
        finally {
            if (page) {
                await page.close().catch(() => { });
            }
        }
    }
    async checkXRobotsTag(url) {
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
                    return false;
                }
            }
            return true;
        }
        catch {
            return true;
        }
    }
    truncateExcerpt(text) {
        if (!text)
            return undefined;
        if (text.length > 500) {
            return text.slice(0, 497) + '...';
        }
        return text;
    }
    resolveUrl(url, baseUrl) {
        try {
            return new URL(url, baseUrl).href;
        }
        catch {
            return url;
        }
    }
};
exports.PlaywrightService = PlaywrightService;
exports.PlaywrightService = PlaywrightService = PlaywrightService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PlaywrightService);
//# sourceMappingURL=playwright.service.js.map