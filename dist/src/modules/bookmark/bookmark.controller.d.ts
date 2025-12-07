import { BookmarkService } from './bookmark.service';
import { CreateBookmarkDto, SyncBookmarksDto } from './dto/bookmark.dto';
import { CreateReadItemDto, SyncReadItemsDto } from './dto/read-item.dto';
export declare class BookmarkController {
    private readonly bookmarkService;
    constructor(bookmarkService: BookmarkService);
    getBookmarks(req: any, page?: string, limit?: string): Promise<{
        data: {
            id: string;
            url: string;
            title: string;
            userId: string;
            thumbnailUrl: string | null;
            source: string;
            excerpt: string | null;
            publishedAt: Date | null;
            itemId: string;
            itemType: string;
            savedAt: Date;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    addBookmark(req: any, dto: CreateBookmarkDto): Promise<{
        id: string;
        url: string;
        title: string;
        userId: string;
        thumbnailUrl: string | null;
        source: string;
        excerpt: string | null;
        publishedAt: Date | null;
        itemId: string;
        itemType: string;
        savedAt: Date;
    }>;
    removeBookmark(req: any, id: string): Promise<{
        success: boolean;
        deleted: number;
    }>;
    syncBookmarks(req: any, dto: SyncBookmarksDto): Promise<{
        added: number;
        toSync: {
            id: string;
            url: string;
            title: string;
            userId: string;
            thumbnailUrl: string | null;
            source: string;
            excerpt: string | null;
            publishedAt: Date | null;
            itemId: string;
            itemType: string;
            savedAt: Date;
        }[];
        syncedAt: string;
    }>;
    getReadItems(req: any, page?: string, limit?: string): Promise<{
        data: {
            id: string;
            itemId: string;
            itemType: string;
            readAt: Date;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    markAsRead(req: any, dto: CreateReadItemDto): Promise<{
        id: string;
        userId: string;
        itemId: string;
        itemType: string;
        readAt: Date;
    }>;
    markAsUnread(req: any, id: string): Promise<{
        success: boolean;
        deleted: number;
    }>;
    syncReadItems(req: any, dto: SyncReadItemsDto): Promise<{
        added: number;
        toSync: {
            itemType: string;
            itemId: string;
            readAt: Date;
        }[];
        syncedAt: string;
    }>;
}
