import { Module, forwardRef } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { FeedItemService } from './feed-item.service';
import { ScraperModule } from '../../scraper/scraper.module';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  imports: [forwardRef(() => ScraperModule)],
  controllers: [FeedController],
  providers: [
    FeedService,
    {
      provide: FeedItemService,
      useFactory: (prisma: PrismaService, feedService: FeedService) => {
        return new FeedItemService(prisma, feedService);
      },
      inject: [PrismaService, FeedService],
    },
  ],
  exports: [FeedService, FeedItemService],
})
export class FeedModule {}



