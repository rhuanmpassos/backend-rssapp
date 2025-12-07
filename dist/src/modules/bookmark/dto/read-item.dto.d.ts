export declare class CreateReadItemDto {
    itemType: 'feed' | 'video';
    itemId: string;
    readAt?: string;
}
export declare class SyncReadItemsDto {
    readItems: CreateReadItemDto[];
    lastSyncAt?: string;
}
