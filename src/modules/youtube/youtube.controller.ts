import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { YouTubeService } from './youtube.service';
import { YouTubeApiService } from './youtube-api.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('youtube')
@Controller('youtube')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class YouTubeController {
  constructor(
    private readonly youtubeService: YouTubeService,
    private readonly youtubeApiService: YouTubeApiService,
  ) {}

  @Get('channels')
  @ApiOperation({ summary: 'List all YouTube channels' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of YouTube channels',
    schema: {
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
            title: 'Google Developers',
            thumbnailUrl: 'https://yt3.ggpht.com/...',
            lastCheckedAt: '2024-01-15T10:30:00.000Z',
            _count: { videos: 150 },
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 3,
          totalPages: 1,
        },
      },
    },
  })
  async listChannels(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.youtubeService.listChannels(user.id, page || 1, limit || 20);
  }

  @Get('channels/:id')
  @ApiOperation({ summary: 'Get a specific YouTube channel' })
  @ApiResponse({ status: 200, description: 'Channel details' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async getChannel(@Param('id') id: string) {
    return this.youtubeService.getChannelById(id);
  }

  @Get('channels/:id/videos')
  @ApiOperation({ summary: 'List videos from a YouTube channel' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of videos',
    schema: {
      example: {
        channel: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
          title: 'Google Developers',
        },
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            videoId: 'dQw4w9WgXcQ',
            title: 'Amazing Video Title',
            description: 'First 500 chars of description...',
            thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
            duration: 'PT4M20S',
            publishedAt: '2024-01-15T10:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 150,
          totalPages: 8,
        },
      },
    },
  })
  async getChannelVideos(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.youtubeService.getChannelVideos(id, page || 1, limit || 20);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Get YouTube API quota usage' })
  @ApiResponse({
    status: 200,
    description: 'Quota usage',
    schema: {
      example: {
        used: 1500,
        limit: 10000,
        percentage: 15,
      },
    },
  })
  async getQuotaUsage() {
    const quota = await this.youtubeApiService.getQuotaUsage();
    return {
      ...quota,
      percentage: Math.round((quota.used / quota.limit) * 100),
    };
  }
}



