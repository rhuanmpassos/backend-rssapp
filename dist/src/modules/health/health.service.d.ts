import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { YouTubeApiService } from '../youtube/youtube-api.service';
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    services: {
        database: ServiceStatus;
        redis: ServiceStatus;
        youtubeApi: ServiceStatus;
    };
}
export interface ServiceStatus {
    status: 'up' | 'down' | 'degraded';
    latency?: number;
    message?: string;
}
export declare class HealthService {
    private prisma;
    private redis;
    private youtubeApi;
    private readonly logger;
    private readonly startTime;
    constructor(prisma: PrismaService, redis: RedisService, youtubeApi: YouTubeApiService);
    getHealth(): Promise<HealthStatus>;
    private checkDatabase;
    private checkRedis;
    private checkYouTubeApi;
    getSimpleHealth(): Promise<{
        status: string;
        uptime: number;
    }>;
}
