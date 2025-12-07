export declare class CreateBookmarkDto {
    itemType: 'feed' | 'video';
    itemId: string;
    title: string;
    excerpt?: string;
    thumbnailUrl?: string;
    url: string;
    source: string;
    publishedAt?: string;
    savedAt?: string;
}
export declare class SyncBookmarksDto {
    bookmarks: CreateBookmarkDto[];
    lastSyncAt?: string;
}
