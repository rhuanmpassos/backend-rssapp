import { ConfigService } from '@nestjs/config';
export declare class RobotsService {
    private configService;
    private readonly logger;
    private readonly cache;
    private readonly userAgent;
    private readonly cacheTTL;
    constructor(configService: ConfigService);
    isAllowed(url: string): Promise<boolean>;
    getCrawlDelay(url: string): Promise<number>;
    getSitemaps(url: string): Promise<string[]>;
    private getRobots;
    clearCache(): void;
}
