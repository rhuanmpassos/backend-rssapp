import { PrismaService } from '../../common/prisma/prisma.service';
import { ScraperService } from '../../scraper/scraper.service';
import { FeedStatus } from '@prisma/client';
export declare class FeedService {
    private prisma;
    private scraperService;
    private readonly logger;
    constructor(prisma: PrismaService, scraperService: ScraperService);
    getOrCreateFeed(url: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        url: string;
        siteDomain: string;
        title: string | null;
        description: string | null;
        rssUrl: string | null;
        faviconUrl: string | null;
        lastScrapeAt: Date | null;
        status: import(".prisma/client").$Enums.FeedStatus;
        errorMessage: string | null;
    }>;
    getFeedById(feedId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        url: string;
        siteDomain: string;
        title: string | null;
        description: string | null;
        rssUrl: string | null;
        faviconUrl: string | null;
        lastScrapeAt: Date | null;
        status: import(".prisma/client").$Enums.FeedStatus;
        errorMessage: string | null;
    }>;
    listFeeds(page?: number, limit?: number): Promise<{
        data: ({
            _count: {
                items: number;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            url: string;
            siteDomain: string;
            title: string | null;
            description: string | null;
            rssUrl: string | null;
            faviconUrl: string | null;
            lastScrapeAt: Date | null;
            status: import(".prisma/client").$Enums.FeedStatus;
            errorMessage: string | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getFeedItems(feedId: string, page?: number, limit?: number): Promise<{
        feed: {
            id: string;
            title: string | null;
            siteDomain: string;
        };
        data: {
            id: string;
            url: string;
            title: string;
            feedId: string;
            thumbnailUrl: string | null;
            author: string | null;
            canonicalUrl: string | null;
            excerpt: string | null;
            publishedAt: Date | null;
            fetchedAt: Date;
            contentHash: string;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    updateFeed(feedId: string, data: {
        title?: string;
        rssUrl?: string;
        faviconUrl?: string;
        status?: FeedStatus;
        errorMessage?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        url: string;
        siteDomain: string;
        title: string | null;
        description: string | null;
        rssUrl: string | null;
        faviconUrl: string | null;
        lastScrapeAt: Date | null;
        status: import(".prisma/client").$Enums.FeedStatus;
        errorMessage: string | null;
    }>;
    markFeedError(feedId: string, error: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        url: string;
        siteDomain: string;
        title: string | null;
        description: string | null;
        rssUrl: string | null;
        faviconUrl: string | null;
        lastScrapeAt: Date | null;
        status: import(".prisma/client").$Enums.FeedStatus;
        errorMessage: string | null;
    }>;
    markFeedBlocked(feedId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        url: string;
        siteDomain: string;
        title: string | null;
        description: string | null;
        rssUrl: string | null;
        faviconUrl: string | null;
        lastScrapeAt: Date | null;
        status: import(".prisma/client").$Enums.FeedStatus;
        errorMessage: string | null;
    }>;
    getFeedsToScrape(limit?: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        url: string;
        siteDomain: string;
        title: string | null;
        description: string | null;
        rssUrl: string | null;
        faviconUrl: string | null;
        lastScrapeAt: Date | null;
        status: import(".prisma/client").$Enums.FeedStatus;
        errorMessage: string | null;
    }[]>;
    generateContentHash(content: string): string;
    normalizeUrl(url: string): string;
    queueFeedDiscovery(feedId: string): Promise<void>;
}
