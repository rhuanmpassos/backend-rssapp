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
exports.YouTubeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const youtube_service_1 = require("./youtube.service");
const youtube_api_service_1 = require("./youtube-api.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let YouTubeController = class YouTubeController {
    constructor(youtubeService, youtubeApiService) {
        this.youtubeService = youtubeService;
        this.youtubeApiService = youtubeApiService;
    }
    async listChannels(user, page, limit) {
        return this.youtubeService.listChannels(user.id, page || 1, limit || 20);
    }
    async getChannel(id) {
        return this.youtubeService.getChannelById(id);
    }
    async getChannelVideos(id, page, limit) {
        return this.youtubeService.getChannelVideos(id, page || 1, limit || 20);
    }
    async getQuotaUsage() {
        const quota = await this.youtubeApiService.getQuotaUsage();
        return {
            ...quota,
            percentage: Math.round((quota.used / quota.limit) * 100),
        };
    }
};
exports.YouTubeController = YouTubeController;
__decorate([
    (0, common_1.Get)('channels'),
    (0, swagger_1.ApiOperation)({ summary: 'List all YouTube channels' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of YouTube channels',
        schema: {
            example: {
                data: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
                        title: 'Google Developers',
                        thumbnailUrl: 'https://yt3.ggpht.com/...',
                        lastCheckedAt: '2024-01-15T10:30:00.000Z',
                        _count: { videos: 150 },
                    },
                ],
                meta: {
                    page: 1,
                    limit: 20,
                    total: 3,
                    totalPages: 1,
                },
            },
        },
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", Promise)
], YouTubeController.prototype, "listChannels", null);
__decorate([
    (0, common_1.Get)('channels/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific YouTube channel' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Channel details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Channel not found' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], YouTubeController.prototype, "getChannel", null);
__decorate([
    (0, common_1.Get)('channels/:id/videos'),
    (0, swagger_1.ApiOperation)({ summary: 'List videos from a YouTube channel' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of videos',
        schema: {
            example: {
                channel: {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
                    title: 'Google Developers',
                },
                data: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440001',
                        videoId: 'dQw4w9WgXcQ',
                        title: 'Amazing Video Title',
                        description: 'First 500 chars of description...',
                        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
                        duration: 'PT4M20S',
                        publishedAt: '2024-01-15T10:00:00.000Z',
                    },
                ],
                meta: {
                    page: 1,
                    limit: 20,
                    total: 150,
                    totalPages: 8,
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
], YouTubeController.prototype, "getChannelVideos", null);
__decorate([
    (0, common_1.Get)('quota'),
    (0, swagger_1.ApiOperation)({ summary: 'Get YouTube API quota usage' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Quota usage',
        schema: {
            example: {
                used: 1500,
                limit: 10000,
                percentage: 15,
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], YouTubeController.prototype, "getQuotaUsage", null);
exports.YouTubeController = YouTubeController = __decorate([
    (0, swagger_1.ApiTags)('youtube'),
    (0, common_1.Controller)('youtube'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [youtube_service_1.YouTubeService,
        youtube_api_service_1.YouTubeApiService])
], YouTubeController);
//# sourceMappingURL=youtube.controller.js.map