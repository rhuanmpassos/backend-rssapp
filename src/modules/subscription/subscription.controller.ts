import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
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
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreateSiteSubscriptionDto } from './dto/create-site-subscription.dto';
import { CreateYouTubeSubscriptionDto } from './dto/create-youtube-subscription.dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('site')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to a website/RSS feed' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        type: 'site',
        target: 'https://example.com',
        enabled: true,
        createdAt: '2024-01-15T10:30:00.000Z',
        feed: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          title: 'Example Site',
          siteDomain: 'example.com',
          rssUrl: 'https://example.com/feed.xml',
          status: 'active',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid URL or already subscribed' })
  async subscribeSite(
    @CurrentUser() user: User,
    @Body() dto: CreateSiteSubscriptionDto,
  ) {
    return this.subscriptionService.createSiteSubscription(user.id, dto);
  }

  @Post('youtube')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to a YouTube channel' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        type: 'youtube',
        target: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
        enabled: true,
        createdAt: '2024-01-15T10:30:00.000Z',
        channel: {
          id: '550e8400-e29b-41d4-a716-446655440003',
          channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
          title: 'Google Developers',
          thumbnailUrl: 'https://yt3.ggpht.com/...',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'YouTube channel not found' })
  async subscribeYouTube(
    @CurrentUser() user: User,
    @Body() dto: CreateYouTubeSubscriptionDto,
  ) {
    return this.subscriptionService.createYouTubeSubscription(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all user subscriptions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: ['site', 'youtube'] })
  @ApiResponse({
    status: 200,
    description: 'List of subscriptions',
    schema: {
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'site',
            target: 'https://example.com',
            enabled: true,
            feed: { title: 'Example Site' },
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 5,
          totalPages: 1,
        },
      },
    },
  })
  async listSubscriptions(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: 'site' | 'youtube',
  ) {
    return this.subscriptionService.getUserSubscriptions(
      user.id,
      page || 1,
      limit || 20,
      type,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific subscription' })
  @ApiResponse({ status: 200, description: 'Subscription details' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscription(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.subscriptionService.getSubscriptionById(user.id, id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle subscription enabled/disabled' })
  @ApiResponse({ status: 200, description: 'Subscription toggled' })
  async toggleSubscription(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.subscriptionService.toggleSubscription(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription deleted' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async deleteSubscription(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.subscriptionService.deleteSubscription(user.id, id);
  }
}

