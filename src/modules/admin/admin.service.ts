import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { YouTubeService } from '../youtube/youtube.service';
import { ScraperService } from '../../scraper/scraper.service';
import { FeedStatus, JobStatus, JobType } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private feedService: FeedService,
    private youtubeService: YouTubeService,
    private scraperService: ScraperService,
  ) {}

  async forceScrape(feedId: string) {
    const feed = await this.feedService.getFeedById(feedId);

    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    this.logger.log(`Force scraping feed: ${feed.url}`);

    // Create job log
    const job = await this.prisma.jobLog.create({
      data: {
        jobType: JobType.scrape_feed,
        target: feedId,
        status: JobStatus.pending,
      },
    });

    // Queue the scrape job
    await this.scraperService.queueFeedScrape(feedId);

    return {
      message: 'Scrape job queued',
      jobId: job.id,
      feedId: feed.id,
      feedUrl: feed.url,
    };
  }

  async forceCheckYouTube(channelId: string) {
    const channel = await this.youtubeService.getChannelById(channelId);

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    this.logger.log(`Force checking YouTube channel: ${channel.title}`);

    // Create job log
    const job = await this.prisma.jobLog.create({
      data: {
        jobType: JobType.check_youtube,
        target: channelId,
        status: JobStatus.running,
        startedAt: new Date(),
      },
    });

    try {
      const result = await this.youtubeService.fetchAndSaveNewVideos(channelId);

      await this.prisma.jobLog.update({
        where: { id: job.id },
        data: {
          status: JobStatus.completed,
          completedAt: new Date(),
          result: result as any,
        },
      });

      return {
        message: 'YouTube channel checked',
        jobId: job.id,
        channelId: channel.id,
        channelTitle: channel.title,
        ...result,
      };
    } catch (error) {
      await this.prisma.jobLog.update({
        where: { id: job.id },
        data: {
          status: JobStatus.failed,
          completedAt: new Date(),
          lastError: String(error),
        },
      });

      throw error;
    }
  }

  async getStats() {
    const [
      usersCount,
      subscriptionsCount,
      feedsCount,
      feedItemsCount,
      channelsCount,
      videosCount,
      activeFeeds,
      errorFeeds,
      pendingJobs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count(),
      this.prisma.feed.count(),
      this.prisma.feedItem.count(),
      this.prisma.youTubeChannel.count(),
      this.prisma.youTubeVideo.count(),
      this.prisma.feed.count({ where: { status: FeedStatus.active } }),
      this.prisma.feed.count({ where: { status: FeedStatus.error } }),
      this.prisma.jobLog.count({ where: { status: JobStatus.pending } }),
    ]);

    return {
      users: usersCount,
      subscriptions: subscriptionsCount,
      feeds: {
        total: feedsCount,
        active: activeFeeds,
        error: errorFeeds,
        items: feedItemsCount,
      },
      youtube: {
        channels: channelsCount,
        videos: videosCount,
      },
      jobs: {
        pending: pendingJobs,
      },
    };
  }

  async getRecentJobs(limit: number = 50) {
    return this.prisma.jobLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getErrorFeeds() {
    return this.prisma.feed.findMany({
      where: {
        status: { in: [FeedStatus.error, FeedStatus.blocked] },
      },
      orderBy: { lastScrapeAt: 'desc' },
    });
  }

  async resetFeedStatus(feedId: string) {
    const feed = await this.feedService.getFeedById(feedId);

    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    await this.prisma.feed.update({
      where: { id: feedId },
      data: {
        status: FeedStatus.pending,
        errorMessage: null,
      },
    });

    return { message: 'Feed status reset', feedId };
  }
}



