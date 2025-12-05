import { PlaywrightService } from './playwright.service';
interface ExtractContentDto {
    url: string;
    selectors?: {
        title?: string;
        subtitle?: string;
        image?: string;
        publishedAt?: string;
        content?: string;
    };
}
interface ExtractMultipleDto {
    siteUrl: string;
    articleSelector: string;
    selectors: {
        title: string;
        link: string;
        subtitle?: string;
        image?: string;
        publishedAt?: string;
    };
}
export declare class ScraperController {
    private readonly playwrightService;
    constructor(playwrightService: PlaywrightService);
    extractContent(dto: ExtractContentDto): Promise<any>;
    extractMultiple(dto: ExtractMultipleDto): Promise<{
        articles: any;
        count: any;
    }>;
    private extractWithSelectors;
}
export {};
