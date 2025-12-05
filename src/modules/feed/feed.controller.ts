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
import { FeedService } from './feed.service';
import { FeedItemService } from './feed-item.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('feeds')
@Controller('feeds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FeedController {
  constructor(
    private readonly feedService: FeedService,
    private readonly feedItemService: FeedItemService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all feeds' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of feeds',
    schema: {
      example: {
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            url: 'https://example.com',
            siteDomain: 'example.com',
            title: 'Example Site',
            rssUrl: 'https://example.com/feed.xml',
            status: 'active',
            lastScrapeAt: '2024-01-15T10:30:00.000Z',
            _count: { items: 42 },
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
  async listFeeds(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.feedService.listFeeds(page || 1, limit || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific feed' })
  @ApiResponse({ status: 200, description: 'Feed details' })
  @ApiResponse({ status: 404, description: 'Feed not found' })
  async getFeed(@Param('id') id: string) {
    return this.feedService.getFeedById(id);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'List items from a feed' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of feed items',
    schema: {
      example: {
        feed: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Example Site',
          siteDomain: 'example.com',
        },
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            url: 'https://example.com/article-1',
            title: 'Breaking News Article',
            excerpt: 'This is the meta description or first paragraph...',
            thumbnailUrl: 'https://example.com/image.jpg',
            publishedAt: '2024-01-15T10:00:00.000Z',
            fetchedAt: '2024-01-15T10:30:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 42,
          totalPages: 3,
        },
      },
    },
  })
  async getFeedItems(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.feedService.getFeedItems(id, page || 1, limit || 20);
  }

  @Get('items/:itemId')
  @ApiOperation({ summary: 'Get a specific feed item' })
  @ApiResponse({ status: 200, description: 'Feed item details' })
  async getFeedItem(@Param('itemId') itemId: string) {
    return this.feedItemService.getItemById(itemId);
  }
}



