import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { YouTubeApiService } from '../youtube/youtube-api.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    youtubeApi: ServiceStatus;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private youtubeApi: YouTubeApiService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const [database, redis, youtubeApi] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkYouTubeApi(),
    ]);

    const services = { database, redis, youtubeApi };

    // Determine overall status
    const statuses = Object.values(services).map((s) => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (statuses.every((s) => s === 'up')) {
      overallStatus = 'healthy';
    } else if (statuses.some((s) => s === 'down')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services,
    };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.error(`Database health check failed: ${error}`);
      return {
        status: 'down',
        message: 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const client = this.redis.getClient();
      
      if (!client) {
        return {
          status: 'degraded',
          message: 'Redis not configured',
        };
      }

      if (!this.redis.isConnected()) {
        return {
          status: 'down',
          message: 'Redis disconnected',
        };
      }

      await client.ping();
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error}`);
      return {
        status: 'down',
        message: 'Redis connection failed',
      };
    }
  }

  private async checkYouTubeApi(): Promise<ServiceStatus> {
    try {
      const quota = await this.youtubeApi.getQuotaUsage();
      const usagePercent = (quota.used / quota.limit) * 100;

      if (usagePercent > 90) {
        return {
          status: 'degraded',
          message: `YouTube API quota at ${usagePercent.toFixed(1)}%`,
        };
      }

      return {
        status: 'up',
        message: `Quota: ${quota.used}/${quota.limit} (${usagePercent.toFixed(1)}%)`,
      };
    } catch (error) {
      this.logger.error(`YouTube API health check failed: ${error}`);
      return {
        status: 'degraded',
        message: 'Could not check YouTube API quota',
      };
    }
  }

  async getSimpleHealth(): Promise<{ status: string; uptime: number }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      };
    } catch {
      return {
        status: 'error',
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      };
    }
  }
}



