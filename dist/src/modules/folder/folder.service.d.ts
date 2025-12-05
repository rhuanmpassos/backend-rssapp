import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
export declare class FolderService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateFolderDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        order: number;
        color: string | null;
    }>;
    findAll(userId: string): Promise<({
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
    findOne(userId: string, folderId: string): Promise<{
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
    update(userId: string, folderId: string, dto: UpdateFolderDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        order: number;
        color: string | null;
    }>;
    delete(userId: string, folderId: string): Promise<{
        message: string;
    }>;
    reorder(userId: string, folderIds: string[]): Promise<{
        message: string;
    }>;
    findOrCreateFolder(userId: string, name: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        order: number;
        color: string | null;
    }>;
}
