import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) { }

  /**
   * Full-text search across feed items and videos
   * 
   * @param q - Search query (supports multiple words)
   * @param type - Filter by type: 'all' | 'feed' | 'video'
   * @param author - Filter by author (optional)
   * @param feedId - Filter by feedId (optional)
   * @param channelId - Filter by YouTube channel (optional)
   * @param page - Page number
   * @param limit - Items per page
   */
  @Get()
  async search(
    @Request() req: any,
    @Query('q') query: string,
    @Query('type') type: string = 'all',
    @Query('author') author?: string,
    @Query('feedId') feedId?: string,
    @Query('channelId') channelId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.searchService.search({
      userId: req.user.id,
      query,
      type: type as 'all' | 'feed' | 'video',
      author,
      feedId,
      channelId,
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 50), // Max 50 items per page
    });
  }

  /**
   * Search only in user's bookmarks
   */
  @Get('bookmarks')
  async searchBookmarks(
    @Request() req: any,
    @Query('q') query: string,
    @Query('type') type: string = 'all',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.searchService.searchBookmarks({
      userId: req.user.id,
      query,
      type: type as 'all' | 'feed' | 'video',
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 50),
    });
  }
}
