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
var YouTubeCronService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../common/prisma/prisma.service");
const redis_service_1 = require("../common/redis/redis.service");
const youtube_service_1 = require("../modules/youtube/youtube.service");
const youtube_api_service_1 = require("../modules/youtube/youtube-api.service");
const push_service_1 = require("../modules/push/push.service");
let YouTubeCronService = YouTubeCronService_1 = class YouTubeCronService {
    constructor(prisma, redis, configService, youtubeService, youtubeApi, pushService) {
        this.prisma = prisma;
        this.redis = redis;
        this.configService = configService;
        this.youtubeService = youtubeService;
        this.youtubeApi = youtubeApi;
        this.pushService = pushService;
        this.logger = new common_1.Logger(YouTubeCronService_1.name);
        this.isRunning = false;
        this.intervalMinutes = this.configService.get('CRON_YOUTUBE_INTERVAL_MINUTES', 5);
    }
    async handleYouTubePolling() {
        if (this.isRunning) {
            this.logger.debug('YouTube polling job already running, skipping');
            return;
        }
        const quota = await this.youtubeApi.getQuotaUsage();
        if (quota.used > quota.limit * 0.9) {
            this.logger.warn('YouTube API quota near limit, skipping polling');
            return;
        }
        const hasLock = await this.redis.acquireLock('cron:youtube-polling', 300);
        if (!hasLock) {
            this.logger.debug('Another instance is running YouTube polling');
            return;
        }
        this.isRunning = true;
        try {
            this.logger.log('Starting scheduled YouTube polling');
            const channels = await this.youtubeService.getChannelsToCheck(5);
            this.logger.log(`Found ${channels.length} channels to check`);
            for (const channel of channels) {
                try {
                    if (channel.websubExpiresAt &&
                        channel.websubExpiresAt > new Date()) {
                        this.logger.debug(`Skipping ${channel.title} - WebSub active until ${channel.websubExpiresAt}`);
                        continue;
                    }
                    const result = await this.youtubeService.fetchAndSaveNewVideos(channel.id);
                    if (result.created > 0) {
                        this.logger.log(`Found ${result.created} new videos for ${channel.title}`);
                        const newVideos = await this.youtubeService.getNewVideosSince(channel.id, new Date(Date.now() - 10 * 60 * 1000));
                        for (const video of newVideos.slice(0, 3)) {
                            await this.pushService.notifyNewVideo(channel.id, channel.title, video.title, video.videoId);
                        }
                    }
                    await this.delay(2000);
                }
                catch (error) {
                    this.logger.error(`Error checking channel ${channel.title}: ${error}`);
                }
            }
            this.logger.log('Finished scheduled YouTube polling');
        }
        catch (error) {
            this.logger.error(`YouTube cron job error: ${error}`);
        }
        finally {
            this.isRunning = false;
            await this.redis.releaseLock('cron:youtube-polling');
        }
    }
    async handleQuotaReset() {
        try {
            this.logger.log('Daily quota check');
            const quota = await this.youtubeApi.getQuotaUsage();
            this.logger.log(`YouTube API quota: ${quota.used}/${quota.limit} (${((quota.used / quota.limit) * 100).toFixed(1)}%)`);
            if (quota.used > quota.limit * 0.8) {
                this.logger.warn(`High YouTube API quota usage yesterday: ${quota.used}/${quota.limit}`);
            }
        }
        catch (error) {
            this.logger.error(`Quota check error: ${error}`);
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.YouTubeCronService = YouTubeCronService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_5_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], YouTubeCronService.prototype, "handleYouTubePolling", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], YouTubeCronService.prototype, "handleQuotaReset", null);
exports.YouTubeCronService = YouTubeCronService = YouTubeCronService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        config_1.ConfigService,
        youtube_service_1.YouTubeService,
        youtube_api_service_1.YouTubeApiService,
        push_service_1.PushService])
], YouTubeCronService);
//# sourceMappingURL=youtube-cron.service.js.map