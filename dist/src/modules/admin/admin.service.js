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
var AdminService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const feed_service_1 = require("../feed/feed.service");
const youtube_service_1 = require("../youtube/youtube.service");
const scraper_service_1 = require("../../scraper/scraper.service");
const client_1 = require("@prisma/client");
let AdminService = AdminService_1 = class AdminService {
    constructor(prisma, feedService, youtubeService, scraperService) {
        this.prisma = prisma;
        this.feedService = feedService;
        this.youtubeService = youtubeService;
        this.scraperService = scraperService;
        this.logger = new common_1.Logger(AdminService_1.name);
    }
    async forceScrape(feedId) {
        const feed = await this.feedService.getFeedById(feedId);
        if (!feed) {
            throw new common_1.NotFoundException('Feed not found');
        }
        this.logger.log(`Force scraping feed: ${feed.url}`);
        const job = await this.prisma.jobLog.create({
            data: {
                jobType: client_1.JobType.scrape_feed,
                target: feedId,
                status: client_1.JobStatus.pending,
            },
        });
        await this.scraperService.queueFeedScrape(feedId);
        return {
            message: 'Scrape job queued',
            jobId: job.id,
            feedId: feed.id,
            feedUrl: feed.url,
        };
    }
    async forceCheckYouTube(channelId) {
        const channel = await this.youtubeService.getChannelById(channelId);
        if (!channel) {
            throw new common_1.NotFoundException('Channel not found');
        }
        this.logger.log(`Force checking YouTube channel: ${channel.title}`);
        const job = await this.prisma.jobLog.create({
            data: {
                jobType: client_1.JobType.check_youtube,
                target: channelId,
                status: client_1.JobStatus.running,
                startedAt: new Date(),
            },
        });
        try {
            const result = await this.youtubeService.fetchAndSaveNewVideos(channelId);
            await this.prisma.jobLog.update({
                where: { id: job.id },
                data: {
                    status: client_1.JobStatus.completed,
                    completedAt: new Date(),
                    result: result,
                },
            });
            return {
                message: 'YouTube channel checked',
                jobId: job.id,
                channelId: channel.id,
                channelTitle: channel.title,
                ...result,
            };
        }
        catch (error) {
            await this.prisma.jobLog.update({
                where: { id: job.id },
                data: {
                    status: client_1.JobStatus.failed,
                    completedAt: new Date(),
                    lastError: String(error),
                },
            });
            throw error;
        }
    }
    async getStats() {
        const [usersCount, subscriptionsCount, feedsCount, feedItemsCount, channelsCount, videosCount, activeFeeds, errorFeeds, pendingJobs,] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.subscription.count(),
            this.prisma.feed.count(),
            this.prisma.feedItem.count(),
            this.prisma.youTubeChannel.count(),
            this.prisma.youTubeVideo.count(),
            this.prisma.feed.count({ where: { status: client_1.FeedStatus.active } }),
            this.prisma.feed.count({ where: { status: client_1.FeedStatus.error } }),
            this.prisma.jobLog.count({ where: { status: client_1.JobStatus.pending } }),
        ]);
        return {
            users: usersCount,
            subscriptions: subscriptionsCount,
            feeds: {
                total: feedsCount,
                active: activeFeeds,
                error: errorFeeds,
                items: feedItemsCount,
            },
            youtube: {
                channels: channelsCount,
                videos: videosCount,
            },
            jobs: {
                pending: pendingJobs,
            },
        };
    }
    async getRecentJobs(limit = 50) {
        return this.prisma.jobLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
    async getErrorFeeds() {
        return this.prisma.feed.findMany({
            where: {
                status: { in: [client_1.FeedStatus.error, client_1.FeedStatus.blocked] },
            },
            orderBy: { lastScrapeAt: 'desc' },
        });
    }
    async resetFeedStatus(feedId) {
        const feed = await this.feedService.getFeedById(feedId);
        if (!feed) {
            throw new common_1.NotFoundException('Feed not found');
        }
        await this.prisma.feed.update({
            where: { id: feedId },
            data: {
                status: client_1.FeedStatus.pending,
                errorMessage: null,
            },
        });
        return { message: 'Feed status reset', feedId };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = AdminService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        feed_service_1.FeedService,
        youtube_service_1.YouTubeService,
        scraper_service_1.ScraperService])
], AdminService);
//# sourceMappingURL=admin.service.js.map