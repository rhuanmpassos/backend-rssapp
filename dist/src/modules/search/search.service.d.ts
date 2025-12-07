import { PrismaService } from '../../common/prisma/prisma.service';
interface SearchParams {
    userId: string;
    query: string;
    type: 'all' | 'feed' | 'video';
    author?: string;
    feedId?: string;
    channelId?: string;
    page: number;
    limit: number;
}
interface SearchBookmarksParams {
    userId: string;
    query: string;
    type: 'all' | 'feed' | 'video';
    page: number;
    limit: number;
}
export declare class SearchService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    search(params: SearchParams): Promise<{
        data: never[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            feedCount?: undefined;
            videoCount?: undefined;
        };
    } | {
        data: any[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            feedCount: number;
            videoCount: number;
        };
    }>;
    private searchFeedItems;
    private searchVideos;
    searchBookmarks(params: SearchBookmarksParams): Promise<{
        data: any[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    private sanitizeQuery;
}
export {};
