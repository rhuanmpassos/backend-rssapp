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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_service_1 = require("./admin.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let AdminController = class AdminController {
    constructor(adminService) {
        this.adminService = adminService;
    }
    async forceScrape(id) {
        return this.adminService.forceScrape(id);
    }
    async forceCheckYouTube(id) {
        return this.adminService.forceCheckYouTube(id);
    }
    async getStats() {
        return this.adminService.getStats();
    }
    async getRecentJobs(limit) {
        return this.adminService.getRecentJobs(limit || 50);
    }
    async getErrorFeeds() {
        return this.adminService.getErrorFeeds();
    }
    async resetFeedStatus(id) {
        return this.adminService.resetFeedStatus(id);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Post)('feed/:id/force-scrape'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Force scrape a specific feed' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Scrape job queued',
        schema: {
            example: {
                message: 'Scrape job queued',
                jobId: '550e8400-e29b-41d4-a716-446655440000',
                feedId: '550e8400-e29b-41d4-a716-446655440001',
                feedUrl: 'https://example.com',
            },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "forceScrape", null);
__decorate([
    (0, common_1.Post)('youtube/:id/force-check'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Force check a YouTube channel for new videos' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Channel checked',
        schema: {
            example: {
                message: 'YouTube channel checked',
                jobId: '550e8400-e29b-41d4-a716-446655440000',
                channelId: '550e8400-e29b-41d4-a716-446655440001',
                channelTitle: 'Google Developers',
                created: 3,
                skipped: 0,
            },
        },
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "forceCheckYouTube", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get system statistics' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'System stats',
        schema: {
            example: {
                users: 150,
                subscriptions: 1200,
                feeds: {
                    total: 300,
                    active: 280,
                    error: 20,
                    items: 15000,
                },
                youtube: {
                    channels: 100,
                    videos: 5000,
                },
                jobs: {
                    pending: 5,
                },
            },
        },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('jobs'),
    (0, swagger_1.ApiOperation)({ summary: 'Get recent job logs' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getRecentJobs", null);
__decorate([
    (0, common_1.Get)('feeds/errors'),
    (0, swagger_1.ApiOperation)({ summary: 'Get feeds with errors' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getErrorFeeds", null);
__decorate([
    (0, common_1.Patch)('feed/:id/reset'),
    (0, swagger_1.ApiOperation)({ summary: 'Reset feed status to pending' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "resetFeedStatus", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map