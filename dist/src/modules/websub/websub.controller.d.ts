import { Request, Response } from 'express';
import { WebSubService } from './websub.service';
export declare class WebSubController {
    private readonly websubService;
    private readonly logger;
    constructor(websubService: WebSubService);
    verifyCallback(topic: string, challenge: string, mode: string, leaseSeconds: string, verifyToken: string, res: Response): Promise<void>;
    receiveNotification(req: Request, signature: string, body: any): Promise<{
        success: boolean;
        videosProcessed: number;
    }>;
    manualSubscribe(channelId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    renewSubscriptions(): Promise<{
        renewed: number;
        total: number;
    }>;
}
