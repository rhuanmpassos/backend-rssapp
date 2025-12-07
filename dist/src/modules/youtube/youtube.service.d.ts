import { PrismaService } from '../../common/prisma/prisma.service';
import { YouTubeApiService, YouTubeChannelInfo, YouTubeVideoInfo } from './youtube-api.service';
export declare class YouTubeService {
    private prisma;
    private youtubeApi;
    private readonly logger;
    constructor(prisma: PrismaService, youtubeApi: YouTubeApiService);
    resolveChannel(input: string): Promise<any>;
    getOrCreateChannel(info: YouTubeChannelInfo): Promise<{
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
    }>;
    getChannelById(id: string): Promise<{
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
    getChannelByYouTubeId(channelId: string): Promise<{
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
    } | null>;
    listChannels(userId: string, page?: number, limit?: number): Promise<{
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
    getChannelVideos(channelDbId: string, page?: number, limit?: number): Promise<{
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
            duration: null;
            publishedAt: Date | null;
            fetchedAt: Date;
            url: string;
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
            id: string;
            title: string;
            description: string | null;
            thumbnailUrl: string | null;
            publishedAt: Date;
            fetchedAt: Date;
            videoId: string;
            channelDbId: string;
            duration: string | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    saveVideos(channelDbId: string, videos: YouTubeVideoInfo[]): Promise<{
        created: number;
        skipped: number;
    }>;
    fetchAndSaveNewVideos(channelDbId: string): Promise<{
        created: number;
        skipped: number;
    }>;
    getChannelsToCheck(limit?: number): Promise<{
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
    }[]>;
    getNewVideosSince(channelDbId: string, since: Date): Promise<{
        id: string;
        title: string;
        description: string | null;
        thumbnailUrl: string | null;
        publishedAt: Date;
        fetchedAt: Date;
        videoId: string;
        channelDbId: string;
        duration: string | null;
    }[]>;
}
