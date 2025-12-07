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
var ScraperService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../common/prisma/prisma.service");
const redis_service_1 = require("../common/redis/redis.service");
const rss_parser_service_1 = require("./rss-parser.service");
const playwright_service_1 = require("./playwright.service");
const robots_service_1 = require("./robots.service");
const feed_service_1 = require("../modules/feed/feed.service");
const feed_item_service_1 = require("../modules/feed/feed-item.service");
const push_service_1 = require("../modules/push/push.service");
const client_1 = require("@prisma/client");
let ScraperService = ScraperService_1 = class ScraperService {
    constructor(prisma, redis, configService, rssParser, playwright, robots, feedService, feedItemService, pushService) {
        this.prisma = prisma;
        this.redis = redis;
        this.configService = configService;
        this.rssParser = rssParser;
        this.playwright = playwright;
        this.robots = robots;
        this.feedService = feedService;
        this.feedItemService = feedItemService;
        this.pushService = pushService;
        this.logger = new common_1.Logger(ScraperService_1.name);
        this.politenessDelay = this.configService.get('SCRAPER_POLITENESS_DELAY', 2000);
    }
    async queueFeedDiscovery(feedId) {
        await this.prisma.jobLog.create({
            data: {
                jobType: client_1.JobType.scrape_feed,
                target: feedId,
                status: client_1.JobStatus.pending,
            },
        });
        this.logger.log(`Queueing feed discovery for feed: ${feedId}`);
        this.discoverAndScrapeFeed(feedId).catch((err) => {
            this.logger.error(`Feed discovery failed for ${feedId}: ${err.message}`, err.stack);
        });
    }
    async queueFeedScrape(feedId) {
        await this.prisma.jobLog.create({
            data: {
                jobType: client_1.JobType.scrape_feed,
                target: feedId,
                status: client_1.JobStatus.pending,
            },
        });
        setImmediate(() => {
            this.scrapeFeed(feedId).catch((err) => {
                this.logger.error(`Feed scrape failed: ${err}`);
            });
        });
    }
    async discoverAndScrapeFeed(feedId) {
        const lockKey = `feed-discovery:${feedId}`;
        const lockAcquired = await this.redis.acquireLock(lockKey, 300);
        if (!lockAcquired) {
            this.logger.debug(`Feed discovery already in progress: ${feedId}`);
            return;
        }
        try {
            this.logger.log(`Starting feed discovery for feed: ${feedId}`);
            const feed = await this.feedService.getFeedById(feedId);
            this.logger.log(`Feed URL: ${feed.url}, Status: ${feed.status}`);
            await this.prisma.jobLog.updateMany({
                where: {
                    jobType: client_1.JobType.scrape_feed,
                    target: feedId,
                    status: client_1.JobStatus.pending,
                },
                data: { status: client_1.JobStatus.running },
            });
            if (feed.rssUrl) {
                this.logger.log(`Feed already has RSS URL, using it directly: ${feed.rssUrl}`);
                const isCustomYouTubeFeed = feed.rssUrl.includes('/custom-youtube-feeds/');
                if (isCustomYouTubeFeed) {
                    await this.feedService.updateFeed(feedId, {
                        status: client_1.FeedStatus.active,
                    });
                }
                else {
                    await this.feedService.updateFeed(feedId, {
                        status: client_1.FeedStatus.active,
                    });
                }
                this.logger.log(`Starting feed scrape for: ${feedId}`);
                try {
                    await this.scrapeFeed(feedId);
                }
                catch (error) {
                    this.logger.error(`RSS scraping failed: ${error}`);
                    if (!isCustomYouTubeFeed) {
                        await this.scrapeFeedFromHtml(feedId, feed.url);
                    }
                }
                return;
            }
            this.logger.debug(`Checking robots.txt for: ${feed.url}`);
            const canScrape = await this.robots.isAllowed(feed.url);
            if (!canScrape) {
                this.logger.warn(`Feed ${feedId} blocked by robots.txt`);
                await this.feedService.markFeedBlocked(feedId);
                await this.prisma.jobLog.updateMany({
                    where: {
                        jobType: client_1.JobType.scrape_feed,
                        target: feedId,
                        status: client_1.JobStatus.running,
                    },
                    data: {
                        status: client_1.JobStatus.failed,
                        lastError: 'Blocked by robots.txt',
                    },
                });
                return;
            }
            this.logger.log(`Discovering RSS feed for: ${feed.url}`);
            const rssUrl = await this.discoverRssFeed(feed.url);
            if (rssUrl) {
                this.logger.log(`RSS feed discovered: ${rssUrl}`);
                await this.feedService.updateFeed(feedId, {
                    rssUrl,
                    status: client_1.FeedStatus.active,
                });
                this.logger.log(`Starting feed scrape for: ${feedId}`);
                try {
                    await this.scrapeFeed(feedId);
                }
                catch (error) {
                    this.logger.error(`RSS scraping failed, trying HTML extraction: ${error}`);
                    await this.scrapeFeedFromHtml(feedId, feed.url);
                }
            }
            else {
                this.logger.log(`No RSS feed found, extracting articles directly from HTML: ${feed.url}`);
                await this.scrapeFeedFromHtml(feedId, feed.url);
            }
        }
        catch (error) {
            this.logger.error(`Feed discovery error: ${error}`);
            await this.feedService.markFeedError(feedId, String(error));
            await this.prisma.jobLog.updateMany({
                where: {
                    jobType: client_1.JobType.scrape_feed,
                    target: feedId,
                    status: client_1.JobStatus.running,
                },
                data: {
                    status: client_1.JobStatus.failed,
                    lastError: String(error),
                },
            });
        }
        finally {
            await this.redis.releaseLock(lockKey);
        }
    }
    async scrapeFeed(feedId) {
        const lockKey = `feed-scrape:${feedId}`;
        const lockAcquired = await this.redis.acquireLock(lockKey, 300);
        if (!lockAcquired) {
            this.logger.debug(`Feed scrape already in progress: ${feedId}`);
            return;
        }
        try {
            const feed = await this.feedService.getFeedById(feedId);
            if (!feed.rssUrl) {
                throw new Error('RSS URL not set');
            }
            await this.prisma.jobLog.updateMany({
                where: {
                    jobType: client_1.JobType.scrape_feed,
                    target: feedId,
                    status: client_1.JobStatus.pending,
                },
                data: { status: client_1.JobStatus.running },
            });
            const customYouTubeFeedMatch = feed.rssUrl.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml/);
            let actualRssUrl = feed.rssUrl;
            if (customYouTubeFeedMatch) {
                const slug = customYouTubeFeedMatch[1];
                this.logger.log(`Detected custom YouTube feed: ${slug}, fetching channel info...`);
                const customYouTubeFeed = await this.prisma.customYouTubeFeed.findUnique({
                    where: { slug },
                    select: { channelId: true, title: true },
                });
                if (customYouTubeFeed?.channelId) {
                    actualRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${customYouTubeFeed.channelId}`;
                    this.logger.log(`Using YouTube native RSS: ${actualRssUrl}`);
                }
                else {
                    this.logger.warn(`Custom YouTube feed ${slug} has no channelId, cannot scrape`);
                    throw new Error(`Custom YouTube feed ${slug} has no channelId configured`);
                }
            }
            const parsed = await this.rssParser.parseUrl(actualRssUrl);
            if (!parsed) {
                throw new Error('Failed to parse RSS feed');
            }
            await this.feedService.updateFeed(feedId, {
                title: parsed.title,
            });
            this.logger.log(`Processing ${parsed.items.length} items for feed ${feedId}`);
            let newItemsCount = 0;
            for (const item of parsed.items) {
                const existing = await this.prisma.feedItem.findFirst({
                    where: {
                        feedId: feed.id,
                        url: item.url,
                    },
                });
                if (existing) {
                    continue;
                }
                this.logger.debug(`Saving new item: title="${item.title}", thumbnail="${item.thumbnailUrl}"`);
                await this.feedItemService.createOrUpdate({
                    feedId: feed.id,
                    url: item.url,
                    title: item.title,
                    excerpt: item.excerpt || '',
                    thumbnailUrl: item.thumbnailUrl,
                    author: item.author,
                    publishedAt: item.publishedAt || new Date(),
                });
                newItemsCount++;
                const subscriptions = await this.prisma.subscription.findMany({
                    where: {
                        feedId: feed.id,
                        enabled: true,
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                preferences: true,
                            },
                        },
                    },
                });
                for (const subscription of subscriptions) {
                    if (subscription.user.preferences &&
                        subscription.user.preferences.notificationsEnabled) {
                        await this.pushService.sendToUser(subscription.user.id, {
                            title: parsed.title,
                            body: item.title,
                            data: {
                                type: 'feed_item',
                                feedId: feed.id,
                                itemUrl: item.url,
                            },
                        }).catch((err) => {
                            this.logger.error(`Failed to send notification: ${err}`);
                        });
                    }
                }
            }
            await this.prisma.jobLog.updateMany({
                where: {
                    jobType: client_1.JobType.scrape_feed,
                    target: feedId,
                    status: client_1.JobStatus.running,
                },
                data: {
                    status: client_1.JobStatus.completed,
                    result: { newItemsCount },
                },
            });
            this.logger.log(`Feed ${feedId} scraped: ${newItemsCount} new items`);
        }
        catch (error) {
            this.logger.error(`Feed scrape error: ${error}`);
            await this.feedService.markFeedError(feedId, String(error));
            await this.prisma.jobLog.updateMany({
                where: {
                    jobType: client_1.JobType.scrape_feed,
                    target: feedId,
                    status: client_1.JobStatus.running,
                },
                data: {
                    status: client_1.JobStatus.failed,
                    lastError: String(error),
                },
            });
        }
        finally {
            await this.redis.releaseLock(lockKey);
        }
    }
    async discoverRssFeed(siteUrl) {
        try {
            const baseUrl = new URL(siteUrl);
            const baseHref = baseUrl.href.replace(/\/$/, '');
            const hostname = baseUrl.hostname.toLowerCase();
            const siteSpecificPaths = {
                'g1.globo.com': [
                    'https://g1.globo.com/rss/g1/',
                    'https://g1.globo.com/rss/g1/index.xml',
                    '/rss/g1/',
                    '/rss/g1/index.xml',
                    '/rss/g1',
                    '/feed',
                    '/rss',
                    '/rss.xml',
                ],
                'oglobo.globo.com': [
                    '/rss',
                    '/feed',
                ],
                'extra.globo.com': [
                    '/rss',
                    '/feed',
                ],
                'folha.uol.com.br': [
                    '/rss',
                    '/feed',
                ],
                'estadao.com.br': [
                    '/rss',
                    '/feed',
                ],
            };
            const specificPaths = siteSpecificPaths[hostname] || [];
            const commonPaths = [
                '/feed',
                '/rss',
                '/rss.xml',
                '/feed.xml',
                '/atom.xml',
                '/index.xml',
            ];
            const allPaths = [...specificPaths, ...commonPaths];
            for (const path of allPaths) {
                const testUrl = path.startsWith('http') ? path : `${baseHref}${path}`;
                try {
                    this.logger.log(`Trying RSS path: ${testUrl}`);
                    const parsed = await this.rssParser.parseUrl(testUrl);
                    if (parsed && parsed.items && parsed.items.length > 0) {
                        this.logger.log(`Found RSS feed at: ${testUrl} with ${parsed.items.length} items`);
                        return testUrl;
                    }
                    else {
                        this.logger.debug(`RSS feed at ${testUrl} has no items`);
                    }
                }
                catch (error) {
                    this.logger.debug(`Failed to parse ${testUrl}: ${error}`);
                }
            }
            try {
                const scraped = await this.playwright.scrapePage(siteUrl);
                if (scraped && scraped.html) {
                    const rssLinkRegex = /<link[^>]+type=["'](?:application\/rss\+xml|application\/atom\+xml|text\/xml)["'][^>]+href=["']([^"']+)["']/gi;
                    const matches = Array.from(scraped.html.matchAll(rssLinkRegex));
                    if (matches.length > 0) {
                        const rssUrl = new URL(matches[0][1], siteUrl).href;
                        this.logger.log(`Found RSS feed via page scraping: ${rssUrl}`);
                        return rssUrl;
                    }
                }
            }
            catch (error) {
                this.logger.warn(`Failed to scrape page for RSS links: ${error}`);
            }
            return null;
        }
        catch (error) {
            this.logger.error(`RSS discovery error: ${error}`);
            return null;
        }
    }
    async scrapeFeedFromHtml(feedId, siteUrl) {
        const lockKey = `feed-html-scrape:${feedId}`;
        const lockAcquired = await this.redis.acquireLock(lockKey, 300);
        if (!lockAcquired) {
            this.logger.debug(`HTML scraping already in progress: ${feedId}`);
            return;
        }
        try {
            this.logger.log(`Extracting articles from HTML for: ${siteUrl}`);
            const feed = await this.feedService.getFeedById(feedId);
            this.logger.log(`Scraping article links from: ${siteUrl}`);
            const articleLinks = await this.playwright.scrapeArticleLinks(siteUrl);
            if (!articleLinks || articleLinks.length === 0) {
                this.logger.warn(`No article links found on: ${siteUrl}`);
                this.logger.warn(`This might be due to: 1) Site blocking scrapers, 2) JavaScript required, 3) Incorrect selectors`);
                await this.feedService.markFeedError(feedId, 'No article links found on page - may need manual RSS URL or different selectors');
                return;
            }
            this.logger.log(`Found ${articleLinks.length} article links, processing first 20...`);
            this.logger.debug(`Sample links: ${articleLinks.slice(0, 3).join(', ')}`);
            const linksToProcess = articleLinks.slice(0, 20);
            let newItemsCount = 0;
            const batchSize = 5;
            for (let i = 0; i < linksToProcess.length; i += batchSize) {
                const batch = linksToProcess.slice(i, i + batchSize);
                await Promise.all(batch.map(async (articleUrl) => {
                    try {
                        const existing = await this.prisma.feedItem.findFirst({
                            where: {
                                feedId: feed.id,
                                url: articleUrl,
                            },
                        });
                        if (existing) {
                            return;
                        }
                        const scraped = await this.playwright.scrapePage(articleUrl);
                        if (!scraped || !scraped.title) {
                            return;
                        }
                        await this.feedItemService.createOrUpdate({
                            feedId: feed.id,
                            url: articleUrl,
                            title: scraped.title,
                            excerpt: scraped.excerpt,
                            thumbnailUrl: scraped.thumbnailUrl,
                            author: scraped.author,
                            publishedAt: scraped.publishedAt || new Date(),
                            canonicalUrl: scraped.canonicalUrl,
                        });
                        newItemsCount++;
                        const subscriptions = await this.prisma.subscription.findMany({
                            where: {
                                feedId: feed.id,
                                enabled: true,
                            },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        preferences: true,
                                    },
                                },
                            },
                        });
                        for (const subscription of subscriptions) {
                            if (subscription.user.preferences &&
                                subscription.user.preferences.notificationsEnabled) {
                                await this.pushService.sendToUser(subscription.user.id, {
                                    title: feed.title || feed.siteDomain,
                                    body: scraped.title,
                                    data: {
                                        type: 'feed_item',
                                        feedId: feed.id,
                                        itemUrl: articleUrl,
                                    },
                                }).catch((err) => {
                                    this.logger.error(`Failed to send notification: ${err}`);
                                });
                            }
                        }
                    }
                    catch (error) {
                        this.logger.debug(`Failed to scrape article ${articleUrl}: ${error}`);
                    }
                }));
                if (i + batchSize < linksToProcess.length) {
                    await this.delay(500);
                }
            }
            await this.feedService.updateFeed(feedId, {
                status: client_1.FeedStatus.active,
                title: feed.title || new URL(siteUrl).hostname,
            });
            await this.prisma.jobLog.updateMany({
                where: {
                    jobType: client_1.JobType.scrape_feed,
                    target: feedId,
                    status: client_1.JobStatus.running,
                },
                data: {
                    status: client_1.JobStatus.completed,
                    result: { newItemsCount, method: 'html_scraping' },
                },
            });
            this.logger.log(`HTML scraping completed for ${feedId}: ${newItemsCount} new items`);
        }
        catch (error) {
            this.logger.error(`HTML scraping error: ${error}`);
            await this.feedService.markFeedError(feedId, String(error));
            await this.prisma.jobLog.updateMany({
                where: {
                    jobType: client_1.JobType.scrape_feed,
                    target: feedId,
                    status: client_1.JobStatus.running,
                },
                data: {
                    status: client_1.JobStatus.failed,
                    lastError: String(error),
                },
            });
        }
        finally {
            await this.redis.releaseLock(lockKey);
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.ScraperService = ScraperService;
exports.ScraperService = ScraperService = ScraperService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Inject)((0, common_1.forwardRef)(() => feed_service_1.FeedService))),
    __param(7, (0, common_1.Inject)((0, common_1.forwardRef)(() => feed_item_service_1.FeedItemService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        config_1.ConfigService,
        rss_parser_service_1.RssParserService,
        playwright_service_1.PlaywrightService,
        robots_service_1.RobotsService,
        feed_service_1.FeedService,
        feed_item_service_1.FeedItemService,
        push_service_1.PushService])
], ScraperService);
//# sourceMappingURL=scraper.service.js.map