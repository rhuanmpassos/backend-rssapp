"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomYouTubeFeedModule = void 0;
const common_1 = require("@nestjs/common");
const custom_youtube_feed_controller_1 = require("./custom-youtube-feed.controller");
const custom_youtube_feed_service_1 = require("./custom-youtube-feed.service");
const scraper_module_1 = require("../../scraper/scraper.module");
let CustomYouTubeFeedModule = class CustomYouTubeFeedModule {
};
exports.CustomYouTubeFeedModule = CustomYouTubeFeedModule;
exports.CustomYouTubeFeedModule = CustomYouTubeFeedModule = __decorate([
    (0, common_1.Module)({
        imports: [scraper_module_1.ScraperModule],
        controllers: [custom_youtube_feed_controller_1.CustomYouTubeFeedController],
        providers: [custom_youtube_feed_service_1.CustomYouTubeFeedService],
        exports: [custom_youtube_feed_service_1.CustomYouTubeFeedService],
    })
], CustomYouTubeFeedModule);
//# sourceMappingURL=custom-youtube-feed.module.js.map