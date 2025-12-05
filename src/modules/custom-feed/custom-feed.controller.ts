import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { CustomFeedService } from './custom-feed.service';
import { CreateCustomFeedDto } from './dto/create-custom-feed.dto';
import { UpdateCustomFeedDto } from './dto/update-custom-feed.dto';
import { CreateCustomFeedItemDto } from './dto/create-custom-feed-item.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('custom-feeds')
export class CustomFeedController {
  constructor(private readonly customFeedService: CustomFeedService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCustomFeedDto) {
    return this.customFeedService.create(dto);
  }

  @Get()
  findAll() {
    return this.customFeedService.findAll();
  }

  @Get('public')
  @Public()
  findPublicFeeds() {
    return this.customFeedService.findPublicFeeds();
  }

  @Get('public/search')
  @Public()
  searchPublicFeeds(@Query('q') query?: string) {
    return this.customFeedService.searchPublicFeeds(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.customFeedService.findOne(slug);
  }

  @Get(':slug/rss.xml')
  @Public()
  async getRssXml(@Param('slug') slug: string, @Res() res: Response) {
    try {
      const xml = await this.customFeedService.getRssXml(slug);
      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      res.status(404).json({ message: 'Feed not found' });
    }
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomFeedDto) {
    return this.customFeedService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string) {
    return this.customFeedService.delete(id);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.CREATED)
  addItem(@Param('id') id: string, @Body() dto: CreateCustomFeedItemDto) {
    return this.customFeedService.addItem(id, dto);
  }

  @Put('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: Partial<CreateCustomFeedItemDto>,
  ) {
    return this.customFeedService.updateItem(itemId, dto);
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  deleteItem(@Param('itemId') itemId: string) {
    return this.customFeedService.deleteItem(itemId);
  }

  @Get('categories/all')
  getCategories() {
    return this.customFeedService.getCategories();
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  createCategory(@Body() body: { name: string }) {
    return this.customFeedService.createCategory(body.name);
  }
}

