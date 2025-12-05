import { HealthService } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    simpleHealth(): Promise<{
        status: string;
        uptime: number;
    }>;
    detailedHealth(): Promise<import("./health.service").HealthStatus>;
}
