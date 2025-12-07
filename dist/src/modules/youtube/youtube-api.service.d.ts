import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
export interface YouTubeChannelInfo {
    channelId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    customUrl?: string;
}
export interface YouTubeVideoInfo {
    videoId: string;
    channelId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    publishedAt: Date;
    duration?: string;
    isLive?: boolean;
    liveBroadcastContent?: 'none' | 'upcoming' | 'live';
}
export declare class YouTubeApiService {
    private configService;
    private prisma;
    private readonly logger;
    private readonly apiKey;
    private readonly baseUrl;
    constructor(configService: ConfigService, prisma: PrismaService);
    searchChannel(query: string): Promise<YouTubeChannelInfo | null>;
    getChannelById(channelId: string): Promise<YouTubeChannelInfo | null>;
    scrapeChannelInfo(handle: string): Promise<YouTubeChannelInfo | null>;
    private extractChannelId;
    getChannelByHandle(handle: string): Promise<YouTubeChannelInfo | null>;
    getRecentVideos(channelId: string, publishedAfter?: Date, maxResults?: number): Promise<YouTubeVideoInfo[]>;
    getVideoDetails(videoIds: string[]): Promise<YouTubeVideoInfo[]>;
    private truncateDescription;
    private trackApiCall;
    getQuotaUsage(): Promise<{
        used: number;
        limit: number;
    }>;
}
