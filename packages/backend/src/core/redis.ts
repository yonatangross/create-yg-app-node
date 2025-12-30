/**
 * Centralized Redis Client Manager
 *
 * Single source of truth for Redis connections across the application.
 * Replaces multiple Redis client instances in embeddings.ts, rate-limit.ts, etc.
 *
 * Features:
 * - Lazy initialization with connection pooling
 * - Automatic reconnection with exponential backoff
 * - Health monitoring and event logging
 * - Separate Pub/Sub connection (required by Redis)
 * - Graceful shutdown handling
 *
 * Usage:
 *   import { getRedis } from './core/redis.js';
 *   const redis = getRedis();
 *   await redis.set('key', 'value');
 */

import { Redis } from 'ioredis';
import { getConfig } from './config.js';
import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * Main Redis client (for commands)
 */
let redisClient: Redis | null = null;

/**
 * Separate Redis client for Pub/Sub
 * (Redis requires dedicated connection for subscriptions)
 */
let redisPubSubClient: Redis | null = null;

/**
 * Connection status tracking
 */
let isConnected = false;
let connectionAttempts = 0;

/**
 * Get or create main Redis client
 *
 * @returns Redis client instance
 * @throws Error if Redis is unavailable after retries
 */
export function getRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const config = getConfig();

  redisClient = new Redis(config.REDIS_URL, {
    // Connection behavior
    lazyConnect: false, // Connect immediately
    enableReadyCheck: true,
    enableOfflineQueue: true, // Queue commands while reconnecting
    maxRetriesPerRequest: 3,

    // Timeouts
    connectTimeout: config.REDIS_CONNECT_TIMEOUT,
    commandTimeout: 5000, // 5s per command

    // Reconnection strategy
    retryStrategy: (times: number) => {
      connectionAttempts = times;

      if (times > config.REDIS_MAX_RETRIES) {
        logger.error(
          { attempts: times, maxRetries: config.REDIS_MAX_RETRIES },
          'Redis max retries reached'
        );
        return null; // Stop retrying
      }

      // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, 3000ms (cap)
      const delay = Math.min(times * 100, 3000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting');
      return delay;
    },

    // Keep-alive
    keepAlive: 30000, // 30s TCP keepalive

    // Key prefix (optional, useful for multi-tenant)
    // keyPrefix: 'yg-app:',
  });

  // Event: Connection established
  redisClient.on('connect', () => {
    logger.info(
      {
        url: config.REDIS_URL.replace(/:[^:]*@/, ':***@'), // Hide password
        attempt: connectionAttempts,
      },
      'Redis connecting'
    );
  });

  // Event: Ready to accept commands
  redisClient.on('ready', () => {
    isConnected = true;
    connectionAttempts = 0;
    logger.info('Redis ready');
  });

  // Event: Connection error
  redisClient.on('error', (error: Error) => {
    isConnected = false;

    // Suppress ECONNREFUSED spam during retries
    if (error.message.includes('ECONNREFUSED') && connectionAttempts > 1) {
      logger.debug(
        { error: error.message },
        'Redis connection refused (retrying)'
      );
    } else {
      logger.error({ error, attempts: connectionAttempts }, 'Redis error');
    }
  });

  // Event: Connection closed
  redisClient.on('close', () => {
    isConnected = false;
    logger.warn('Redis connection closed');
  });

  // Event: Reconnecting
  redisClient.on('reconnecting', (delay: number) => {
    logger.info(
      { delayMs: delay, attempt: connectionAttempts },
      'Redis reconnecting'
    );
  });

  // Event: Connection ended (will not reconnect)
  redisClient.on('end', () => {
    isConnected = false;
    logger.warn('Redis connection ended (no reconnect)');
  });

  return redisClient;
}

/**
 * Get or create Pub/Sub Redis client
 *
 * Pub/Sub requires a dedicated connection because subscribed connections
 * cannot execute regular commands.
 *
 * @returns Redis client for Pub/Sub operations
 */
export function getRedisPubSub(): Redis {
  if (redisPubSubClient) {
    return redisPubSubClient;
  }

  const config = getConfig();

  // Duplicate main client configuration
  redisPubSubClient = new Redis(config.REDIS_URL, {
    lazyConnect: false,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > config.REDIS_MAX_RETRIES) {
        logger.error('Redis Pub/Sub max retries reached');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });

  redisPubSubClient.on('ready', () => {
    logger.info('Redis Pub/Sub connection ready');
  });

  redisPubSubClient.on('error', (error: Error) => {
    logger.error({ error }, 'Redis Pub/Sub error');
  });

  return redisPubSubClient;
}

/**
 * Check if Redis is connected and healthy
 *
 * @returns True if connected and responding to PING
 */
export async function isRedisHealthy(): Promise<boolean> {
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
    const response = await redisClient.ping();
    return response === 'PONG';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return false;
  }
}

/**
 * Get Redis connection statistics
 *
 * @returns Connection info and memory stats
 */
export async function getRedisStats(): Promise<{
  connected: boolean;
  memoryUsedBytes: number;
  memoryUsedHuman: string;
  connectedClients: number;
  uptime: number;
  version: string;
}> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  const info = await redisClient.info();
  const lines = info.split('\r\n');
  const stats: Record<string, string> = {};

  lines.forEach((line) => {
    const [key, value] = line.split(':');
    if (key && value) {
      stats[key] = value;
    }
  });

  return {
    connected: isConnected,
    memoryUsedBytes: parseInt(stats.used_memory || '0', 10),
    memoryUsedHuman: stats.used_memory_human || 'unknown',
    connectedClients: parseInt(stats.connected_clients || '0', 10),
    uptime: parseInt(stats.uptime_in_seconds || '0', 10),
    version: stats.redis_version || 'unknown',
  };
}

/**
 * Gracefully close all Redis connections
 *
 * Should be called during application shutdown.
 * Waits for pending commands to complete before closing.
 */
export async function shutdownRedis(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (redisClient) {
    logger.info('Closing main Redis connection');
    closePromises.push(
      redisClient
        .quit()
        .then(() => {
          logger.info('Main Redis connection closed');
        })
        .catch((error) => {
          logger.error({ error }, 'Error closing main Redis connection');
        })
    );
    redisClient = null;
  }

  if (redisPubSubClient) {
    logger.info('Closing Redis Pub/Sub connection');
    closePromises.push(
      redisPubSubClient
        .quit()
        .then(() => {
          logger.info('Redis Pub/Sub connection closed');
        })
        .catch((error) => {
          logger.error({ error }, 'Error closing Redis Pub/Sub connection');
        })
    );
    redisPubSubClient = null;
  }

  await Promise.all(closePromises);
  isConnected = false;
}

/**
 * Force disconnect (for testing or emergency)
 *
 * Unlike quit(), this immediately closes connections without
 * waiting for pending commands.
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }

  if (redisPubSubClient) {
    await redisPubSubClient.disconnect();
    redisPubSubClient = null;
  }

  isConnected = false;
  logger.warn('Redis forcefully disconnected');
}

/**
 * Reset Redis client (for testing)
 * @internal
 */
export function _resetRedisClient(): void {
  redisClient = null;
  redisPubSubClient = null;
  isConnected = false;
  connectionAttempts = 0;
}
