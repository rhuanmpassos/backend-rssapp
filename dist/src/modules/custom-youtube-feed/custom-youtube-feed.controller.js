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
exports.CustomYouTubeFeedController = void 0;
const common_1 = require("@nestjs/common");
const custom_youtube_feed_service_1 = require("./custom-youtube-feed.service");
const create_custom_youtube_feed_dto_1 = require("./dto/create-custom-youtube-feed.dto");
const update_custom_youtube_feed_dto_1 = require("./dto/update-custom-youtube-feed.dto");
const public_decorator_1 = require("../auth/decorators/public.decorator");
let CustomYouTubeFeedController = class CustomYouTubeFeedController {
    constructor(customYouTubeFeedService) {
        this.customYouTubeFeedService = customYouTubeFeedService;
    }
    create(dto) {
        return this.customYouTubeFeedService.create(dto);
    }
    backfillChannelNames() {
        return this.customYouTubeFeedService.backfillChannelNames();
    }
    findAll() {
        return this.customYouTubeFeedService.findAll();
    }
    findPublicFeeds() {
        return this.customYouTubeFeedService.findPublicFeeds();
    }
    searchPublicFeeds(query) {
        return this.customYouTubeFeedService.searchPublicFeeds(query);
    }
    findOne(slug) {
        return this.customYouTubeFeedService.findOne(slug);
    }
    async getRssXml(slug, res) {
        try {
            const xml = await this.customYouTubeFeedService.getRssXml(slug);
            res.setHeader('Content-Type', 'application/xml');
            res.send(xml);
        }
        catch (error) {
            res.status(404).json({ message: 'Feed not found' });
        }
    }
    update(id, dto) {
        return this.customYouTubeFeedService.update(id, dto);
    }
    delete(id) {
        return this.customYouTubeFeedService.delete(id);
    }
};
exports.CustomYouTubeFeedController = CustomYouTubeFeedController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_custom_youtube_feed_dto_1.CreateCustomYouTubeFeedDto]),
    __metadata("design:returntype", void 0)
], CustomYouTubeFeedController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('backfill-channel-names'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomYouTubeFeedController.prototype, "backfillChannelNames", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomYouTubeFeedController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('public'),
    (0, public_decorator_1.Public)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomYouTubeFeedController.prototype, "findPublicFeeds", null);
__decorate([
    (0, common_1.Get)('public/search'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomYouTubeFeedController.prototype, "searchPublicFeeds", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomYouTubeFeedController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':slug/rss.xml'),
    (0, public_decorator_1.Public)(),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CustomYouTubeFeedController.prototype, "getRssXml", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_custom_youtube_feed_dto_1.UpdateCustomYouTubeFeedDto]),
    __metadata("design:returntype", void 0)
], CustomYouTubeFeedController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CustomYouTubeFeedController.prototype, "delete", null);
exports.CustomYouTubeFeedController = CustomYouTubeFeedController = __decorate([
    (0, common_1.Controller)('custom-youtube-feeds'),
    __metadata("design:paramtypes", [custom_youtube_feed_service_1.CustomYouTubeFeedService])
], CustomYouTubeFeedController);
//# sourceMappingURL=custom-youtube-feed.controller.js.map