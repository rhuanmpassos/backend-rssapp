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
var HealthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const redis_service_1 = require("../../common/redis/redis.service");
const youtube_api_service_1 = require("../youtube/youtube-api.service");
let HealthService = HealthService_1 = class HealthService {
    constructor(prisma, redis, youtubeApi) {
        this.prisma = prisma;
        this.redis = redis;
        this.youtubeApi = youtubeApi;
        this.logger = new common_1.Logger(HealthService_1.name);
        this.startTime = Date.now();
    }
    async getHealth() {
        const [database, redis, youtubeApi] = await Promise.all([
            this.checkDatabase(),
            this.checkRedis(),
            this.checkYouTubeApi(),
        ]);
        const services = { database, redis, youtubeApi };
        const statuses = Object.values(services).map((s) => s.status);
        let overallStatus;
        if (statuses.every((s) => s === 'up')) {
            overallStatus = 'healthy';
        }
        else if (statuses.some((s) => s === 'down')) {
            overallStatus = 'unhealthy';
        }
        else {
            overallStatus = 'degraded';
        }
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            services,
        };
    }
    async checkDatabase() {
        const start = Date.now();
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return {
                status: 'up',
                latency: Date.now() - start,
            };
        }
        catch (error) {
            this.logger.error(`Database health check failed: ${error}`);
            return {
                status: 'down',
                message: 'Database connection failed',
            };
        }
    }
    async checkRedis() {
        const start = Date.now();
        try {
            const client = this.redis.getClient();
            if (!client) {
                return {
                    status: 'degraded',
                    message: 'Redis not configured',
                };
            }
            if (!this.redis.isConnected()) {
                return {
                    status: 'down',
                    message: 'Redis disconnected',
                };
            }
            await client.ping();
            return {
                status: 'up',
                latency: Date.now() - start,
            };
        }
        catch (error) {
            this.logger.error(`Redis health check failed: ${error}`);
            return {
                status: 'down',
                message: 'Redis connection failed',
            };
        }
    }
    async checkYouTubeApi() {
        try {
            const quota = await this.youtubeApi.getQuotaUsage();
            const usagePercent = (quota.used / quota.limit) * 100;
            if (usagePercent > 90) {
                return {
                    status: 'degraded',
                    message: `YouTube API quota at ${usagePercent.toFixed(1)}%`,
                };
            }
            return {
                status: 'up',
                message: `Quota: ${quota.used}/${quota.limit} (${usagePercent.toFixed(1)}%)`,
            };
        }
        catch (error) {
            this.logger.error(`YouTube API health check failed: ${error}`);
            return {
                status: 'degraded',
                message: 'Could not check YouTube API quota',
            };
        }
    }
    async getSimpleHealth() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return {
                status: 'ok',
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
            };
        }
        catch {
            return {
                status: 'error',
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
            };
        }
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = HealthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        youtube_api_service_1.YouTubeApiService])
], HealthService);
//# sourceMappingURL=health.service.js.map