import { Response } from 'express';
import { CustomYouTubeFeedService } from './custom-youtube-feed.service';
import { CreateCustomYouTubeFeedDto } from './dto/create-custom-youtube-feed.dto';
import { UpdateCustomYouTubeFeedDto } from './dto/update-custom-youtube-feed.dto';
export declare class CustomYouTubeFeedController {
    private readonly customYouTubeFeedService;
    constructor(customYouTubeFeedService: CustomYouTubeFeedService);
    create(dto: CreateCustomYouTubeFeedDto): Promise<{
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        } | null;
    } & {
        id: string;
        channelId: string | null;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    }>;
    findAll(): Promise<({
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        } | null;
    } & {
        id: string;
        channelId: string | null;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    })[]>;
    findPublicFeeds(): Promise<({
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        } | null;
    } & {
        id: string;
        channelId: string | null;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    })[]>;
    searchPublicFeeds(query?: string): Promise<({
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        } | null;
    } & {
        id: string;
        channelId: string | null;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    })[]>;
    findOne(slug: string): Promise<{
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        } | null;
    } & {
        id: string;
        channelId: string | null;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    }>;
    getRssXml(slug: string, res: Response): Promise<void>;
    update(id: string, dto: UpdateCustomYouTubeFeedDto): Promise<{
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        } | null;
    } & {
        id: string;
        channelId: string | null;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        channelUrl: string | null;
        categoryId: string | null;
    }>;
    delete(id: string): Promise<{
        message: string;
    }>;
}
