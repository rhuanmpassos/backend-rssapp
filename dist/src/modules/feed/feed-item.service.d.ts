import { PrismaService } from '../../common/prisma/prisma.service';
import { FeedService } from './feed.service';
export interface CreateFeedItemData {
    feedId: string;
    url: string;
    canonicalUrl?: string;
    title: string;
    excerpt?: string;
    thumbnailUrl?: string;
    author?: string;
    publishedAt?: Date;
}
export declare class FeedItemService {
    private prisma;
    private feedService;
    private readonly logger;
    constructor(prisma: PrismaService, feedService: FeedService);
    createOrUpdate(data: CreateFeedItemData): Promise<{
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
    } | null>;
    bulkCreate(feedId: string, items: Omit<CreateFeedItemData, 'feedId'>[]): Promise<{
        created: number;
        updated: number;
        skipped: number;
    }>;
    getRecentItems(feedId: string, limit?: number): Promise<{
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
    }[]>;
    getItemById(itemId: string): Promise<({
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
    getNewItemsSince(feedId: string, since: Date): Promise<{
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
    }[]>;
    private generateContentHash;
    private truncateExcerpt;
}
