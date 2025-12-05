import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Simple health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'ok',
        uptime: 3600,
      },
    },
  })
  async simpleHealth() {
    return this.healthService.getSimpleHealth();
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with all services' })
  @ApiResponse({
    status: 200,
    description: 'Detailed health status',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2024-01-15T10:30:00.000Z',
        uptime: 3600,
        services: {
          database: { status: 'up', latency: 5 },
          redis: { status: 'up', latency: 2 },
          youtubeApi: { status: 'up', message: 'Quota: 1500/10000 (15.0%)' },
        },
      },
    },
  })
  async detailedHealth() {
    return this.healthService.getHealth();
  }
}



