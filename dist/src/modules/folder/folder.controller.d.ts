import { FolderService } from './folder.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { User } from '@prisma/client';
export declare class FolderController {
    private readonly folderService;
    constructor(folderService: FolderService);
    create(user: User, dto: CreateFolderDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        order: number;
        color: string | null;
    }>;
    findAll(user: User): Promise<({
        _count: {
            subscriptions: number;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        order: number;
        color: string | null;
    })[]>;
    findOne(user: User, id: string): Promise<{
        subscriptions: ({
            feed: {
                id: string;
                siteDomain: string;
                title: string | null;
                faviconUrl: string | null;
                status: import(".prisma/client").$Enums.FeedStatus;
            } | null;
            channel: {
                id: string;
                title: string;
                channelId: string;
                thumbnailUrl: string | null;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            type: import(".prisma/client").$Enums.SubscriptionType;
            target: string;
            enabled: boolean;
            folderId: string | null;
            feedId: string | null;
            channelId: string | null;
        })[];
        _count: {
            subscriptions: number;
        };
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        order: number;
        color: string | null;
    }>;
    update(user: User, id: string, dto: UpdateFolderDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        order: number;
        color: string | null;
    }>;
    delete(user: User, id: string): Promise<{
        message: string;
    }>;
    reorder(user: User, body: {
        folderIds: string[];
    }): Promise<{
        message: string;
    }>;
}
