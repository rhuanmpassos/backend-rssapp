import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import robotsParser from 'robots-parser';

interface RobotsCache {
  robots: ReturnType<typeof robotsParser>;
  fetchedAt: Date;
}

@Injectable()
export class RobotsService {
  private readonly logger = new Logger(RobotsService.name);
  private readonly cache = new Map<string, RobotsCache>();
  private readonly userAgent: string;
  private readonly cacheTTL = 60 * 60 * 1000; // 1 hour

  constructor(private configService: ConfigService) {
    this.userAgent = this.configService.get<string>(
      'USER_AGENT',
      'RSSApp/1.0 (+https://github.com/rssapp)',
    );
  }

  async isAllowed(url: string): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;
      const pathname = parsedUrl.pathname;

      const robots = await this.getRobots(origin);
      
      if (!robots) {
        // No robots.txt or failed to fetch - allow by default
        return true;
      }

      return robots.isAllowed(pathname, this.userAgent) ?? true;
    } catch (error) {
      this.logger.warn(`Error checking robots.txt for ${url}: ${error}`);
      return true; // Allow on error
    }
  }

  async getCrawlDelay(url: string): Promise<number> {
    try {
      const parsedUrl = new URL(url);
      const robots = await this.getRobots(parsedUrl.origin);

      if (!robots) {
        return 0;
      }

      const delay = robots.getCrawlDelay(this.userAgent);
      return delay ? delay * 1000 : 0; // Convert to ms
    } catch {
      return 0;
    }
  }

  async getSitemaps(url: string): Promise<string[]> {
    try {
      const parsedUrl = new URL(url);
      const robots = await this.getRobots(parsedUrl.origin);

      if (!robots) {
        return [];
      }

      return robots.getSitemaps();
    } catch {
      return [];
    }
  }

  private async getRobots(origin: string): Promise<ReturnType<typeof robotsParser> | null> {
    // Check cache
    const cached = this.cache.get(origin);
    if (cached && Date.now() - cached.fetchedAt.getTime() < this.cacheTTL) {
      return cached.robots;
    }

    try {
      const robotsUrl = `${origin}/robots.txt`;
      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        // No robots.txt
        this.cache.set(origin, {
          robots: robotsParser(robotsUrl, ''),
          fetchedAt: new Date(),
        });
        return null;
      }

      const text = await response.text();
      const robots = robotsParser(robotsUrl, text);

      this.cache.set(origin, {
        robots,
        fetchedAt: new Date(),
      });

      return robots;
    } catch (error) {
      this.logger.debug(`Failed to fetch robots.txt for ${origin}: ${error}`);
      return null;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}



