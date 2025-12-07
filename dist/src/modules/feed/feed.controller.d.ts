import { FeedService } from './feed.service';
import { FeedItemService } from './feed-item.service';
export declare class FeedController {
    private readonly feedService;
    private readonly feedItemService;
    constructor(feedService: FeedService, feedItemService: FeedItemService);
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
    getFeed(id: string): Promise<{
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
    getFeedItems(id: string, page?: number, limit?: number): Promise<{
        feed: {
            id: string;
            title: string | null;
            siteDomain: string;
        };
        data: {
            thumbnailUrl: string | null;
            id: string;
            url: string;
            title: string;
            feedId: string;
            publishedAt: Date | null;
            fetchedAt: Date;
            author: string | null;
            canonicalUrl: string | null;
            excerpt: string | null;
            contentHash: string;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getFeedItem(itemId: string): Promise<({
        feed: {
            id: string;
            siteDomain: string;
            title: string | null;
        };
    } & {
        id: string;
        url: string;
        title: string;
        feedId: string;
        thumbnailUrl: string | null;
        publishedAt: Date | null;
        fetchedAt: Date;
        author: string | null;
        canonicalUrl: string | null;
        excerpt: string | null;
        contentHash: string;
    }) | null>;
}
