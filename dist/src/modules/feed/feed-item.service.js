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
var FeedItemService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedItemService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const feed_service_1 = require("./feed.service");
const crypto = require("crypto");
let FeedItemService = FeedItemService_1 = class FeedItemService {
    constructor(prisma, feedService) {
        this.prisma = prisma;
        this.feedService = feedService;
        this.logger = new common_1.Logger(FeedItemService_1.name);
    }
    async createOrUpdate(data) {
        const normalizedUrl = this.feedService.normalizeUrl(data.url);
        const contentHash = this.generateContentHash(data);
        const existingItem = await this.prisma.feedItem.findFirst({
            where: {
                feedId: data.feedId,
                OR: [
                    { url: normalizedUrl },
                    { contentHash },
                ],
            },
        });
        if (existingItem) {
            if (existingItem.contentHash !== contentHash) {
                this.logger.debug(`Updating existing item: ${data.title}`);
                return this.prisma.feedItem.update({
                    where: { id: existingItem.id },
                    data: {
                        title: data.title,
                        excerpt: data.excerpt,
                        thumbnailUrl: data.thumbnailUrl,
                        contentHash,
                    },
                });
            }
            return existingItem;
        }
        this.logger.log(`Creating new feed item: ${data.title}`);
        try {
            return await this.prisma.feedItem.create({
                data: {
                    feedId: data.feedId,
                    url: normalizedUrl,
                    canonicalUrl: data.canonicalUrl,
                    title: data.title,
                    excerpt: this.truncateExcerpt(data.excerpt),
                    thumbnailUrl: data.thumbnailUrl,
                    author: data.author,
                    publishedAt: data.publishedAt || new Date(),
                    contentHash,
                },
            });
        }
        catch (error) {
            if (error?.code === 'P2002') {
                this.logger.debug(`Item already exists (race condition), skipping: ${data.title}`);
                const existing = await this.prisma.feedItem.findFirst({
                    where: {
                        feedId: data.feedId,
                        OR: [
                            { url: normalizedUrl },
                            { contentHash },
                        ],
                    },
                });
                return existing;
            }
            throw error;
        }
    }
    async bulkCreate(feedId, items) {
        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
        };
        for (const item of items) {
            try {
                const existing = await this.prisma.feedItem.findFirst({
                    where: {
                        feedId,
                        url: this.feedService.normalizeUrl(item.url),
                    },
                });
                if (existing) {
                    results.skipped++;
                }
                else {
                    await this.createOrUpdate({ ...item, feedId });
                    results.created++;
                }
            }
            catch (error) {
                this.logger.error(`Failed to create item ${item.url}: ${error}`);
                results.skipped++;
            }
        }
        return results;
    }
    async getRecentItems(feedId, limit = 50) {
        return this.prisma.feedItem.findMany({
            where: { feedId },
            orderBy: { publishedAt: 'desc' },
            take: limit,
        });
    }
    async getItemById(itemId) {
        return this.prisma.feedItem.findUnique({
            where: { id: itemId },
            include: {
                feed: {
                    select: {
                        id: true,
                        title: true,
                        siteDomain: true,
                    },
                },
            },
        });
    }
    async getNewItemsSince(feedId, since) {
        return this.prisma.feedItem.findMany({
            where: {
                feedId,
                fetchedAt: { gt: since },
            },
            orderBy: { fetchedAt: 'desc' },
        });
    }
    generateContentHash(data) {
        const content = `${data.url}|${data.title}`;
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
    }
    truncateExcerpt(excerpt) {
        if (!excerpt)
            return undefined;
        if (excerpt.length > 500) {
            return excerpt.slice(0, 497) + '...';
        }
        return excerpt;
    }
};
exports.FeedItemService = FeedItemService;
exports.FeedItemService = FeedItemService = FeedItemService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        feed_service_1.FeedService])
], FeedItemService);
//# sourceMappingURL=feed-item.service.js.map