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
var WebSubCronService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSubCronService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../common/prisma/prisma.service");
const redis_service_1 = require("../common/redis/redis.service");
const websub_service_1 = require("../modules/websub/websub.service");
let WebSubCronService = WebSubCronService_1 = class WebSubCronService {
    constructor(prisma, redis, websubService) {
        this.prisma = prisma;
        this.redis = redis;
        this.websubService = websubService;
        this.logger = new common_1.Logger(WebSubCronService_1.name);
    }
    async handleSubscriptionRenewal() {
        const hasLock = await this.redis.acquireLock('cron:websub-renewal', 300);
        if (!hasLock) {
            this.logger.debug('Another instance is renewing WebSub subscriptions');
            return;
        }
        try {
            this.logger.log('Starting WebSub subscription renewal check');
            const result = await this.websubService.renewExpiringSubscriptions();
            this.logger.log(`WebSub renewal: ${result.renewed}/${result.total} subscriptions renewed`);
        }
        catch (error) {
            this.logger.error(`WebSub renewal error: ${error}`);
        }
        finally {
            await this.redis.releaseLock('cron:websub-renewal');
        }
    }
    async handleNewSubscriptions() {
        try {
            this.logger.log('Checking for channels without WebSub subscription');
            const channels = await this.prisma.youTubeChannel.findMany({
                where: {
                    OR: [
                        { websubExpiresAt: null },
                        { websubExpiresAt: { lt: new Date() } },
                    ],
                },
                take: 20,
            });
            this.logger.log(`Found ${channels.length} channels to subscribe via WebSub`);
            let subscribed = 0;
            for (const channel of channels) {
                try {
                    const result = await this.websubService.subscribeToChannel(channel.channelId);
                    if (result.success) {
                        subscribed++;
                    }
                    await this.delay(1000);
                }
                catch (error) {
                    this.logger.error(`Failed to subscribe channel ${channel.channelId}: ${error}`);
                }
            }
            this.logger.log(`WebSub: subscribed ${subscribed}/${channels.length} channels`);
        }
        catch (error) {
            this.logger.error(`WebSub new subscriptions error: ${error}`);
        }
    }
    async handleJobLogCleanup() {
        try {
            this.logger.log('Cleaning up old job logs');
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const result = await this.prisma.jobLog.deleteMany({
                where: {
                    createdAt: { lt: oneWeekAgo },
                    status: { in: ['completed', 'cancelled'] },
                },
            });
            this.logger.log(`Deleted ${result.count} old job logs`);
        }
        catch (error) {
            this.logger.error(`Job log cleanup error: ${error}`);
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.WebSubCronService = WebSubCronService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WebSubCronService.prototype, "handleSubscriptionRenewal", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_1AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WebSubCronService.prototype, "handleNewSubscriptions", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_WEEK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WebSubCronService.prototype, "handleJobLogCleanup", null);
exports.WebSubCronService = WebSubCronService = WebSubCronService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        websub_service_1.WebSubService])
], WebSubCronService);
//# sourceMappingURL=websub-cron.service.js.map