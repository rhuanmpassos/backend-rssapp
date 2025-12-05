import { PushService } from './push.service';
import { User } from '@prisma/client';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
export declare class PushController {
    private readonly pushService;
    constructor(pushService: PushService);
    registerToken(user: User, dto: RegisterPushTokenDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        token: string;
        platform: import(".prisma/client").$Enums.Platform;
        isActive: boolean;
    }>;
    unregisterToken(user: User, dto: RegisterPushTokenDto): Promise<{
        success: boolean;
        message: string;
    } | {
        success: boolean;
        message?: undefined;
    }>;
}
