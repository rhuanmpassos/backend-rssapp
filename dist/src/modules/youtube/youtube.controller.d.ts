import { YouTubeService } from './youtube.service';
import { YouTubeApiService } from './youtube-api.service';
import { User } from '@prisma/client';
export declare class YouTubeController {
    private readonly youtubeService;
    private readonly youtubeApiService;
    constructor(youtubeService: YouTubeService, youtubeApiService: YouTubeApiService);
    listChannels(user: User, page?: number, limit?: number): Promise<{
        data: (({
            _count: {
                videos: number;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string | null;
            channelId: string;
            thumbnailUrl: string | null;
            customUrl: string | null;
            lastCheckedAt: Date | null;
            websubTopicUrl: string | null;
            websubExpiresAt: Date | null;
            websubSecret: string | null;
        }) | {
            id: string;
            channelId: string;
            title: string;
            thumbnailUrl: null;
            lastCheckedAt: Date;
            isCustomFeed: boolean;
            subscriptionId: string;
            feedId: string | undefined;
            rssUrl: string | null | undefined;
            _count: {
                videos: number;
            };
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getChannel(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string | null;
        channelId: string;
        thumbnailUrl: string | null;
        customUrl: string | null;
        lastCheckedAt: Date | null;
        websubTopicUrl: string | null;
        websubExpiresAt: Date | null;
        websubSecret: string | null;
    } | {
        id: string;
        channelId: string;
        title: string;
        thumbnailUrl: null;
        description: null;
        customUrl: null;
        websubTopicUrl: null;
        lastCheckedAt: Date;
        isCustomFeed: boolean;
    }>;
    getChannelVideos(id: string, page?: number, limit?: number): Promise<{
        channel: {
            id: string;
            channelId: string;
            title: string;
            thumbnailUrl: null;
            isCustomFeed: boolean;
        };
        data: {
            id: string;
            videoId: string;
            title: string;
            description: string | null;
            thumbnailUrl: string;
            duration: number | null;
            publishedAt: Date | null;
            fetchedAt: Date;
            url: string;
            isLive: boolean;
            videoType: import("./youtube.service").VideoType;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    } | {
        channel: {
            id: string;
            channelId: string;
            title: string;
            thumbnailUrl: string | null;
            isCustomFeed?: undefined;
        };
        data: {
            isLive: boolean;
            videoType: import("./youtube.service").VideoType;
            duration: number | null;
            id: string;
            title: string;
            description: string | null;
            thumbnailUrl: string | null;
            publishedAt: Date;
            fetchedAt: Date;
            videoId: string;
            isLiveContent: boolean;
            channelDbId: string;
            durationSecs: number | null;
            classifiedAt: Date | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    getQuotaUsage(): Promise<{
        percentage: number;
        used: number;
        limit: number;
    }>;
}
