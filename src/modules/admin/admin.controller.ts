import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('feed/:id/force-scrape')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force scrape a specific feed' })
  @ApiResponse({
    status: 200,
    description: 'Scrape job queued',
    schema: {
      example: {
        message: 'Scrape job queued',
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        feedId: '550e8400-e29b-41d4-a716-446655440001',
        feedUrl: 'https://example.com',
      },
    },
  })
  async forceScrape(@Param('id') id: string) {
    return this.adminService.forceScrape(id);
  }

  @Post('youtube/:id/force-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force check a YouTube channel for new videos' })
  @ApiResponse({
    status: 200,
    description: 'Channel checked',
    schema: {
      example: {
        message: 'YouTube channel checked',
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        channelId: '550e8400-e29b-41d4-a716-446655440001',
        channelTitle: 'Google Developers',
        created: 3,
        skipped: 0,
      },
    },
  })
  async forceCheckYouTube(@Param('id') id: string) {
    return this.adminService.forceCheckYouTube(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({
    status: 200,
    description: 'System stats',
    schema: {
      example: {
        users: 150,
        subscriptions: 1200,
        feeds: {
          total: 300,
          active: 280,
          error: 20,
          items: 15000,
        },
        youtube: {
          channels: 100,
          videos: 5000,
        },
        jobs: {
          pending: 5,
        },
      },
    },
  })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get recent job logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentJobs(@Query('limit') limit?: number) {
    return this.adminService.getRecentJobs(limit || 50);
  }

  @Get('feeds/errors')
  @ApiOperation({ summary: 'Get feeds with errors' })
  async getErrorFeeds() {
    return this.adminService.getErrorFeeds();
  }

  @Patch('feed/:id/reset')
  @ApiOperation({ summary: 'Reset feed status to pending' })
  async resetFeedStatus(@Param('id') id: string) {
    return this.adminService.resetFeedStatus(id);
  }
}



