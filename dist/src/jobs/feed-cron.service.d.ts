import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FeedService } from '../modules/feed/feed.service';
import { ScraperService } from '../scraper/scraper.service';
export declare class FeedCronService {
    private prisma;
    private redis;
    private configService;
    private feedService;
    private scraperService;
    private readonly logger;
    private readonly intervalMinutes;
    private isRunning;
    constructor(prisma: PrismaService, redis: RedisService, configService: ConfigService, feedService: FeedService, scraperService: ScraperService);
    handleFeedScraping(): Promise<void>;
    handleFailedFeedsRetry(): Promise<void>;
    private delay;
}
