import { PrismaService } from '../../common/prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { YouTubeService } from '../youtube/youtube.service';
import { FolderService } from '../folder/folder.service';
import { CustomYouTubeFeedService } from '../custom-youtube-feed/custom-youtube-feed.service';
import { CreateSiteSubscriptionDto } from './dto/create-site-subscription.dto';
import { CreateYouTubeSubscriptionDto } from './dto/create-youtube-subscription.dto';
export declare class SubscriptionService {
    private prisma;
    private feedService;
    private youtubeService;
    private folderService;
    private customYouTubeFeedService;
    private readonly logger;
    constructor(prisma: PrismaService, feedService: FeedService, youtubeService: YouTubeService, folderService: FolderService, customYouTubeFeedService: CustomYouTubeFeedService);
    createSiteSubscription(userId: string, dto: CreateSiteSubscriptionDto): Promise<({
        folder: {
            id: string;
            userId: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            color: string | null;
            order: number;
        } | null;
        feed: {
            id: string;
            createdAt: Date;
            url: string;
            siteDomain: string;
            title: string | null;
            description: string | null;
            rssUrl: string | null;
            faviconUrl: string | null;
            lastScrapeAt: Date | null;
            status: import(".prisma/client").$Enums.FeedStatus;
            errorMessage: string | null;
            updatedAt: Date;
        } | null;
    } & {
        id: string;
        userId: string;
        type: import(".prisma/client").$Enums.SubscriptionType;
        target: string;
        createdAt: Date;
        enabled: boolean;
        folderId: string | null;
        feedId: string | null;
        channelId: string | null;
    }) | null>;
    createYouTubeSubscription(userId: string, dto: CreateYouTubeSubscriptionDto): Promise<{
        channel: {
            id: string;
            createdAt: Date;
            channelId: string;
            title: string;
            description: string | null;
            updatedAt: Date;
            thumbnailUrl: string | null;
            customUrl: string | null;
            lastCheckedAt: Date | null;
            websubTopicUrl: string | null;
            websubExpiresAt: Date | null;
            websubSecret: string | null;
        } | null;
    } & {
        id: string;
        userId: string;
        type: import(".prisma/client").$Enums.SubscriptionType;
        target: string;
        createdAt: Date;
        enabled: boolean;
        folderId: string | null;
        feedId: string | null;
        channelId: string | null;
    }>;
    getUserSubscriptions(userId: string, page?: number, limit?: number, type?: 'site' | 'youtube'): Promise<{
        data: ({
            folder: {
                id: string;
                name: string;
                color: string | null;
            } | null;
            feed: {
                id: string;
                siteDomain: string;
                title: string | null;
                faviconUrl: string | null;
                status: import(".prisma/client").$Enums.FeedStatus;
            } | null;
            channel: {
                id: string;
                channelId: string;
                title: string;
                thumbnailUrl: string | null;
            } | null;
        } & {
            id: string;
            userId: string;
            type: import(".prisma/client").$Enums.SubscriptionType;
            target: string;
            createdAt: Date;
            enabled: boolean;
            folderId: string | null;
            feedId: string | null;
            channelId: string | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getSubscriptionById(userId: string, subscriptionId: string): Promise<{
        feed: {
            id: string;
            createdAt: Date;
            url: string;
            siteDomain: string;
            title: string | null;
            description: string | null;
            rssUrl: string | null;
            faviconUrl: string | null;
            lastScrapeAt: Date | null;
            status: import(".prisma/client").$Enums.FeedStatus;
            errorMessage: string | null;
            updatedAt: Date;
        } | null;
        channel: {
            id: string;
            createdAt: Date;
            channelId: string;
            title: string;
            description: string | null;
            updatedAt: Date;
            thumbnailUrl: string | null;
            customUrl: string | null;
            lastCheckedAt: Date | null;
            websubTopicUrl: string | null;
            websubExpiresAt: Date | null;
            websubSecret: string | null;
        } | null;
    } & {
        id: string;
        userId: string;
        type: import(".prisma/client").$Enums.SubscriptionType;
        target: string;
        createdAt: Date;
        enabled: boolean;
        folderId: string | null;
        feedId: string | null;
        channelId: string | null;
    }>;
    deleteSubscription(userId: string, subscriptionId: string): Promise<{
        message: string;
    }>;
    toggleSubscription(userId: string, subscriptionId: string): Promise<{
        id: string;
        userId: string;
        type: import(".prisma/client").$Enums.SubscriptionType;
        target: string;
        createdAt: Date;
        enabled: boolean;
        folderId: string | null;
        feedId: string | null;
        channelId: string | null;
    }>;
}
