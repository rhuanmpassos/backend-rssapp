import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomYouTubeFeedDto } from './dto/create-custom-youtube-feed.dto';
import { UpdateCustomYouTubeFeedDto } from './dto/update-custom-youtube-feed.dto';
import { RssParserService } from '../../scraper/rss-parser.service';
import { PlaywrightService } from '../../scraper/playwright.service';

@Injectable()
export class CustomYouTubeFeedService {
  private readonly logger = new Logger(CustomYouTubeFeedService.name);

  constructor(
    private prisma: PrismaService,
    private rssParserService: RssParserService,
    private playwrightService: PlaywrightService,
  ) { }

  async create(dto: CreateCustomYouTubeFeedDto) {
    const existing = await this.prisma.customYouTubeFeed.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('A feed with this slug already exists');
    }

    // Resolve channel via scraping
    let resolvedChannelId = dto.channelId;
    let resolvedChannelName: string | null = null;

    if (dto.channelUrl && !dto.channelId) {
      this.logger.log(`Resolving channel from URL via scraping: ${dto.channelUrl}`);

      // Use scraping to get channel ID and name
      const scrapedData = await this.scrapeChannelInfo(dto.channelUrl);

      if (scrapedData && scrapedData.channelId) {
        resolvedChannelId = scrapedData.channelId;
        resolvedChannelName = scrapedData.channelName || null;
        this.logger.log(`Scraped channel ID: ${resolvedChannelId}, name: ${resolvedChannelName}`);
      } else {
        this.logger.warn(`Failed to resolve channel from URL: ${dto.channelUrl}`);
        throw new BadRequestException('Could not resolve YouTube channel from the provided URL. Please check if the URL is correct.');
      }
    }

    if (!resolvedChannelId) {
      throw new BadRequestException('Channel ID or Channel URL is required');
    }

    // If we don't have the channel name yet, try to scrape it
    if (!resolvedChannelName && resolvedChannelId) {
      resolvedChannelName = await this.scrapeChannelName(resolvedChannelId);
    }

    const feed = await this.prisma.customYouTubeFeed.create({
      data: {
        title: dto.title,
        description: dto.description,
        slug: dto.slug,
        channelId: resolvedChannelId,
        channelName: resolvedChannelName,
        channelUrl: dto.channelUrl,
        categoryId: dto.categoryId,
      },
      include: {
        category: true,
      },
    });

