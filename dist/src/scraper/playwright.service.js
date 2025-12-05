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
                    getMeta('twitter:image') ||
                    document.querySelector('article img')?.getAttribute('src') ||
                    null;
                const author = getMeta('author') ||
                    getMeta('article:author') ||
                    document.querySelector('[rel="author"]')?.textContent?.trim() ||
                    null;
                const publishedStr = getMeta('article:published_time') ||
                    getMeta('datePublished') ||
                    document.querySelector('time')?.getAttribute('datetime') ||
                    null;
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
            const links = await page.evaluate(() => {
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
                        'article a',
                        '[role="article"] a',
                    ],
                };
                const hostname = window.location.hostname.toLowerCase();
                const specificSelectors = siteSpecificSelectors[hostname] || [];
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
                                const hrefLower = href.toLowerCase();
                                const hostname = window.location.hostname.toLowerCase();
                                if (hostname === 'g1.globo.com') {
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
                                        hrefLower.includes('/post/') ||
                                        hrefLower.match(/\d{4}\/\d{2}\/\d{2}/) ||
                                        (hrefLower.length > 20 && !hrefLower.includes('#'))) {
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
            });
            await context.close();
            return links
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
                        path.startsWith('/category') ||
                        path.startsWith('/author') ||
                        path.startsWith('/page') ||
                        path.includes('login') ||
                        path.includes('register')) {
                        return false;
                    }
                    return true;
                }
                catch {
                    return false;
                }
            })
                .slice(0, 20);
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