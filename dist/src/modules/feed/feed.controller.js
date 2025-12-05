"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const feed_service_1 = require("./feed.service");
const feed_item_service_1 = require("./feed-item.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let FeedController = class FeedController {
    constructor(feedService, feedItemService) {
        this.feedService = feedService;
        this.feedItemService = feedItemService;
    }
    async listFeeds(page, limit) {
        return this.feedService.listFeeds(page || 1, limit || 20);
    }
    async getFeed(id) {
        return this.feedService.getFeedById(id);
    }
    async getFeedItems(id, page, limit) {
        return this.feedService.getFeedItems(id, page || 1, limit || 20);
    }
    async getFeedItem(itemId) {
        return this.feedItemService.getItemById(itemId);
    }
};
exports.FeedController = FeedController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all feeds' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of feeds',
        schema: {
            example: {
                data: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        url: 'https://example.com',
                        siteDomain: 'example.com',
                        title: 'Example Site',
                        rssUrl: 'https://example.com/feed.xml',
                        status: 'active',
                        lastScrapeAt: '2024-01-15T10:30:00.000Z',
                        _count: { items: 42 },
                    },
                ],
                meta: {
                    page: 1,
                    limit: 20,
                    total: 5,
                    totalPages: 1,
                },
            },
        },
    }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], FeedController.prototype, "listFeeds", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific feed' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Feed details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Feed not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FeedController.prototype, "getFeed", null);
__decorate([
    (0, common_1.Get)(':id/items'),
    (0, swagger_1.ApiOperation)({ summary: 'List items from a feed' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of feed items',
        schema: {
            example: {
                feed: {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    title: 'Example Site',
                    siteDomain: 'example.com',
                },
                data: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440001',
                        url: 'https://example.com/article-1',
                        title: 'Breaking News Article',
                        excerpt: 'This is the meta description or first paragraph...',
                        thumbnailUrl: 'https://example.com/image.jpg',
                        publishedAt: '2024-01-15T10:00:00.000Z',
                        fetchedAt: '2024-01-15T10:30:00.000Z',
                    },
                ],
                meta: {
                    page: 1,
                    limit: 20,
                    total: 42,
                    totalPages: 3,
                },
            },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", Promise)
], FeedController.prototype, "getFeedItems", null);
__decorate([
    (0, common_1.Get)('items/:itemId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific feed item' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Feed item details' }),
    __param(0, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FeedController.prototype, "getFeedItem", null);
exports.FeedController = FeedController = __decorate([
    (0, swagger_1.ApiTags)('feeds'),
    (0, common_1.Controller)('feeds'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [feed_service_1.FeedService,
        feed_item_service_1.FeedItemService])
], FeedController);
//# sourceMappingURL=feed.controller.js.map