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
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
let RedisService = RedisService_1 = class RedisService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(RedisService_1.name);
        this.client = null;
        const redisUrl = this.configService.get('REDIS_URL');
        if (redisUrl) {
            try {
                const url = new URL(redisUrl);
                this.logger.log(`Connecting to Redis at ${url.hostname}:${url.port || 6379}`);
                this.client = new ioredis_1.default(redisUrl, {
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    retryStrategy: (times) => {
                        if (times > 3) {
                            this.logger.warn('Redis connection failed after 3 retries, will continue without Redis');
                            return null;
                        }
                        const delay = Math.min(times * 100, 3000);
                        this.logger.debug(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
                        return delay;
                    },
                    reconnectOnError: (err) => {
                        const targetError = 'READONLY';
                        if (err.message.includes(targetError)) {
                            return true;
                        }
                        return false;
                    },
                });
                this.client.on('connect', () => {
                    this.logger.log('Redis connected successfully');
                });
                this.client.on('ready', () => {
                    this.logger.log('Redis is ready');
                });
                this.client.on('error', (err) => {
                    if (!err.message.includes('ENOTFOUND') && !err.message.includes('ECONNREFUSED')) {
                        this.logger.error(`Redis error: ${err.message}`);
                    }
                    else {
                        this.logger.warn(`Redis connection issue: ${err.message} - continuing without Redis`);
                    }
                });
                this.client.on('close', () => {
                    this.logger.warn('Redis connection closed');
                });
            }
            catch (error) {
                this.logger.error(`Invalid REDIS_URL format: ${error}`);
                this.logger.warn('App will continue without Redis');
            }
        }
        else {
            this.logger.warn('REDIS_URL not configured, using in-memory fallback');
        }
    }
    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
            this.logger.log('Redis disconnected');
        }
    }
    getClient() {
        return this.client;
    }
    isConnected() {
        return this.client?.status === 'ready' || this.client?.status === 'connect';
    }
    async acquireLock(key, ttlSeconds = 60) {
        if (!this.client || !this.isConnected()) {
            return true;
        }
        try {
            const lockKey = `lock:${key}`;
            const result = await this.client.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
            return result === 'OK';
        }
        catch (error) {
            this.logger.debug(`Failed to acquire lock ${key}: ${error}`);
            return true;
        }
    }
    async releaseLock(key) {
        if (!this.client || !this.isConnected())
            return;
        try {
            const lockKey = `lock:${key}`;
            await this.client.del(lockKey);
        }
        catch (error) {
            this.logger.debug(`Failed to release lock ${key}: ${error}`);
        }
    }
    async get(key) {
        if (!this.client)
            return null;
        const data = await this.client.get(key);
        if (!data)
            return null;
        try {
            return JSON.parse(data);
        }
        catch {
            return data;
        }
    }
    async set(key, value, ttlSeconds) {
        if (!this.client)
            return;
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttlSeconds) {
            await this.client.setex(key, ttlSeconds, serialized);
        }
        else {
            await this.client.set(key, serialized);
        }
    }
    async del(key) {
        if (!this.client)
            return;
        await this.client.del(key);
    }
    async incr(key) {
        if (!this.client)
            return 0;
        return this.client.incr(key);
    }
    async expire(key, ttlSeconds) {
        if (!this.client)
            return;
        await this.client.expire(key, ttlSeconds);
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map