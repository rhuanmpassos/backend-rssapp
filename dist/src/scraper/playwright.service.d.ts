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
    confidence: number;
}
export declare class PlaywrightService implements OnModuleDestroy {
    private configService;
    private readonly logger;
    private browser;
    private readonly timeout;
    private readonly userAgent;
    private readonly ARTICLE_SELECTORS;
    constructor(configService: ConfigService);
    onModuleDestroy(): Promise<void>;
    private getBrowser;
    scrapePage(url: string): Promise<ScrapedPage | null>;
    private extractJsonLd;
    private extractThumbnailFromJsonLd;
    private extractAuthorFromJsonLd;
    private calculateConfidence;
    scrapeArticleLinks(url: string): Promise<string[]>;
    checkXRobotsTag(url: string): Promise<boolean>;
    private truncateExcerpt;
    private resolveUrl;
}
