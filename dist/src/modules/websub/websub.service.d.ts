import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { YouTubeService } from '../youtube/youtube.service';
import { PushService } from '../push/push.service';
export declare class WebSubService {
    private prisma;
    private configService;
    private youtubeService;
    private pushService;
    private readonly logger;
    private readonly callbackUrl;
    private readonly verifyToken;
    constructor(prisma: PrismaService, configService: ConfigService, youtubeService: YouTubeService, pushService: PushService);
    subscribeToChannel(channelId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    unsubscribeFromChannel(channelId: string): Promise<{
        success: boolean;
    }>;
    verifyIntent(topic: string, challenge: string, mode: string, leaseSeconds?: number, verifyToken?: string): Promise<string | null>;
    handleNotification(body: string, signature?: string): Promise<{
        success: boolean;
        videosProcessed: number;
    }>;
    renewExpiringSubscriptions(): Promise<{
        renewed: number;
        total: number;
    }>;
}
