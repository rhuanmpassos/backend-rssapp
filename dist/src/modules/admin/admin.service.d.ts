import { PrismaService } from '../../common/prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { YouTubeService } from '../youtube/youtube.service';
import { ScraperService } from '../../scraper/scraper.service';
export declare class AdminService {
    private prisma;
    private feedService;
    private youtubeService;
    private scraperService;
    private readonly logger;
    constructor(prisma: PrismaService, feedService: FeedService, youtubeService: YouTubeService, scraperService: ScraperService);
    forceScrape(feedId: string): Promise<{
        message: string;
        jobId: string;
        feedId: string;
        feedUrl: string;
    }>;
    forceCheckYouTube(channelId: string): Promise<{
        created: number;
        skipped: number;
        message: string;
        jobId: string;
        channelId: string;
        channelTitle: string;
    }>;
    getStats(): Promise<{
        users: number;
        subscriptions: number;
        feeds: {
            total: number;
            active: number;
            error: number;
            items: number;
        };
        youtube: {
            channels: number;
            videos: number;
        };
        jobs: {
            pending: number;
        };
    }>;
    getRecentJobs(limit?: number): Promise<{
        id: string;
        createdAt: Date;
        result: import("@prisma/client/runtime/library").JsonValue | null;
        target: string;
        status: import(".prisma/client").$Enums.JobStatus;
        jobType: import(".prisma/client").$Enums.JobType;
        attempts: number;
        maxRetries: number;
        lastError: string | null;
        startedAt: Date | null;
        completedAt: Date | null;
    }[]>;
    getErrorFeeds(): Promise<{
        id: string;
        title: string | null;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        url: string;
        siteDomain: string;
        rssUrl: string | null;
        faviconUrl: string | null;
        lastScrapeAt: Date | null;
        status: import(".prisma/client").$Enums.FeedStatus;
        errorMessage: string | null;
    }[]>;
    resetFeedStatus(feedId: string): Promise<{
        message: string;
        feedId: string;
    }>;
}
