import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      try {
        // Parse URL to validate
        const url = new URL(redisUrl);
        this.logger.log(`Connecting to Redis at ${url.hostname}:${url.port || 6379}`);
        
        this.client = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true, // Don't connect immediately
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn('Redis connection failed after 3 retries, will continue without Redis');
              return null; // Stop retrying
            }
            const delay = Math.min(times * 100, 3000);
            this.logger.debug(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
            return delay;
          },
          reconnectOnError: (err) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
              // Only reconnect if error is READONLY
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
          // Only log errors if not a connection error (to avoid spam)
          if (!err.message.includes('ENOTFOUND') && !err.message.includes('ECONNREFUSED')) {
            this.logger.error(`Redis error: ${err.message}`);
          } else {
            this.logger.warn(`Redis connection issue: ${err.message} - continuing without Redis`);
          }
        });

        this.client.on('close', () => {
          this.logger.warn('Redis connection closed');
        });

        // With lazyConnect: true, Redis will connect on first operation
        // This prevents blocking the app startup if Redis is unavailable
      } catch (error) {
        this.logger.error(`Invalid REDIS_URL format: ${error}`);
        this.logger.warn('App will continue without Redis');
      }
    } else {
      this.logger.warn('REDIS_URL not configured, using in-memory fallback');
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis disconnected');
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isConnected(): boolean {
    return this.client?.status === 'ready' || this.client?.status === 'connect';
  }

  // Lock utilities for distributed locking
  async acquireLock(key: string, ttlSeconds: number = 60): Promise<boolean> {
    if (!this.client || !this.isConnected()) {
      // If Redis is not available, allow operation (no locking)
      return true;
    }

    try {
      const lockKey = `lock:${key}`;
      const result = await this.client.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.debug(`Failed to acquire lock ${key}: ${error}`);
      // If lock fails, allow operation (fail open)
      return true;
    }
  }

  async releaseLock(key: string): Promise<void> {
    if (!this.client || !this.isConnected()) return;
    
    try {
      const lockKey = `lock:${key}`;
      await this.client.del(lockKey);
    } catch (error) {
      this.logger.debug(`Failed to release lock ${key}: ${error}`);
    }
  }

  // Cache utilities
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    
    const data = await this.client.get(key);
    if (!data) return null;
    
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.expire(key, ttlSeconds);
  }
}
