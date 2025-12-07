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
var FeedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const scraper_service_1 = require("../../scraper/scraper.service");
const client_1 = require("@prisma/client");
const crypto = require("crypto");
let FeedService = FeedService_1 = class FeedService {
    constructor(prisma, scraperService) {
        this.prisma = prisma;
        this.scraperService = scraperService;
        this.logger = new common_1.Logger(FeedService_1.name);
    }
    async getOrCreateFeed(url) {
        const normalizedUrl = this.normalizeUrl(url);
        const domain = new URL(normalizedUrl).hostname;
        let feed = await this.prisma.feed.findUnique({
            where: { url: normalizedUrl },
        });
        if (feed) {
            return feed;
        }
        feed = await this.prisma.feed.create({
            data: {
                url: normalizedUrl,
                siteDomain: domain,
                status: client_1.FeedStatus.pending,
            },
        });
        this.logger.log(`Created new feed: ${normalizedUrl}`);
        this.scraperService.queueFeedDiscovery(feed.id).catch((err) => {
            this.logger.error(`Failed to queue feed discovery: ${err.message}`);
        });
        return feed;
    }
    async getFeedById(feedId) {
        const feed = await this.prisma.feed.findUnique({
            where: { id: feedId },
        });
        if (!feed) {
            throw new common_1.NotFoundException('Feed not found');
        }
        return feed;
    }
    async listFeeds(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [feeds, total] = await Promise.all([
            this.prisma.feed.findMany({
                orderBy: { lastScrapeAt: 'desc' },
                skip,
                take: limit,
                include: {
                    _count: {
                        select: { items: true },
                    },
                },
            }),
            this.prisma.feed.count(),
        ]);
        return {
            data: feeds,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async getFeedItems(feedId, page = 1, limit = 20) {
        const feed = await this.getFeedById(feedId);
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.feedItem.findMany({
                where: { feedId: feed.id },
                orderBy: { publishedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.feedItem.count({ where: { feedId: feed.id } }),
        ]);
        const baseUrl = feed.url ? this.extractBaseUrl(feed.url) : '';
        const resolvedItems = items.map(item => ({
            ...item,
            thumbnailUrl: this.resolveRelativeUrl(item.thumbnailUrl, baseUrl),
        }));
        this.logger.debug(`Returning ${resolvedItems.length} items for feed ${feedId}, baseUrl: ${baseUrl}`);
        return {
            feed: {
                id: feed.id,
                title: feed.title,
                siteDomain: feed.siteDomain,
            },
            data: resolvedItems,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    extractBaseUrl(url) {
        try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.hostname}`;
        }
        catch {
            return '';
        }
    }
    resolveRelativeUrl(url, baseUrl) {
        if (!url)
            return null;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        if (baseUrl && url.startsWith('/')) {
            return `${baseUrl}${url}`;
        }
        if (url.startsWith('//')) {
            return `https:${url}`;
        }
        return url;
    }
    async updateFeed(feedId, data) {
        return this.prisma.feed.update({
            where: { id: feedId },
            data: {
                ...data,
                lastScrapeAt: new Date(),
            },
        });
    }
    async markFeedError(feedId, error) {
        return this.prisma.feed.update({
            where: { id: feedId },
            data: {
                status: client_1.FeedStatus.error,
                errorMessage: error,
                lastScrapeAt: new Date(),
            },
        });
    }
    async markFeedBlocked(feedId) {
        return this.prisma.feed.update({
            where: { id: feedId },
            data: {
                status: client_1.FeedStatus.blocked,
                errorMessage: 'Site blocks scraping (robots.txt or X-Robots-Tag)',
                lastScrapeAt: new Date(),
            },
        });
    }
    async getFeedsToScrape(limit = 10) {
        const staleTime = new Date(Date.now() - 10 * 60 * 1000);
        return this.prisma.feed.findMany({
            where: {
                status: { in: [client_1.FeedStatus.active, client_1.FeedStatus.pending] },
                OR: [
                    { lastScrapeAt: null },
                    { lastScrapeAt: { lt: staleTime } },
                ],
            },
            orderBy: { lastScrapeAt: 'asc' },
            take: limit,
        });
    }
    generateContentHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
    }
    normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            parsed.hostname = parsed.hostname.toLowerCase();
            let normalized = parsed.href;
            if (normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }
            return normalized;
        }
        catch {
            return url;
        }
    }
    queueFeedDiscovery(feedId) {
        return this.scraperService.queueFeedDiscovery(feedId);
    }
};
exports.FeedService = FeedService;
exports.FeedService = FeedService = FeedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => scraper_service_1.ScraperService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scraper_service_1.ScraperService])
], FeedService);
//# sourceMappingURL=feed.service.js.map