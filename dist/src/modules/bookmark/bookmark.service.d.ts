import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookmarkDto, SyncBookmarksDto } from './dto/bookmark.dto';
import { CreateReadItemDto, SyncReadItemsDto } from './dto/read-item.dto';
export declare class BookmarkService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getBookmarks(userId: string, page?: number, limit?: number): Promise<{
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
    addBookmark(userId: string, dto: CreateBookmarkDto): Promise<{
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
    removeBookmark(userId: string, idOrItemId: string): Promise<{
        success: boolean;
        deleted: number;
    }>;
    syncBookmarks(userId: string, dto: SyncBookmarksDto): Promise<{
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
    getReadItems(userId: string, page?: number, limit?: number): Promise<{
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
    markAsRead(userId: string, dto: CreateReadItemDto): Promise<{
        id: string;
        userId: string;
        itemId: string;
        itemType: string;
        readAt: Date;
    }>;
    markAsUnread(userId: string, idOrItemId: string): Promise<{
        success: boolean;
        deleted: number;
    }>;
    syncReadItems(userId: string, dto: SyncReadItemsDto): Promise<{
        added: number;
        toSync: {
            itemType: string;
            itemId: string;
            readAt: Date;
        }[];
        syncedAt: string;
    }>;
}