    this.logger.log(`Custom YouTube feed created: ${dto.slug} with channel ID: ${resolvedChannelId}`);
    return feed;
  }

  async findAll() {
    return this.prisma.customYouTubeFeed.findMany({
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublicFeeds() {
    return this.prisma.customYouTubeFeed.findMany({
      where: {
        channelId: { not: null },
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchPublicFeeds(query?: string) {
    const where: any = {
      channelId: { not: null },
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
      ];
    }

    return this.prisma.customYouTubeFeed.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async findOne(slug: string) {
    const feed = await this.prisma.customYouTubeFeed.findUnique({
      where: { slug },
      include: {
        category: true,
      },
    });

    if (!feed) {
      throw new NotFoundException('Custom YouTube feed not found');
    }

    return feed;
  }

  async update(id: string, dto: UpdateCustomYouTubeFeedDto) {
    const feed = await this.prisma.customYouTubeFeed.findUnique({
      where: { id },
    });

    if (!feed) {
      throw new NotFoundException('Custom YouTube feed not found');
    }

    if (dto.slug && dto.slug !== feed.slug) {
      const existing = await this.prisma.customYouTubeFeed.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new BadRequestException('A feed with this slug already exists');
      }
    }

    // Resolve channel if channelUrl provided (using scraping)
    let resolvedChannelId = dto.channelId || feed.channelId;
    let resolvedChannelName = feed.channelName;

    if (dto.channelUrl && !dto.channelId) {
      const scrapedData = await this.scrapeChannelInfo(dto.channelUrl);
      if (scrapedData && scrapedData.channelId) {
        resolvedChannelId = scrapedData.channelId;
        resolvedChannelName = scrapedData.channelName || null;
      } else {
        throw new BadRequestException('Could not resolve YouTube channel from the provided URL');
      }
    }

    return this.prisma.customYouTubeFeed.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        slug: dto.slug,
        channelId: resolvedChannelId,
        channelName: resolvedChannelName,
        channelUrl: dto.channelUrl,
        categoryId: dto.categoryId,
      },
      include: {
        category: true,
      },
    });
  }

  async delete(id: string) {
    const feed = await this.prisma.customYouTubeFeed.findUnique({
      where: { id },
    });

    if (!feed) {
      throw new NotFoundException('Custom YouTube feed not found');
    }

    await this.prisma.customYouTubeFeed.delete({
      where: { id },
    });

    this.logger.log(`Custom YouTube feed deleted: ${feed.slug}`);
    return { message: 'Custom YouTube feed deleted successfully' };
  }

  /**
   * Backfill channel names for existing feeds that don't have one
   */
  async backfillChannelNames() {
    const feedsWithoutName = await this.prisma.customYouTubeFeed.findMany({
      where: {
        channelName: null,
        channelId: { not: null },
      },
    });

    this.logger.log(`Found ${feedsWithoutName.length} feeds without channel name`);

    const results = {
      updated: 0,
      failed: 0,
      feeds: [] as { slug: string; channelName: string | null; error?: string }[],
    };

    for (const feed of feedsWithoutName) {
      try {
        // Get channel name via scraping
        this.logger.log(`Scraping channel name for ${feed.slug} (${feed.channelId})`);
        const channelName = await this.scrapeChannelName(feed.channelId!);

        if (channelName) {
          await this.prisma.customYouTubeFeed.update({
            where: { id: feed.id },
            data: { channelName },
          });

          results.updated++;
          results.feeds.push({ slug: feed.slug, channelName });
          this.logger.log(`Updated channel name for ${feed.slug}: ${channelName}`);
        } else {
          results.failed++;
          results.feeds.push({ slug: feed.slug, channelName: null, error: 'Could not get channel name' });
          this.logger.warn(`Could not get channel name for ${feed.slug}`);
        }
      } catch (error) {
        results.failed++;
        results.feeds.push({ slug: feed.slug, channelName: null, error: String(error) });
        this.logger.error(`Error updating channel name for ${feed.slug}: ${error}`);
      }
    }

    this.logger.log(`Backfill complete: ${results.updated} updated, ${results.failed} failed`);
    return results;
  }

  /**
   * Scrape channel info (ID and name) from YouTube URL
   */
  private async scrapeChannelInfo(url: string): Promise<{ channelId: string; channelName: string | null } | null> {
    try {
      // Normalize URL
      let normalizedUrl = url.trim();

      // Handle @username format
      if (normalizedUrl.startsWith('@')) {
        normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
      } else if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = `https://www.youtube.com/@${normalizedUrl.replace('@', '')}`;
      }

      this.logger.log(`Scraping channel info from: ${normalizedUrl}`);
      const scraped = await this.playwrightService.scrapePage(normalizedUrl);

      if (!scraped || !scraped.html) {
        return null;
      }

      // Extract channel ID
      let channelId: string | null = null;
      const channelIdPatterns = [
        /"channelId":"([^"]+)"/,
        /"externalId":"([^"]+)"/,
        /channel_id=([^&"'\s]+)/,
        /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
        /"browseId":"(UC[a-zA-Z0-9_-]{22})"/,
      ];

      for (const pattern of channelIdPatterns) {
        const match = scraped.html.match(pattern);
        if (match && match[1] && match[1].startsWith('UC')) {
          channelId = match[1];
          break;
        }
      }

      if (!channelId) {
        this.logger.warn(`Could not extract channel ID from: ${normalizedUrl}`);
        return null;
      }

      // Extract channel name
      let channelName: string | null = null;
      const namePatterns = [
        /<meta property="og:title" content="([^"]+)"/,
        /<meta name="title" content="([^"]+)"/,
        /"channelName":"([^"]+)"/,
        /"name":"([^"]+)"/,
        /<title>([^<]+) - YouTube<\/title>/,
      ];

      for (const pattern of namePatterns) {
        const match = scraped.html.match(pattern);
        if (match && match[1]) {
          const name = match[1].trim();
          if (name && name !== 'YouTube' && !name.startsWith('http')) {
            channelName = name;
            break;
          }
        }
      }

      this.logger.log(`Scraped channel info - ID: ${channelId}, Name: ${channelName}`);
      return { channelId, channelName };
    } catch (error) {
      this.logger.error(`Error scraping channel info: ${error}`);
      return null;
    }
  }

  /**
   * Scrape channel name from YouTube channel page
   */
  private async scrapeChannelName(channelId: string): Promise<string | null> {
    try {
      const channelUrl = `https://www.youtube.com/channel/${channelId}`;
      this.logger.log(`Scraping channel name from: ${channelUrl}`);

      const scraped = await this.playwrightService.scrapePage(channelUrl);

      if (!scraped || !scraped.html) {
        return null;
      }

      // Try various patterns to extract channel name
      const patterns = [
        /<meta property="og:title" content="([^"]+)"/,
        /<meta name="title" content="([^"]+)"/,
        /"channelName":"([^"]+)"/,
        /"name":"([^"]+)"/,
        /<title>([^<]+) - YouTube<\/title>/,
      ];

      for (const pattern of patterns) {
        const match = scraped.html.match(pattern);
        if (match && match[1]) {
          const name = match[1].trim();
          if (name && name !== 'YouTube' && !name.startsWith('http')) {
            this.logger.log(`Found channel name via scraping: ${name}`);
            return name;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error scraping channel name: ${error}`);
      return null;
    }
  }

  /**
   * Extract video ID from YouTube URL
   */
  private extractVideoId(url: string): string {
    const match = url.match(/(?:watch\?v=|youtu\.be\/|v\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  }

  async getRssXml(slug: string): Promise<string> {
    const feed = await this.findOne(slug);

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const feedUrl = `${baseUrl}/api/v1/custom-youtube-feeds/${slug}/rss.xml`;

    let items: any[] = [];

    if (feed.channelId) {
      try {
        this.logger.log(`Fetching videos for YouTube channel: ${feed.channelId}`);

        // Extract the base channel ID (remove UC prefix if present)
        const baseChannelId = feed.channelId.startsWith('UC')
          ? feed.channelId.substring(2)
          : feed.channelId;

        // Playlist IDs for YouTube:
        // - UUSH{baseId} = Shorts uploads
        // - UULV{baseId} = Live streams (first item is current live if any)
        // - Regular channel_id = All videos
        const uploadsRssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${feed.channelId}`;
        const livesRssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${baseChannelId}`;

        this.logger.log(`Fetching uploads from: ${uploadsRssUrl}`);
        this.logger.log(`Fetching lives from: ${livesRssUrl}`);

        // Fetch uploads (regular videos)
        let videoItems: any[] = [];
        try {
          const uploadsParsed = await this.rssParserService.parseUrl(uploadsRssUrl);
          if (uploadsParsed && uploadsParsed.items && uploadsParsed.items.length > 0) {
            videoItems = uploadsParsed.items.slice(0, 20).map(item => ({
              title: item.title || 'Sem título',
              subtitle: item.excerpt || '',
              link: item.url || '',
              imageUrl: item.thumbnailUrl,
              publishedAt: item.publishedAt,
              isLive: false, // Regular uploads are never live
              videoId: this.extractVideoId(item.url || ''),
            }));
          }
        } catch (uploadsError) {
          this.logger.warn(`Failed to fetch uploads: ${uploadsError}`);
        }

        // Fetch first live from UULV playlist
        let currentLive: any = null;
        try {
          const livesParsed = await this.rssParserService.parseUrl(livesRssUrl);
          if (livesParsed && livesParsed.items && livesParsed.items.length > 0) {
            // Only first item is the current/most recent live
            const firstLive = livesParsed.items[0];
            const liveVideoId = this.extractVideoId(firstLive.url || '');

            // Check if this live was published/updated recently (within last 24 hours)
            const publishedDate = new Date(firstLive.publishedAt || 0);
            const now = new Date();
            const hoursAgo = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60);

            // Only mark as live if recent (likely still active)
            const isLikelyActive = hoursAgo < 24;

            currentLive = {
              title: firstLive.title || 'Live Stream',
              subtitle: firstLive.excerpt || '',
              link: firstLive.url || `https://www.youtube.com/watch?v=${liveVideoId}`,
              imageUrl: firstLive.thumbnailUrl,
              publishedAt: firstLive.publishedAt,
              isLive: isLikelyActive, // Only mark as live if recent
              videoId: liveVideoId,
            };

            this.logger.log(`Found live stream: ${currentLive.title} (active: ${isLikelyActive}, hours ago: ${hoursAgo.toFixed(1)})`);
          }
        } catch (livesError) {
          this.logger.warn(`Failed to fetch lives playlist: ${livesError}`);
        }

        // Combine: live first (if exists and is active), then videos
        // Remove duplicate if live video also appears in uploads
        if (currentLive && currentLive.isLive) {
          items = [currentLive];

          // Add videos, excluding the current live
          for (const video of videoItems) {
            if (video.videoId !== currentLive.videoId) {
              items.push(video);
            }
          }
        } else {
          items = videoItems;
        }

        this.logger.log(`Successfully fetched ${items.length} items for feed: ${feed.slug} (lives: ${items.filter(i => i.isLive).length})`);

      } catch (error) {
        this.logger.error(`Failed to fetch videos for feed ${feed.slug}: ${error}`);
        items = [];
      }
    }

    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title><![CDATA[${feed.title}]]></title>
    <description><![CDATA[${feed.description || ''}]]></description>
    <link>${feedUrl}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <pubDate>${feed.updatedAt.toUTCString()}</pubDate>
    <generator>RSS App Custom YouTube Feed Generator</generator>
