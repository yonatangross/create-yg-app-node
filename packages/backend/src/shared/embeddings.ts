/**
 * Cached Embeddings Service
 *
 * Redis-cached embeddings to reduce API costs by ~80%.
 * Uses SHA256 hash for cache keys with configurable TTL.
 *
 * Production-ready pattern for LLM cost optimization.
 */

import { createHash } from 'crypto';
import { Redis } from 'ioredis';
import type { OpenAIEmbeddings } from '@langchain/openai';
import { getEmbeddings } from '../core/models.js';
import { getConfig } from '../core/config.js';
import { getLogger } from '../core/logger.js';

const logger = getLogger();

/**
 * Redis client for caching
 */
let redisClient: Redis | null = null;

/**
 * Get Redis client (lazy initialization)
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    const config = getConfig();
    redisClient = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > config.REDIS_MAX_RETRIES) {
          logger.warn('Redis connection failed, disabling cache');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('error', (error: Error) => {
      logger.error({ error }, 'Redis error');
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected for embeddings cache');
    });
  }

  return redisClient;
}

/**
 * Cached embeddings service
 */
export class CachedEmbeddingsService {
  private embeddings: OpenAIEmbeddings;
  private redis: Redis | null;
  private ttl: number;
  private keyPrefix: string;

  /**
   * @param ttl - Cache TTL in seconds (default: 24 hours)
   * @param keyPrefix - Cache key prefix (default: 'embed')
   */
  constructor(ttl = 86400, keyPrefix = 'embed') {
    this.embeddings = getEmbeddings();
    this.ttl = ttl;
    this.keyPrefix = keyPrefix;

    try {
      this.redis = getRedisClient();
    } catch (error) {
      logger.warn(
        { error },
        'Redis unavailable, embeddings will not be cached'
      );
      this.redis = null;
    }
  }

  /**
   * Generate cache key from text using SHA256
   */
  private getCacheKey(text: string): string {
    const hash = createHash('sha256').update(text).digest('hex');
    return `${this.keyPrefix}:${hash}`;
  }

  /**
   * Embed a single query with caching
   *
   * @param text - Text to embed
   * @returns Embedding vector
   */
  async embedQuery(text: string): Promise<number[]> {
    const key = this.getCacheKey(text);

    // Try cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          logger.debug({ key }, 'Embedding cache hit');
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.error({ error, key }, 'Cache read error');
      }
    }

    // Generate embedding
    logger.debug({ key }, 'Embedding cache miss');
    const embedding = await this.embeddings.embedQuery(text);

    // Cache result
    if (this.redis) {
      try {
        await this.redis.setex(key, this.ttl, JSON.stringify(embedding));
      } catch (error) {
        logger.error({ error, key }, 'Cache write error');
      }
    }

    return embedding;
  }

  /**
   * Embed multiple documents with caching
   *
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Check cache for all texts
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];

    if (this.redis) {
      try {
        const keys = texts.map((text) => this.getCacheKey(text));
        const cachedValues = await this.redis.mget(...keys);

        cachedValues.forEach((value: string | null, index: number) => {
          if (value) {
            results[index] = JSON.parse(value);
          } else {
            uncachedIndices.push(index);
          }
        });

        logger.debug(
          {
            total: texts.length,
            cached: texts.length - uncachedIndices.length,
            uncached: uncachedIndices.length,
          },
          'Batch embedding cache lookup'
        );
      } catch (error) {
        logger.error({ error }, 'Batch cache read error');
        // Fallback: all texts are uncached
        uncachedIndices.push(...texts.map((_, i) => i));
      }
    } else {
      // No cache: all texts are uncached
      uncachedIndices.push(...texts.map((_, i) => i));
    }

    // Embed uncached texts
    if (uncachedIndices.length > 0) {
      const uncachedTexts = uncachedIndices
        .map((i) => texts[i])
        .filter((t): t is string => t !== undefined);
      const newEmbeddings = await this.embeddings.embedDocuments(uncachedTexts);

      // Store in results and cache
      const cacheOps: Promise<unknown>[] = [];

      uncachedIndices.forEach((index, i) => {
        const embedding = newEmbeddings[i];
        const text = texts[index];
        if (embedding && text) {
          results[index] = embedding;
        }

        // Cache new embeddings
        if (this.redis && embedding && text) {
          const key = this.getCacheKey(text);
          cacheOps.push(
            this.redis
              .setex(key, this.ttl, JSON.stringify(embedding))
              .catch((error: Error) => {
                logger.error({ error, key }, 'Cache write error');
              })
          );
        }
      });

      // Write to cache in parallel (fire and forget)
      if (cacheOps.length > 0) {
        Promise.all(cacheOps).catch(() => {
          // Already logged in individual ops
        });
      }
    }

    return results as number[][];
  }

  /**
   * Clear embedding cache (optional: by prefix or pattern)
   *
   * @param pattern - Optional pattern to match keys (default: all with prefix)
   */
  async clearCache(pattern?: string): Promise<number> {
    if (!this.redis) {
      logger.warn('Redis unavailable, cannot clear cache');
      return 0;
    }

    try {
      const searchPattern = pattern || `${this.keyPrefix}:*`;
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          searchPattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      logger.info({ deletedCount, pattern: searchPattern }, 'Cache cleared');
      return deletedCount;
    } catch (error) {
      logger.error({ error }, 'Cache clear error');
      return 0;
    }
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{
    enabled: boolean;
    keyCount: number;
  }> {
    if (!this.redis) {
      return { enabled: false, keyCount: 0 };
    }

    try {
      let keyCount = 0;
      let cursor = '0';

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.keyPrefix}:*`,
          'COUNT',
          100
        );
        cursor = newCursor;
        keyCount += keys.length;
      } while (cursor !== '0');

      return { enabled: true, keyCount };
    } catch (error) {
      logger.error({ error }, 'Cache stats error');
      return { enabled: true, keyCount: -1 };
    }
  }
}

/**
 * Singleton instance
 */
let cachedEmbeddingsInstance: CachedEmbeddingsService | null = null;

/**
 * Get cached embeddings service instance
 */
export function getCachedEmbeddings(): CachedEmbeddingsService {
  if (!cachedEmbeddingsInstance) {
    cachedEmbeddingsInstance = new CachedEmbeddingsService();
  }
  return cachedEmbeddingsInstance;
}

/**
 * Shutdown Redis connection
 */
export async function shutdownEmbeddingsCache(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Embeddings cache Redis connection closed');
  }
}
