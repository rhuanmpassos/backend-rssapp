"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const scraper_service_1 = require("./scraper.service");
const rss_parser_service_1 = require("./rss-parser.service");
const playwright_service_1 = require("./playwright.service");
const robots_service_1 = require("./robots.service");
const scraper_controller_1 = require("./scraper.controller");
const feed_module_1 = require("../modules/feed/feed.module");
const push_module_1 = require("../modules/push/push.module");
let ScraperModule = class ScraperModule {
};
exports.ScraperModule = ScraperModule;
exports.ScraperModule = ScraperModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, (0, common_1.forwardRef)(() => feed_module_1.FeedModule), push_module_1.PushModule],
        controllers: [scraper_controller_1.ScraperController],
        providers: [scraper_service_1.ScraperService, rss_parser_service_1.RssParserService, playwright_service_1.PlaywrightService, robots_service_1.RobotsService],
        exports: [scraper_service_1.ScraperService, rss_parser_service_1.RssParserService, playwright_service_1.PlaywrightService],
    })
], ScraperModule);
//# sourceMappingURL=scraper.module.js.map