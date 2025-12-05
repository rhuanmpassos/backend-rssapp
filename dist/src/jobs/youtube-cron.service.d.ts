import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { YouTubeService } from '../modules/youtube/youtube.service';
import { YouTubeApiService } from '../modules/youtube/youtube-api.service';
import { PushService } from '../modules/push/push.service';
export declare class YouTubeCronService {
    private prisma;
    private redis;
    private configService;
    private youtubeService;
    private youtubeApi;
    private pushService;
    private readonly logger;
    private readonly intervalMinutes;
    private isRunning;
    constructor(prisma: PrismaService, redis: RedisService, configService: ConfigService, youtubeService: YouTubeService, youtubeApi: YouTubeApiService, pushService: PushService);
    handleYouTubePolling(): Promise<void>;
    handleQuotaReset(): Promise<void>;
    private delay;
}
