import { OnModuleInit } from '@nestjs/common';
export declare class YoutubeiService implements OnModuleInit {
    private readonly logger;
    private youtube;
    onModuleInit(): Promise<void>;
    getActiveLiveVideoId(channelId: string): Promise<string | null>;
    getLiveVideoInfo(videoId: string): Promise<{
        title: string;
        description: string;
        thumbnail: string;
    } | null>;
    getVideoType(videoId: string): Promise<'video' | 'short' | 'vod' | 'live' | null>;
    getVideoBasicInfo(videoId: string): Promise<{
        isLive: boolean;
        isLiveContent: boolean;
        duration: number;
        title: string;
    } | null>;
}
