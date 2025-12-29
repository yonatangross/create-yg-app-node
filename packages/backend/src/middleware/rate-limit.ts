/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse using rate-limiter-flexible.
 * Implements sliding window rate limiting with Redis backend.
 *
 * Production patterns:
 * - Per-IP rate limiting
 * - Different limits for different endpoint types
 * - Graceful degradation if Redis is unavailable
 */

import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import type { Context, Next } from 'hono';
import { Redis } from 'ioredis';
import { getConfig } from '../core/config.js';
import { getLogger } from '../core/logger.js';

const logger = getLogger();

/**
 * Rate limiter instances cache
 */
const rateLimiters = new Map<string, RateLimiterMemory | RateLimiterRedis>();

/**
 * Redis client for rate limiting (shared instance)
 */
let redisClient: Redis | null = null;

/**
 * Rate limit configuration presets
 */
export const RATE_LIMIT_PRESETS = {
  // Chat endpoints - moderate limits
  CHAT: {
    points: 20, // 20 requests
    duration: 60, // per minute
    blockDuration: 60, // block for 1 minute if exceeded
  },

  // RAG endpoints - stricter limits (more expensive)
  RAG: {
    points: 10, // 10 requests
    duration: 60, // per minute
    blockDuration: 120, // block for 2 minutes if exceeded
  },

  // Health checks - very lenient
  HEALTH: {
    points: 100,
    duration: 60,
    blockDuration: 0,
  },

  // General API - balanced limits
  API: {
    points: 50,
    duration: 60,
    blockDuration: 60,
  },

  // Admin endpoints - strict limits
  ADMIN: {
    points: 5,
    duration: 60,
    blockDuration: 300, // block for 5 minutes
  },
} as const;

/**
 * Rate limit preset types
 */
export type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;

/**
 * Get or create Redis client for rate limiting
 */
function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const config = getConfig();

  if (!config.REDIS_URL) {
    logger.warn('REDIS_URL not configured, using in-memory rate limiting');
    return null;
  }

  try {
    redisClient = new Redis(config.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed for rate limiter, falling back to memory');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('error', (error: Error) => {
      logger.error({ error }, 'Redis rate limiter error');
    });

    logger.info('Redis rate limiter initialized');
    return redisClient;
  } catch (error) {
    logger.error({ error }, 'Failed to create Redis client for rate limiter');
    return null;
  }
}

/**
 * Get or create rate limiter instance
 *
 * @param name - Unique name for this rate limiter
 * @param preset - Rate limit preset to use
 * @returns Rate limiter instance
 */
function getRateLimiter(
  name: string,
  preset: RateLimitPreset
): RateLimiterMemory | RateLimiterRedis {
  const cacheKey = `${name}:${preset}`;

  if (rateLimiters.has(cacheKey)) {
    return rateLimiters.get(cacheKey)!;
  }

  const config = RATE_LIMIT_PRESETS[preset];
  const redis = getRedisClient();

  let limiter: RateLimiterMemory | RateLimiterRedis;

  if (redis) {
    // Use Redis-backed rate limiter (shared across instances)
    limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: `rl:${name}`,
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration,
    });
    logger.debug({ name, preset, backend: 'redis' }, 'Rate limiter created');
  } else {
    // Fallback to in-memory (single instance only)
    limiter = new RateLimiterMemory({
      keyPrefix: name,
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration,
    });
    logger.debug({ name, preset, backend: 'memory' }, 'Rate limiter created (fallback)');
  }

  rateLimiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Extract client identifier from request
 *
 * Priority: X-Forwarded-For > X-Real-IP > Remote Address
 *
 * @param c - Hono context
 * @returns Client IP or identifier
 */
function getClientIdentifier(c: Context): string {
  // Check X-Forwarded-For (proxy/load balancer)
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP if multiple proxies
    const firstIp = forwardedFor.split(',')[0];
    return firstIp ? firstIp.trim() : 'unknown';
  }

  // Check X-Real-IP
  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to remote address (may not be available in all environments)
  return 'unknown';
}

