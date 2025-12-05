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
var WebSubController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSubController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const websub_service_1 = require("./websub.service");
let WebSubController = WebSubController_1 = class WebSubController {
    constructor(websubService) {
        this.websubService = websubService;
        this.logger = new common_1.Logger(WebSubController_1.name);
    }
    async verifyCallback(topic, challenge, mode, leaseSeconds, verifyToken, res) {
        this.logger.log(`WebSub verification: mode=${mode}, topic=${topic}`);
        const result = await this.websubService.verifyIntent(topic, challenge, mode, leaseSeconds ? parseInt(leaseSeconds, 10) : undefined, verifyToken);
        if (result) {
            res.status(200).send(result);
        }
        else {
            res.status(404).send('Not Found');
        }
    }
    async receiveNotification(req, signature, body) {
        this.logger.log('WebSub notification received');
        let rawBody;
        if (typeof body === 'string') {
            rawBody = body;
        }
        else if (Buffer.isBuffer(body)) {
            rawBody = body.toString('utf-8');
        }
        else {
            rawBody = JSON.stringify(body);
        }
        const result = await this.websubService.handleNotification(rawBody, signature);
        return result;
    }
    async manualSubscribe(channelId) {
        return this.websubService.subscribeToChannel(channelId);
    }
    async renewSubscriptions() {
        return this.websubService.renewExpiringSubscriptions();
    }
};
exports.WebSubController = WebSubController;
__decorate([
    (0, common_1.Get)('callback'),
    (0, swagger_1.ApiOperation)({ summary: 'WebSub verification callback (hub.challenge)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns hub.challenge for verification',
        schema: {
            type: 'string',
            example: 'challenge_string_from_hub',
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Subscription not found or invalid' }),
    __param(0, (0, common_1.Query)('hub.topic')),
    __param(1, (0, common_1.Query)('hub.challenge')),
    __param(2, (0, common_1.Query)('hub.mode')),
    __param(3, (0, common_1.Query)('hub.lease_seconds')),
    __param(4, (0, common_1.Query)('hub.verify_token')),
    __param(5, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Object]),
    __metadata("design:returntype", Promise)
], WebSubController.prototype, "verifyCallback", null);
__decorate([
    (0, common_1.Post)('callback'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'WebSub notification callback (receives new video notifications)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Notification processed',
        schema: {
            example: { success: true, videosProcessed: 1 },
        },
    }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-hub-signature')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], WebSubController.prototype, "receiveNotification", null);
__decorate([
    (0, common_1.Post)('subscribe'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiExcludeEndpoint)(),
    __param(0, (0, common_1.Body)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WebSubController.prototype, "manualSubscribe", null);
__decorate([
    (0, common_1.Post)('renew'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiExcludeEndpoint)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WebSubController.prototype, "renewSubscriptions", null);
exports.WebSubController = WebSubController = WebSubController_1 = __decorate([
    (0, swagger_1.ApiTags)('websub'),
    (0, common_1.Controller)('websub'),
    __metadata("design:paramtypes", [websub_service_1.WebSubService])
], WebSubController);
//# sourceMappingURL=websub.controller.js.map