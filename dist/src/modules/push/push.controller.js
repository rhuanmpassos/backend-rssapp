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
exports.PushController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const push_service_1 = require("./push.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const register_push_token_dto_1 = require("./dto/register-push-token.dto");
let PushController = class PushController {
    constructor(pushService) {
        this.pushService = pushService;
    }
    async registerToken(user, dto) {
        return this.pushService.registerToken(user.id, dto.token, dto.platform);
    }
    async unregisterToken(user, dto) {
        return this.pushService.unregisterToken(user.id, dto.token);
    }
};
exports.PushController = PushController;
__decorate([
    (0, common_1.Post)('register'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Register a push notification token' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Token registered successfully',
        schema: {
            example: {
                id: '550e8400-e29b-41d4-a716-446655440000',
                userId: '550e8400-e29b-41d4-a716-446655440001',
                token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
                platform: 'android',
                isActive: true,
                createdAt: '2024-01-15T10:30:00.000Z',
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid push token' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, register_push_token_dto_1.RegisterPushTokenDto]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "registerToken", null);
__decorate([
    (0, common_1.Delete)('unregister'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Unregister a push notification token' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Token unregistered successfully',
        schema: {
            example: { success: true },
        },
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, register_push_token_dto_1.RegisterPushTokenDto]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "unregisterToken", null);
exports.PushController = PushController = __decorate([
    (0, swagger_1.ApiTags)('push'),
    (0, common_1.Controller)('push'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [push_service_1.PushService])
], PushController);
//# sourceMappingURL=push.controller.js.map