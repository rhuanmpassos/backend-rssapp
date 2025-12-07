"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.isProduction = exports.isDevelopment = void 0;
exports.getDatabaseUrl = getDatabaseUrl;
exports.isDevelopment = process.env.NODE_ENV !== 'production';
exports.isProduction = process.env.NODE_ENV === 'production';
function getDatabaseUrl() {
    if (exports.isDevelopment) {
        return process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || '';
    }
    return process.env.DATABASE_URL || '';
}
exports.config = {
    isDevelopment: exports.isDevelopment,
    isProduction: exports.isProduction,
    databaseUrl: getDatabaseUrl(),
    port: parseInt(process.env.PORT || '3000', 10),
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    redisUrl: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
    redisToken: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    youtubeApiKey: process.env.YOUTUBE_API_KEY,
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
};
exports.default = exports.config;
//# sourceMappingURL=index.js.map