/**
 * Create rate limiting middleware
 *
 * @param preset - Rate limit preset to apply
 * @param options - Optional configuration
 * @returns Hono middleware
 *
 * @example
 * ```typescript
 * app.post('/api/chat',
 *   rateLimitMiddleware('CHAT'),
 *   async (c) => { ... }
 * );
 * ```
 */
export function rateLimitMiddleware(
  preset: RateLimitPreset,
  options?: {
    keyGenerator?: (c: Context) => string;
    skipFailedRequests?: boolean;
  }
) {
  const limiter = getRateLimiter(preset.toLowerCase(), preset);
  const keyGenerator = options?.keyGenerator || getClientIdentifier;

  return async (c: Context, next: Next) => {
    const key = keyGenerator(c);

    try {
      // Consume 1 point
      const rateLimiterRes: RateLimiterRes = await limiter.consume(key, 1);

      // Add rate limit headers
      c.header('X-RateLimit-Limit', String(RATE_LIMIT_PRESETS[preset].points));
      c.header('X-RateLimit-Remaining', String(rateLimiterRes.remainingPoints));
      c.header('X-RateLimit-Reset', String(new Date(Date.now() + (rateLimiterRes.msBeforeNext || 0)).toISOString()));

      return await next();
    } catch (error) {
      // Rate limit exceeded
      if (error instanceof RateLimiterRes || (error instanceof Error && 'msBeforeNext' in error)) {
        const rateLimitError = error as unknown as RateLimiterRes;
        const retryAfter = Math.ceil((rateLimitError.msBeforeNext || 0) / 1000);

        logger.warn(
          {
            key,
            preset,
            retryAfter,
          },
          'Rate limit exceeded'
        );

        c.header('Retry-After', String(retryAfter));
        c.header('X-RateLimit-Limit', String(RATE_LIMIT_PRESETS[preset].points));
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', String(new Date(Date.now() + (rateLimitError.msBeforeNext || 0)).toISOString()));

        return c.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
              retryAfter,
            },
          },
          429
        );
      }

      // Other errors (e.g., Redis down) - allow request through but log
      logger.error({ error, key, preset }, 'Rate limiter error - allowing request');
      return await next();
    }
  };
}

/**
 * Create custom rate limiter with specific configuration
 *
 * @param name - Unique name for the limiter
 * @param config - Rate limit configuration
 * @returns Middleware function
 */
export function customRateLimit(
  name: string,
  config: {
    points: number;
    duration: number;
    blockDuration?: number;
  }
) {
  const redis = getRedisClient();

  const limiter = redis
    ? new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: `rl:${name}`,
        ...config,
      })
    : new RateLimiterMemory({
        keyPrefix: name,
        ...config,
      });

  return async (c: Context, next: Next) => {
    const key = getClientIdentifier(c);

    try {
      const rateLimiterRes = await limiter.consume(key, 1);

      c.header('X-RateLimit-Limit', String(config.points));
      c.header('X-RateLimit-Remaining', String(rateLimiterRes.remainingPoints));

      return await next();
    } catch (error) {
      if (error instanceof RateLimiterRes || (error instanceof Error && 'msBeforeNext' in error)) {
        const rateLimitError = error as unknown as RateLimiterRes;
        const retryAfter = Math.ceil((rateLimitError.msBeforeNext || 0) / 1000);

        c.header('Retry-After', String(retryAfter));

        return c.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
            },
          },
          429
        );
      }

      logger.error({ error }, 'Rate limiter error - allowing request');
      return await next();
    }
  };
}

/**
 * Shutdown rate limiter (close Redis connection)
 */
export async function shutdownRateLimiter(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Rate limiter Redis connection closed');
  }
  rateLimiters.clear();
}
