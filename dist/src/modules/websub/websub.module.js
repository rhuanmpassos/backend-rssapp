"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSubModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const websub_controller_1 = require("./websub.controller");
const websub_service_1 = require("./websub.service");
const youtube_module_1 = require("../youtube/youtube.module");
const push_module_1 = require("../push/push.module");
let WebSubModule = class WebSubModule {
};
exports.WebSubModule = WebSubModule;
exports.WebSubModule = WebSubModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule, youtube_module_1.YouTubeModule, push_module_1.PushModule],
        controllers: [websub_controller_1.WebSubController],
        providers: [websub_service_1.WebSubService],
        exports: [websub_service_1.WebSubService],
    })
], WebSubModule);
//# sourceMappingURL=websub.module.js.map