`;

    for (const item of items) {
      const title = item.isLive ? `🔴 LIVE: ${item.title || 'Sem título'}` : (item.title || 'Sem título');
      rss += `    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[${item.subtitle || item.title || ''}]]></description>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${item.publishedAt ? new Date(item.publishedAt).toUTCString() : new Date().toUTCString()}</pubDate>
`;

      if (item.imageUrl) {
        rss += `      <media:content url="${item.imageUrl}" type="image/jpeg" />
      <enclosure url="${item.imageUrl}" type="image/jpeg" />
`;
      }

      rss += `    </item>
`;
    }

    rss += `  </channel>
</rss>`;

    return rss;
  }

  /**
   * Extract YouTube channel ID from URL using scraping as fallback when API is not available
   */
  private async extractChannelIdFromUrl(url: string): Promise<string | null> {
    try {
      // Normalize URL
      let normalizedUrl = url.trim();

      // Handle @username format
      if (normalizedUrl.startsWith('@')) {
        normalizedUrl = `https://www.youtube.com/${normalizedUrl}`;
      } else if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = `https://www.youtube.com/@${normalizedUrl.replace('@', '')}`;
      }

      // Extract handle or channel ID from URL
      const urlMatch = normalizedUrl.match(
        /(?:youtube\.com\/(?:channel\/|c\/|@|user\/)?|youtu\.be\/)([^\/\?\s]+)/
      );

      if (!urlMatch) {
        return null;
      }

      const identifier = urlMatch[1];

      // If it's already a channel ID (starts with UC), return it
      if (identifier.startsWith('UC') && identifier.length === 24) {
        return identifier;
      }

      // Otherwise, scrape the page to get channel ID
      this.logger.log(`Scraping YouTube page to extract channel ID: ${normalizedUrl}`);

      const scraped = await this.playwrightService.scrapePage(normalizedUrl);

      if (!scraped || !scraped.html) {
        return null;
      }

      // Try to extract channel ID from various sources in the HTML
      const channelIdPatterns = [
        /"channelId":"([^"]+)"/,
        /"externalId":"([^"]+)"/,
        /channel_id=([^&"'\s]+)/,
        /\/channel\/(UC[a-zA-Z0-9_-]{22})/,
        /"browseId":"(UC[a-zA-Z0-9_-]{22})"/,
      ];

      for (const pattern of channelIdPatterns) {
        const match = scraped.html.match(pattern);
        if (match && match[1] && match[1].startsWith('UC')) {
          this.logger.log(`Found channel ID via scraping: ${match[1]}`);
          return match[1];
        }
      }

      // Try to find in meta tags or JSON-LD
      const metaMatch = scraped.html.match(/<meta[^>]+content="([^"]*channel[^"]*UC[a-zA-Z0-9_-]{22}[^"]*)"/i);
      if (metaMatch) {
        const channelIdMatch = metaMatch[1].match(/(UC[a-zA-Z0-9_-]{22})/);
        if (channelIdMatch) {
          return channelIdMatch[1];
        }
      }

      this.logger.warn(`Could not extract channel ID from scraped page: ${normalizedUrl}`);
      return null;
    } catch (error) {
      this.logger.error(`Error extracting channel ID from URL ${url}: ${error}`);
      return null;
    }
  }
}

