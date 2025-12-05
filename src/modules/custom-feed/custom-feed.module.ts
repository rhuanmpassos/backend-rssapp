import { Module } from '@nestjs/common';
import { CustomFeedController } from './custom-feed.controller';
import { CustomFeedService } from './custom-feed.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ScraperModule } from '../../scraper/scraper.module';

@Module({
  imports: [PrismaModule, ScraperModule],
  controllers: [CustomFeedController],
  providers: [CustomFeedService],
  exports: [CustomFeedService],
})
export class CustomFeedModule {}

