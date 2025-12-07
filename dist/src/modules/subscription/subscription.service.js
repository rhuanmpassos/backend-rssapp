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
var SubscriptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const feed_service_1 = require("../feed/feed.service");
const youtube_service_1 = require("../youtube/youtube.service");
const folder_service_1 = require("../folder/folder.service");
const custom_youtube_feed_service_1 = require("../custom-youtube-feed/custom-youtube-feed.service");
const client_1 = require("@prisma/client");
let SubscriptionService = SubscriptionService_1 = class SubscriptionService {
    constructor(prisma, feedService, youtubeService, folderService, customYouTubeFeedService) {
        this.prisma = prisma;
        this.feedService = feedService;
        this.youtubeService = youtubeService;
        this.folderService = folderService;
        this.customYouTubeFeedService = customYouTubeFeedService;
        this.logger = new common_1.Logger(SubscriptionService_1.name);
    }
    async createSiteSubscription(userId, dto) {
        this.logger.log(`Creating site subscription for user ${userId} with URL: ${dto.url}`);
        let validUrl;
        try {
            validUrl = new URL(dto.url);
        }
        catch {
            throw new common_1.BadRequestException('Invalid URL format');
        }
        const isYouTubeChannel = validUrl.hostname.includes('youtube.com') &&
            (validUrl.pathname.startsWith('/@') ||
                validUrl.pathname.startsWith('/channel/') ||
                validUrl.pathname.startsWith('/c/') ||
                validUrl.pathname.startsWith('/user/'));
        if (isYouTubeChannel) {
            this.logger.log(`Detected YouTube channel URL: ${dto.url}, creating custom feed...`);
            let slug;
            if (validUrl.pathname.startsWith('/@')) {
                slug = validUrl.pathname.substring(2).split('/')[0].toLowerCase();
            }
            else if (validUrl.pathname.startsWith('/channel/')) {
                slug = validUrl.pathname.split('/')[2].toLowerCase().substring(0, 20);
            }
            else if (validUrl.pathname.startsWith('/c/')) {
                slug = validUrl.pathname.split('/')[2].toLowerCase();
            }
            else if (validUrl.pathname.startsWith('/user/')) {
                slug = validUrl.pathname.split('/')[2].toLowerCase();
            }
            else {
                slug = `youtube-${Date.now()}`;
            }
            let customYouTubeFeed = await this.prisma.customYouTubeFeed.findUnique({
                where: { slug },
            });
            if (!customYouTubeFeed) {
                try {
                    customYouTubeFeed = await this.customYouTubeFeedService.create({
                        title: slug.charAt(0).toUpperCase() + slug.slice(1),
                        slug,
                        channelUrl: dto.url,
                    });
                    this.logger.log(`Created custom YouTube feed: ${slug}`);
                }
                catch (error) {
                    if (error.message?.includes('already exists')) {
                        customYouTubeFeed = await this.prisma.customYouTubeFeed.findUnique({
                            where: { slug },
                        });
                    }
                    else {
                        throw error;
                    }
                }
            }
            if (customYouTubeFeed) {
                const baseUrl = process.env.APP_URL || 'http://localhost:3000';
                dto.url = `${baseUrl}/api/v1/custom-youtube-feeds/${customYouTubeFeed.slug}/rss.xml`;
                this.logger.log(`Redirecting subscription to custom feed RSS: ${dto.url}`);
                validUrl = new URL(dto.url);
            }
        }
        const customFeedMatch = validUrl.pathname.match(/\/custom-feeds\/([^\/]+)\/rss\.xml$/);
        const customYouTubeFeedMatch = validUrl.pathname.match(/\/custom-youtube-feeds\/([^\/]+)\/rss\.xml$/);
        let folderId = dto.folderId;
        let targetUrl = validUrl.href;
        if (customFeedMatch) {
            const slug = customFeedMatch[1];
            const customFeed = await this.prisma.customFeed.findUnique({
                where: { slug },
                include: { category: true },
            });
            if (customFeed && customFeed.siteUrl) {
                targetUrl = customFeed.siteUrl;
                if (customFeed.category && !folderId) {
                    const categoryName = customFeed.category.name;
                    const folder = await this.folderService.findOrCreateFolder(userId, categoryName);
                    folderId = folder.id;
                }
            }
        }
        else if (customYouTubeFeedMatch) {
            const slug = customYouTubeFeedMatch[1];
            const customYouTubeFeed = await this.prisma.customYouTubeFeed.findUnique({
                where: { slug },
                include: { category: true },
            });
            if (customYouTubeFeed && customYouTubeFeed.channelUrl) {
                targetUrl = customYouTubeFeed.channelUrl;
                if (customYouTubeFeed.category && !folderId) {
                    const categoryName = customYouTubeFeed.category.name;
                    const folder = await this.folderService.findOrCreateFolder(userId, categoryName);
                    folderId = folder.id;
                }
            }
        }
        const existingSubscription = await this.prisma.subscription.findFirst({
            where: {
                userId,
                type: client_1.SubscriptionType.site,
                OR: [
                    { target: validUrl.href },
                    { target: targetUrl },
                ],
            },
        });
        if (existingSubscription) {
            this.logger.log(`Subscription already exists for user ${userId}, returning existing: ${existingSubscription.id}`);
            return this.prisma.subscription.findUnique({
                where: { id: existingSubscription.id },
                include: {
                    feed: true,
                    folder: true,
                },
            });
        }
        let feed = await this.prisma.feed.findFirst({
            where: {
                OR: [
                    { url: validUrl.href },
                    { url: targetUrl },
                    { rssUrl: validUrl.href },
                ],
            },
        });
        if (!feed) {
            if (customYouTubeFeedMatch) {
                const slug = customYouTubeFeedMatch[1];
                const customYouTubeFeedForTitle = await this.prisma.customYouTubeFeed.findUnique({
                    where: { slug },
                    select: { title: true },
                });
                const domain = new URL(validUrl.href).hostname;
                feed = await this.prisma.feed.create({
                    data: {
                        url: targetUrl,
                        rssUrl: validUrl.href,
                        siteDomain: domain,
                        status: client_1.FeedStatus.pending,
                        title: `YouTube: ${customYouTubeFeedForTitle?.title || 'Custom Feed'}`,
                    },
                });
                this.logger.log(`Created feed for custom YouTube feed with RSS URL: ${validUrl.href}`);
                await this.prisma.feed.update({
                    where: { id: feed.id },
                    data: { status: client_1.FeedStatus.active },
                });
                this.feedService.queueFeedDiscovery(feed.id).catch((err) => {
                    this.logger.error(`Failed to queue feed discovery: ${err.message}`);
                });
            }
            else {
                feed = await this.feedService.getOrCreateFeed(targetUrl);
            }
        }
        else {
            if (customYouTubeFeedMatch && !feed.rssUrl) {
                feed = await this.prisma.feed.update({
                    where: { id: feed.id },
                    data: { rssUrl: validUrl.href },
                });
                this.logger.log(`Updated feed ${feed.id} with custom YouTube RSS URL: ${validUrl.href}`);
            }
            else {
                this.logger.log(`Correlated subscription with existing feed: ${feed.id}`);
            }
        }
        if (folderId) {
            const folder = await this.prisma.folder.findFirst({
                where: {
                    id: folderId,
                    userId,
                },
            });
            if (!folder) {
                throw new common_1.BadRequestException('Folder not found');
            }
        }
        const subscription = await this.prisma.subscription.create({
            data: {
                userId,
                type: client_1.SubscriptionType.site,
                target: validUrl.href,
                feedId: feed.id,
                folderId: folderId,
            },
            include: {
                feed: true,
                folder: true,
            },
        });
        this.logger.log(`User ${userId} subscribed to site: ${validUrl.href}`);
        this.logger.log(`Feed details: id=${feed.id}, status=${feed.status}, rssUrl=${feed.rssUrl}`);
        const feedItemCount = await this.prisma.feedItem.count({ where: { feedId: feed.id } });
        this.logger.log(`Feed ${feed.id} currently has ${feedItemCount} items in database`);
        if (feedItemCount === 0 || feed.status === 'pending') {
            this.logger.log(`Feed ${feed.id} needs scraping (items: ${feedItemCount}, status: ${feed.status}), queuing now...`);
            this.feedService.queueFeedDiscovery(feed.id).catch((err) => {
                this.logger.error(`Failed to queue feed discovery for ${feed.id}: ${err.message}`);
            });
        }
        else {
            this.logger.log(`Feed ${feed.id} already has ${feedItemCount} items, skipping scrape`);
        }
        return subscription;
    }
    async createYouTubeSubscription(userId, dto) {
        const channel = await this.youtubeService.resolveChannel(dto.channelNameOrUrl);
        if (!channel) {
            throw new common_1.NotFoundException('YouTube channel not found');
        }
        const existingSubscription = await this.prisma.subscription.findFirst({
            where: {
                userId,
                type: client_1.SubscriptionType.youtube,
                target: channel.channelId,
            },
        });
        if (existingSubscription) {
            throw new common_1.BadRequestException('You are already subscribed to this channel');
        }
        const subscription = await this.prisma.subscription.create({
            data: {
                userId,
                type: client_1.SubscriptionType.youtube,
                target: channel.channelId,
                channelId: channel.id,
            },
            include: {
                channel: true,
            },
        });
        this.logger.log(`User ${userId} subscribed to YouTube channel: ${channel.title}`);
        return subscription;
    }
    async getUserSubscriptions(userId, page = 1, limit = 20, type) {
        const skip = (page - 1) * limit;
        const where = { userId };
        if (type) {
            where.type = type;
            if (type === 'site') {
                where.AND = [
                    {
                        NOT: {
                            target: { contains: '/custom-youtube-feeds/' },
                        },
                    },
                    {
                        OR: [
                            { feed: null },
                            { feed: { siteDomain: { not: 'www.youtube.com' } } },
                        ],
                    },
                ];
            }
        }
        const [subscriptions, total] = await Promise.all([
            this.prisma.subscription.findMany({
                where,
                include: {
                    feed: {
                        select: {
                            id: true,
                            title: true,
                            siteDomain: true,
                            faviconUrl: true,
                            status: true,
                        },
                    },
                    channel: {
                        select: {
                            id: true,
                            title: true,
                            thumbnailUrl: true,
                            channelId: true,
                        },
                    },
                    folder: {
                        select: {
                            id: true,
                            name: true,
                            color: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.subscription.count({ where }),
        ]);
        return {
            data: subscriptions,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async getSubscriptionById(userId, subscriptionId) {
        const subscription = await this.prisma.subscription.findFirst({
            where: {
                id: subscriptionId,
                userId,
            },
            include: {
                feed: true,
                channel: true,
            },
        });
        if (!subscription) {
            throw new common_1.NotFoundException('Subscription not found');
        }
        return subscription;
    }
    async deleteSubscription(userId, subscriptionId) {
        const subscription = await this.prisma.subscription.findFirst({
            where: {
                id: subscriptionId,
                userId,
            },
        });
        if (!subscription) {
            throw new common_1.NotFoundException('Subscription not found');
        }
        await this.prisma.subscription.delete({
            where: { id: subscriptionId },
        });
        this.logger.log(`User ${userId} unsubscribed from: ${subscription.target}`);
        return { message: 'Subscription deleted successfully' };
    }
    async toggleSubscription(userId, subscriptionId) {
        const subscription = await this.prisma.subscription.findFirst({
            where: {
                id: subscriptionId,
                userId,
            },
        });
        if (!subscription) {
            throw new common_1.NotFoundException('Subscription not found');
        }
        const updated = await this.prisma.subscription.update({
            where: { id: subscriptionId },
            data: { enabled: !subscription.enabled },
        });
        return updated;
    }
};
exports.SubscriptionService = SubscriptionService;
exports.SubscriptionService = SubscriptionService = SubscriptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)((0, common_1.forwardRef)(() => custom_youtube_feed_service_1.CustomYouTubeFeedService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        feed_service_1.FeedService,
        youtube_service_1.YouTubeService,
        folder_service_1.FolderService,
        custom_youtube_feed_service_1.CustomYouTubeFeedService])
], SubscriptionService);
//# sourceMappingURL=subscription.service.js.map