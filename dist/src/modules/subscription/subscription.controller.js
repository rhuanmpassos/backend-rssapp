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
exports.SubscriptionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const subscription_service_1 = require("./subscription.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const create_site_subscription_dto_1 = require("./dto/create-site-subscription.dto");
const create_youtube_subscription_dto_1 = require("./dto/create-youtube-subscription.dto");
let SubscriptionController = class SubscriptionController {
    constructor(subscriptionService) {
        this.subscriptionService = subscriptionService;
    }
    async subscribeSite(user, dto) {
        return this.subscriptionService.createSiteSubscription(user.id, dto);
    }
    async subscribeYouTube(user, dto) {
        return this.subscriptionService.createYouTubeSubscription(user.id, dto);
    }
    async listSubscriptions(user, page, limit, type) {
        return this.subscriptionService.getUserSubscriptions(user.id, page || 1, limit || 20, type);
    }
    async getSubscription(user, id) {
        return this.subscriptionService.getSubscriptionById(user.id, id);
    }
    async toggleSubscription(user, id) {
        return this.subscriptionService.toggleSubscription(user.id, id);
    }
    async deleteSubscription(user, id) {
        return this.subscriptionService.deleteSubscription(user.id, id);
    }
};
exports.SubscriptionController = SubscriptionController;
__decorate([
    (0, common_1.Post)('site'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Subscribe to a website/RSS feed' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Subscription created successfully',
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                type: 'site',
                target: 'https://example.com',
                enabled: true,
                createdAt: '2024-01-15T10:30:00.000Z',
                feed: {
                    id: '550e8400-e29b-41d4-a716-446655440002',
                    title: 'Example Site',
                    siteDomain: 'example.com',
                    rssUrl: 'https://example.com/feed.xml',
                    status: 'active',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid URL or already subscribed' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_site_subscription_dto_1.CreateSiteSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "subscribeSite", null);
__decorate([
    (0, common_1.Post)('youtube'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Subscribe to a YouTube channel' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Subscription created successfully',
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                type: 'youtube',
                target: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
                enabled: true,
                createdAt: '2024-01-15T10:30:00.000Z',
                channel: {
                    id: '550e8400-e29b-41d4-a716-446655440003',
                    channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
                    title: 'Google Developers',
                    thumbnailUrl: 'https://yt3.ggpht.com/...',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'YouTube channel not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_youtube_subscription_dto_1.CreateYouTubeSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "subscribeYouTube", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all user subscriptions' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'type', required: false, enum: ['site', 'youtube'] }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of subscriptions',
        schema: {
            example: {
                data: [
                    {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        type: 'site',
                        target: 'https://example.com',
                        enabled: true,
                        feed: { title: 'Example Site' },
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
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number, String]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "listSubscriptions", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific subscription' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Subscription not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "getSubscription", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle subscription enabled/disabled' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription toggled' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "toggleSubscription", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a subscription' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Subscription not found' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "deleteSubscription", null);
exports.SubscriptionController = SubscriptionController = __decorate([
    (0, swagger_1.ApiTags)('subscriptions'),
    (0, common_1.Controller)('subscriptions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [subscription_service_1.SubscriptionService])
], SubscriptionController);
//# sourceMappingURL=subscription.controller.js.map