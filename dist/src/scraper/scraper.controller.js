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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperController = void 0;
const common_1 = require("@nestjs/common");
const playwright_service_1 = require("./playwright.service");
let ScraperController = class ScraperController {
    constructor(playwrightService) {
        this.playwrightService = playwrightService;
    }
    async extractContent(dto) {
        const { url, selectors = {} } = dto;
        try {
            const scraped = await this.playwrightService.scrapePage(url);
            if (!scraped) {
                throw new Error('Failed to scrape page');
            }
            if (Object.keys(selectors).length > 0) {
                return await this.extractWithSelectors(url, selectors);
            }
            return {
                title: scraped.title,
                subtitle: scraped.description || scraped.excerpt,
                imageUrl: scraped.thumbnailUrl,
                publishedAt: scraped.publishedAt?.toISOString(),
                content: scraped.html,
            };
        }
        catch (error) {
            throw error;
        }
    }
    async extractMultiple(dto) {
        const { siteUrl, articleSelector, selectors } = dto;
        try {
            const playwrightService = this.playwrightService;
            const browser = await playwrightService.getBrowser();
            const context = await browser.newContext({
                userAgent: playwrightService.userAgent || 'Mozilla/5.0 (compatible; RSSApp/1.0)',
            });
            const page = await context.newPage();
            try {
                await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(3000);
                const articles = await page.evaluate((config) => {
                    const results = [];
                    const articleElements = document.querySelectorAll(config.articleSelector);
                    articleElements.forEach((articleEl) => {
                        try {
                            const article = {};
                            if (config.selectors.title) {
                                const titleEl = articleEl.querySelector(config.selectors.title);
                                if (titleEl) {
                                    article.title = titleEl.textContent?.trim() || null;
                                }
                            }
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
                            if (config.selectors.subtitle) {
                                const subtitleEl = articleEl.querySelector(config.selectors.subtitle);
                                if (subtitleEl) {
                                    article.subtitle = subtitleEl.textContent?.trim() || null;
                                }
                            }
                            if (config.selectors.image) {
                                const imageEl = articleEl.querySelector(config.selectors.image);
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
                            if (article.title && article.link) {
                                results.push(article);
                            }
                        }
                        catch (e) {
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
            }
            catch (error) {
                await context.close();
                throw error;
            }
        }
        catch (error) {
            throw error;
        }
    }
    async extractWithSelectors(url, selectors) {
        const scraped = await this.playwrightService.scrapePage(url);
        const playwrightService = this.playwrightService;
        const browser = await playwrightService.getBrowser();
        const context = await browser.newContext({
            userAgent: playwrightService.userAgent || 'Mozilla/5.0 (compatible; RSSApp/1.0)',
        });
        const page = await context.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);
            const extracted = await page.evaluate((sel) => {
                const result = {};
                if (sel?.title) {
                    try {
                        const el = document.querySelector(sel.title);
                        result.title = el?.textContent?.trim() || null;
                    }
                    catch (e) {
                        result.title = null;
                    }
                }
                if (sel?.subtitle) {
                    try {
                        const el = document.querySelector(sel.subtitle);
                        result.subtitle = el?.textContent?.trim() || null;
                    }
                    catch (e) {
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
                                el.src ||
                                null;
                        }
                    }
                    catch (e) {
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
                    }
                    catch (e) {
                        result.publishedAt = null;
                    }
                }
                if (sel?.content) {
                    try {
                        const el = document.querySelector(sel.content);
                        result.content = el?.textContent?.trim() ||
                            el?.innerHTML ||
                            null;
                    }
                    catch (e) {
                        result.content = null;
                    }
                }
                return result;
            }, selectors);
            return {
                title: extracted.title || scraped?.title || 'Untitled',
                subtitle: extracted.subtitle || scraped?.description || scraped?.excerpt,
                imageUrl: extracted.imageUrl || scraped?.thumbnailUrl,
                publishedAt: extracted.publishedAt
                    ? new Date(extracted.publishedAt).toISOString()
                    : scraped?.publishedAt?.toISOString(),
                content: extracted.content || scraped?.html,
            };
        }
        finally {
            await context.close();
        }
    }
};
exports.ScraperController = ScraperController;
__decorate([
    (0, common_1.Post)('extract'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScraperController.prototype, "extractContent", null);
__decorate([
    (0, common_1.Post)('extract-multiple'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScraperController.prototype, "extractMultiple", null);
exports.ScraperController = ScraperController = __decorate([
    (0, common_1.Controller)('scraper'),
    __metadata("design:paramtypes", [playwright_service_1.PlaywrightService])
], ScraperController);
//# sourceMappingURL=scraper.controller.js.map