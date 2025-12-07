/**
 * Application Configuration
 * 
 * Detects environment and returns appropriate configuration values.
 * - In development (NODE_ENV !== 'production'): uses external database URL
 * - In production: uses internal database URL (faster within Render)
 */

export const isDevelopment = process.env.NODE_ENV !== 'production';
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get the appropriate database URL based on environment
 * 
 * In development: uses DATABASE_URL_DEV or DATABASE_URL
 * In production: uses DATABASE_URL (should be internal Render URL)
 */
export function getDatabaseUrl(): string {
  if (isDevelopment) {
    // In dev, prefer DATABASE_URL_DEV if set, otherwise fall back to DATABASE_URL
    return process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || '';
  }

  // In production, use DATABASE_URL (internal Render URL)
  return process.env.DATABASE_URL || '';
}

/**
 * Configuration object with all environment-specific settings
 */
export const config = {
  isDevelopment,
  isProduction,

  // Database
  databaseUrl: getDatabaseUrl(),

  // Server
  port: parseInt(process.env.PORT || '3000', 10),

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Redis
  redisUrl: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,

  // YouTube API
  youtubeApiKey: process.env.YOUTUBE_API_KEY,

  // Push notifications
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
};

export default config;
