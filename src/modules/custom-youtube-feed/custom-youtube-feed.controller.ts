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
import { CustomYouTubeFeedService } from './custom-youtube-feed.service';
import { CreateCustomYouTubeFeedDto } from './dto/create-custom-youtube-feed.dto';
import { UpdateCustomYouTubeFeedDto } from './dto/update-custom-youtube-feed.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('custom-youtube-feeds')
export class CustomYouTubeFeedController {
  constructor(private readonly customYouTubeFeedService: CustomYouTubeFeedService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateCustomYouTubeFeedDto) {
    return this.customYouTubeFeedService.create(dto);
  }

  @Get()
  findAll() {
    return this.customYouTubeFeedService.findAll();
  }

  @Get('public')
  @Public()
  findPublicFeeds() {
    return this.customYouTubeFeedService.findPublicFeeds();
  }

  @Get('public/search')
  @Public()
  searchPublicFeeds(@Query('q') query?: string) {
    return this.customYouTubeFeedService.searchPublicFeeds(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.customYouTubeFeedService.findOne(slug);
  }

  @Get(':slug/rss.xml')
  @Public()
  async getRssXml(@Param('slug') slug: string, @Res() res: Response) {
    try {
      const xml = await this.customYouTubeFeedService.getRssXml(slug);
      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      res.status(404).json({ message: 'Feed not found' });
    }
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomYouTubeFeedDto) {
    return this.customYouTubeFeedService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string) {
    return this.customYouTubeFeedService.delete(id);
  }
}

