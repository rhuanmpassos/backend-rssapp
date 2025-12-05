import { SubscriptionService } from './subscription.service';
import { User } from '@prisma/client';
import { CreateSiteSubscriptionDto } from './dto/create-site-subscription.dto';
import { CreateYouTubeSubscriptionDto } from './dto/create-youtube-subscription.dto';
export declare class SubscriptionController {
    private readonly subscriptionService;
    constructor(subscriptionService: SubscriptionService);
    subscribeSite(user: User, dto: CreateSiteSubscriptionDto): Promise<({
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
    subscribeYouTube(user: User, dto: CreateYouTubeSubscriptionDto): Promise<{
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
    listSubscriptions(user: User, page?: number, limit?: number, type?: 'site' | 'youtube'): Promise<{
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
    getSubscription(user: User, id: string): Promise<{
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
    toggleSubscription(user: User, id: string): Promise<{
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
    deleteSubscription(user: User, id: string): Promise<{
        message: string;
    }>;
}
