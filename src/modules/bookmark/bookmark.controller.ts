import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookmarkService } from './bookmark.service';
import { CreateBookmarkDto, SyncBookmarksDto } from './dto/bookmark.dto';
import { CreateReadItemDto, SyncReadItemsDto } from './dto/read-item.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) { }

  // =============================================
  // BOOKMARKS
  // =============================================

  @Get('bookmarks')
  async getBookmarks(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.bookmarkService.getBookmarks(
      req.user.id,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Post('bookmarks')
  async addBookmark(
    @Request() req: any,
    @Body() dto: CreateBookmarkDto,
  ) {
    return this.bookmarkService.addBookmark(req.user.id, dto);
  }

  @Delete('bookmarks/:id')
  async removeBookmark(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.bookmarkService.removeBookmark(req.user.id, id);
  }

  @Post('bookmarks/sync')
  async syncBookmarks(
    @Request() req: any,
    @Body() dto: SyncBookmarksDto,
  ) {
    return this.bookmarkService.syncBookmarks(req.user.id, dto);
  }

  // =============================================
  // READ ITEMS
  // =============================================

  @Get('read-items')
  async getReadItems(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '100',
  ) {
    return this.bookmarkService.getReadItems(
      req.user.id,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Post('read-items')
  async markAsRead(
    @Request() req: any,
    @Body() dto: CreateReadItemDto,
  ) {
    return this.bookmarkService.markAsRead(req.user.id, dto);
  }

  @Delete('read-items/:id')
  async markAsUnread(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.bookmarkService.markAsUnread(req.user.id, id);
  }

  @Post('read-items/sync')
  async syncReadItems(
    @Request() req: any,
    @Body() dto: SyncReadItemsDto,
  ) {
    return this.bookmarkService.syncReadItems(req.user.id, dto);
  }
}
