import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { WebSubService } from '../modules/websub/websub.service';
export declare class WebSubCronService {
    private prisma;
    private redis;
    private websubService;
    private readonly logger;
    constructor(prisma: PrismaService, redis: RedisService, websubService: WebSubService);
    handleSubscriptionRenewal(): Promise<void>;
    handleNewSubscriptions(): Promise<void>;
    handleJobLogCleanup(): Promise<void>;
    private delay;
}
