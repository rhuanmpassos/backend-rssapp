import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export interface ScrapedPage {
    title: string;
    description?: string;
    excerpt?: string;
    thumbnailUrl?: string;
    author?: string;
    publishedAt?: Date;
    canonicalUrl?: string;
    html: string;
}
export declare class PlaywrightService implements OnModuleDestroy {
    private configService;
    private readonly logger;
    private browser;
    private readonly timeout;
    private readonly userAgent;
    constructor(configService: ConfigService);
    onModuleDestroy(): Promise<void>;
    private getBrowser;
    scrapePage(url: string): Promise<ScrapedPage | null>;
    scrapeArticleLinks(url: string): Promise<string[]>;
    checkXRobotsTag(url: string): Promise<boolean>;
    private truncateExcerpt;
    private resolveUrl;
}
