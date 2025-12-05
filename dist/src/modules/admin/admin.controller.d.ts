import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    forceScrape(id: string): Promise<{
        message: string;
        jobId: string;
        feedId: string;
        feedUrl: string;
    }>;
    forceCheckYouTube(id: string): Promise<{
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
    resetFeedStatus(id: string): Promise<{
        message: string;
        feedId: string;
    }>;
}
