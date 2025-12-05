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
var FeedCronService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../common/prisma/prisma.service");
const redis_service_1 = require("../common/redis/redis.service");
const feed_service_1 = require("../modules/feed/feed.service");
const scraper_service_1 = require("../scraper/scraper.service");
let FeedCronService = FeedCronService_1 = class FeedCronService {
    constructor(prisma, redis, configService, feedService, scraperService) {
        this.prisma = prisma;
        this.redis = redis;
        this.configService = configService;
        this.feedService = feedService;
        this.scraperService = scraperService;
        this.logger = new common_1.Logger(FeedCronService_1.name);
        this.isRunning = false;
        this.intervalMinutes = this.configService.get('CRON_FEED_INTERVAL_MINUTES', 10);
    }
    async handleFeedScraping() {
        if (this.isRunning) {
            this.logger.debug('Feed scraping job already running, skipping');
            return;
        }
        const hasLock = await this.redis.acquireLock('cron:feed-scraping', 600);
        if (!hasLock) {
            this.logger.debug('Another instance is running feed scraping');
            return;
        }
        this.isRunning = true;
        try {
            this.logger.log('Starting scheduled feed scraping');
            const feeds = await this.feedService.getFeedsToScrape(10);
            this.logger.log(`Found ${feeds.length} feeds to scrape`);
            for (const feed of feeds) {
                try {
                    await this.scraperService.scrapeFeed(feed.id);
                    await this.delay(1000);
                }
                catch (error) {
                    this.logger.error(`Error scraping feed ${feed.id}: ${error}`);
                }
            }
            this.logger.log('Finished scheduled feed scraping');
        }
        catch (error) {
            this.logger.error(`Feed cron job error: ${error}`);
        }
        finally {
            this.isRunning = false;
            await this.redis.releaseLock('cron:feed-scraping');
        }
    }
    async handleFailedFeedsRetry() {
        try {
            this.logger.log('Retrying failed feeds');
            const failedFeeds = await this.prisma.feed.findMany({
                where: {
                    status: 'error',
                    lastScrapeAt: {
                        lt: new Date(Date.now() - 60 * 60 * 1000),
                    },
                },
                take: 5,
            });
            for (const feed of failedFeeds) {
                this.logger.debug(`Retrying failed feed: ${feed.url}`);
                await this.prisma.feed.update({
                    where: { id: feed.id },
                    data: { status: 'pending', errorMessage: null },
                });
                await this.scraperService.queueFeedDiscovery(feed.id);
            }
            this.logger.log(`Queued ${failedFeeds.length} failed feeds for retry`);
        }
        catch (error) {
            this.logger.error(`Failed feeds retry error: ${error}`);
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.FeedCronService = FeedCronService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_10_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FeedCronService.prototype, "handleFeedScraping", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FeedCronService.prototype, "handleFailedFeedsRetry", null);
exports.FeedCronService = FeedCronService = FeedCronService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        config_1.ConfigService,
        feed_service_1.FeedService,
        scraper_service_1.ScraperService])
], FeedCronService);
//# sourceMappingURL=feed-cron.service.js.map