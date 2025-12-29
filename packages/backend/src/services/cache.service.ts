/**
 * Cache Service - Type-safe Redis caching layer
 *
 * Production-ready caching with:
 * - MessagePack encoding (30% smaller than JSON)
 * - Automatic TTL management
 * - Pattern-based cache clearing
 * - Graceful degradation on Redis failure
 * - TypeScript type safety
 *
 * Usage:
 *   const user = await cacheService.get<User>('cache:user:123');
 *   await cacheService.set('cache:user:123', user, 3600);
 */

import { getRedis } from '../core/redis.js';
import { getLogger } from '../core/logger.js';
import msgpack from '@msgpack/msgpack';
import type { Redis } from 'ioredis';

const logger = getLogger();

/**
 * Cache service configuration
 */
export interface CacheConfig {
  /**
   * Default TTL in seconds (0 = no expiration)
   */
  defaultTTL?: number;

  /**
   * Use MessagePack encoding (default: true)
   * Set false for debugging (uses JSON instead)
   */
  useMsgpack?: boolean;

  /**
   * Throw errors or return null on failure (default: false)
   */
  throwOnError?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
}

/**
 * Type-safe Redis cache service
 */
export class CacheService {
  private redis: Redis;
  private config: Required<CacheConfig>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    hitRate: 0,
  };

  constructor(config: CacheConfig = {}) {
    this.redis = getRedis();
    this.config = {
      defaultTTL: config.defaultTTL ?? 0,
      useMsgpack: config.useMsgpack ?? true,
      throwOnError: config.throwOnError ?? false,
    };
  }

  /**
   * Get value from cache
   *
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = this.config.useMsgpack
        ? await this.redis.getBuffer(key)
        : await this.redis.get(key);

      if (!data) {
        this.stats.misses++;
        this.updateHitRate();
        logger.debug({ key }, 'Cache miss');
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      logger.debug({ key }, 'Cache hit');

      return this.config.useMsgpack
        ? (msgpack.decode(data as Buffer) as T)
        : (JSON.parse(data as string) as T);
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache get error');

      if (this.config.throwOnError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Set value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - TTL in seconds (overrides default)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl ?? this.config.defaultTTL;

      if (this.config.useMsgpack) {
        const encoded = Buffer.from(msgpack.encode(value));
        if (ttlSeconds > 0) {
          await this.redis.setex(key, ttlSeconds, encoded);
        } else {
          await this.redis.set(key, encoded);
        }
      } else {
        const encoded = JSON.stringify(value);
        if (ttlSeconds > 0) {
          await this.redis.setex(key, ttlSeconds, encoded);
        } else {
          await this.redis.set(key, encoded);
        }
      }

      logger.debug({ key, ttl: ttlSeconds }, 'Cache set');
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache set error');

      if (this.config.throwOnError) {
        throw error;
      }
    }
  }

  /**
   * Get multiple values from cache
   *
   * @param keys - Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    try {
      const values = this.config.useMsgpack
        ? await this.redis.mgetBuffer(...keys)
        : await this.redis.mget(...keys);

      return values.map((value, index) => {
        if (!value) {
          this.stats.misses++;
          logger.debug({ key: keys[index] }, 'Cache miss');
          return null;
        }

        this.stats.hits++;
        logger.debug({ key: keys[index] }, 'Cache hit');

        return this.config.useMsgpack
          ? (msgpack.decode(value as Buffer) as T)
          : (JSON.parse(value as string) as T);
      });
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, keys }, 'Cache mget error');

      if (this.config.throwOnError) {
        throw error;
      }
      return keys.map(() => null);
    } finally {
      this.updateHitRate();
    }
  }

  /**
   * Delete key(s) from cache
   *
   * @param keys - Single key or array of keys
   * @returns Number of keys deleted
   */
  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    try {
      const deleted = await this.redis.del(...keys);
      logger.debug({ keys, deleted }, 'Cache delete');
      return deleted;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, keys }, 'Cache delete error');

      if (this.config.throwOnError) {
        throw error;
      }
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   *
   * @param key - Cache key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache exists error');

      if (this.config.throwOnError) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Set expiration time for key
   *
   * @param key - Cache key
   * @param ttl - TTL in seconds
   * @returns True if expiration was set
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key, ttl }, 'Cache expire error');

      if (this.config.throwOnError) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   *
   * @param key - Cache key
   * @returns Seconds until expiration (-1 = no expiration, -2 = key not found)
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key }, 'Cache ttl error');

      if (this.config.throwOnError) {
        throw error;
      }
      return -2;
    }
  }

  /**
   * Clear cache by pattern
   *
   * Uses SCAN to find matching keys and deletes them.
   * Safe for production (non-blocking).
   *
   * @param pattern - Redis pattern (e.g., 'cache:user:*')
   * @returns Number of keys deleted
   */
  async clear(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      logger.info({ pattern, deletedCount }, 'Cache cleared');
      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, pattern }, 'Cache clear error');

      if (this.config.throwOnError) {
        throw error;
      }
      return 0;
    }
  }

  /**
   * Increment numeric value
   *
   * @param key - Cache key
   * @param amount - Amount to increment (default: 1)
   * @returns New value after increment
   */
  async increment(key: string, amount = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, amount);
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key, amount }, 'Cache increment error');

      if (this.config.throwOnError) {
        throw error;
      }
      return 0;
    }
  }

  /**
   * Decrement numeric value
   *
   * @param key - Cache key
   * @param amount - Amount to decrement (default: 1)
   * @returns New value after decrement
   */
  async decrement(key: string, amount = 1): Promise<number> {
    try {
      return await this.redis.decrby(key, amount);
    } catch (error) {
      this.stats.errors++;
      logger.error({ error, key, amount }, 'Cache decrement error');

      if (this.config.throwOnError) {
        throw error;
      }
      return 0;
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Hit rate, miss rate, error count
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Singleton cache service instance
 */
export const cacheService = new CacheService({
  defaultTTL: 3600, // 1 hour
  useMsgpack: true,
  throwOnError: false,
});

/**
 * Cache service for embeddings (24-hour TTL)
 */
export const embeddingsCacheService = new CacheService({
  defaultTTL: 86400, // 24 hours
  useMsgpack: true,
  throwOnError: false,
});
