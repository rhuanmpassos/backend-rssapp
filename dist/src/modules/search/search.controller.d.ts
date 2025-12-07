import { SearchService } from './search.service';
export declare class SearchController {
    private readonly searchService;
    constructor(searchService: SearchService);
    search(req: any, query: string, type?: string, author?: string, feedId?: string, channelId?: string, page?: string, limit?: string): Promise<{
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
    searchBookmarks(req: any, query: string, type?: string, page?: string, limit?: string): Promise<{
        data: any[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
