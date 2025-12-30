/**
 * Session Service - Redis-based session management
 *
 * Features:
 * - HASH-based session storage (efficient for multiple fields)
 * - Automatic TTL management (extends on access)
 * - User session index for multi-device tracking
 * - Type-safe session data
 *
 * Key Pattern:
 *   session:user:<sessionId>        - Session data (HASH)
 *   session:index:user:<userId>     - User's sessions (SET)
 *
 * Usage:
 *   const sessionId = await sessionService.create(userId, metadata);
 *   const session = await sessionService.get(sessionId);
 *   await sessionService.destroy(sessionId);
 */

import { getRedis } from '../core/redis.js';
import { getLogger } from '../core/logger.js';
import crypto from 'crypto';
import type { Redis } from 'ioredis';

const logger = getLogger();

/**
 * Session metadata
 */
export interface SessionMetadata {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  loginMethod?: 'password' | 'oauth' | 'magic-link';
}

/**
 * Session data stored in Redis
 */
export interface SessionData {
  sessionId: string;
  userId: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  loginMethod?: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
}

/**
 * Session service configuration
 */
export interface SessionConfig {
  /**
   * Session TTL in seconds (default: 7 days)
   */
  ttl?: number;

  /**
   * Extend session TTL on each access (default: true)
   */
  slidingExpiration?: boolean;
}

/**
 * Redis-based session management service
 */
export class SessionService {
  private redis: Redis;
  private ttl: number;
  private slidingExpiration: boolean;

  constructor(config: SessionConfig = {}) {
    this.redis = getRedis();
    this.ttl = config.ttl ?? 7 * 24 * 60 * 60; // 7 days
    this.slidingExpiration = config.slidingExpiration ?? true;
  }

  /**
   * Create new session
   *
   * @param userId - User ID
   * @param metadata - Session metadata (IP, user agent, etc.)
   * @returns Session ID
   */
  async create(
    userId: string,
    metadata: SessionMetadata = {}
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttl * 1000);

    const sessionKey = `session:user:${sessionId}`;
    const indexKey = `session:index:user:${userId}`;

    const sessionData: Record<string, string> = {
      sessionId,
      userId,
      createdAt: now.toISOString(),
      lastActivity: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    if (metadata.ip) sessionData.ip = metadata.ip;
    if (metadata.userAgent) sessionData.userAgent = metadata.userAgent;
    if (metadata.deviceId) sessionData.deviceId = metadata.deviceId;
    if (metadata.loginMethod) sessionData.loginMethod = metadata.loginMethod;

    try {
      // Store session data
      await this.redis.hmset(sessionKey, sessionData);
      await this.redis.expire(sessionKey, this.ttl);

      // Add to user's session index
      await this.redis.sadd(indexKey, sessionId);
      await this.redis.expire(indexKey, this.ttl);

      logger.info({ userId, sessionId, metadata }, 'Session created');
      return sessionId;
    } catch (error) {
      logger.error({ error, userId, sessionId }, 'Failed to create session');
      throw new Error('Failed to create session');
    }
  }

  /**
   * Get session data
   *
   * Automatically extends TTL if sliding expiration is enabled.
   *
   * @param sessionId - Session ID
   * @returns Session data or null if not found
   */
  async get(sessionId: string): Promise<SessionData | null> {
    const sessionKey = `session:user:${sessionId}`;

    try {
      const data = await this.redis.hgetall(sessionKey);

      if (!data || Object.keys(data).length === 0) {
        logger.debug({ sessionId }, 'Session not found');
        return null;
      }

      // Extend session if sliding expiration enabled
      if (this.slidingExpiration) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.ttl * 1000);

        await this.redis.hset(sessionKey, 'lastActivity', now.toISOString());
        await this.redis.hset(sessionKey, 'expiresAt', expiresAt.toISOString());
        await this.redis.expire(sessionKey, this.ttl);

        // Extend user index TTL too
        const indexKey = `session:index:user:${data.userId}`;
        await this.redis.expire(indexKey, this.ttl);
      }

      logger.debug({ sessionId, userId: data.userId }, 'Session retrieved');
      return data as unknown as SessionData;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to get session');
      return null;
    }
  }

  /**
   * Update session metadata
   *
   * @param sessionId - Session ID
   * @param updates - Fields to update
   */
  async update(
    sessionId: string,
    updates: Partial<SessionMetadata>
  ): Promise<void> {
    const sessionKey = `session:user:${sessionId}`;

    try {
      const updateData: Record<string, string> = {};
      if (updates.ip) updateData.ip = updates.ip;
      if (updates.userAgent) updateData.userAgent = updates.userAgent;
      if (updates.deviceId) updateData.deviceId = updates.deviceId;

      if (Object.keys(updateData).length > 0) {
        await this.redis.hmset(sessionKey, updateData);
        await this.redis.expire(sessionKey, this.ttl);
      }

      logger.debug({ sessionId, updates }, 'Session updated');
    } catch (error) {
      logger.error({ error, sessionId, updates }, 'Failed to update session');
    }
  }

  /**
   * Destroy session
   *
   * @param sessionId - Session ID
   * @returns True if session was destroyed
   */
  async destroy(sessionId: string): Promise<boolean> {
    const sessionKey = `session:user:${sessionId}`;

    try {
      // Get session to find userId for index cleanup
      const data = await this.redis.hgetall(sessionKey);

      if (data && data.userId) {
        const indexKey = `session:index:user:${data.userId}`;
        await this.redis.srem(indexKey, sessionId);
      }

      // Delete session
      const deleted = await this.redis.del(sessionKey);

      if (deleted > 0) {
        logger.info({ sessionId, userId: data?.userId }, 'Session destroyed');
        return true;
      }

      return false;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to destroy session');
      return false;
    }
  }

  /**
   * Get all sessions for user
   *
   * @param userId - User ID
   * @returns Array of session IDs
   */
  async getUserSessions(userId: string): Promise<string[]> {
    const indexKey = `session:index:user:${userId}`;

    try {
      const sessionIds = await this.redis.smembers(indexKey);
      logger.debug(
        { userId, count: sessionIds.length },
        'User sessions retrieved'
      );
      return sessionIds;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user sessions');
      return [];
    }
  }

  /**
   * Get all active sessions for user (with data)
   *
   * @param userId - User ID
   * @returns Array of session data
   */
  async getUserSessionsWithData(userId: string): Promise<SessionData[]> {
    const sessionIds = await this.getUserSessions(userId);

    if (sessionIds.length === 0) {
      return [];
    }

    const sessions = await Promise.all(sessionIds.map((id) => this.get(id)));

    return sessions.filter((s): s is SessionData => s !== null);
  }

  /**
   * Destroy all sessions for user
   *
   * @param userId - User ID
   * @returns Number of sessions destroyed
   */
  async destroyAllUserSessions(userId: string): Promise<number> {
    const sessionIds = await this.getUserSessions(userId);

    if (sessionIds.length === 0) {
      return 0;
    }

    try {
      const keys = sessionIds.map((id) => `session:user:${id}`);
      const deleted = await this.redis.del(...keys);

      // Clear index
      const indexKey = `session:index:user:${userId}`;
      await this.redis.del(indexKey);

      logger.info(
        { userId, destroyed: deleted },
        'All user sessions destroyed'
      );
      return deleted;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to destroy all user sessions');
      return 0;
    }
  }

  /**
   * Check if session exists and is valid
   *
   * @param sessionId - Session ID
   * @returns True if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    const sessionKey = `session:user:${sessionId}`;

    try {
      const exists = await this.redis.exists(sessionKey);
      return exists === 1;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to check session existence');
      return false;
    }
  }

  /**
   * Get session count for user
   *
   * @param userId - User ID
   * @returns Number of active sessions
   */
  async getSessionCount(userId: string): Promise<number> {
    const indexKey = `session:index:user:${userId}`;

    try {
      return await this.redis.scard(indexKey);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get session count');
      return 0;
    }
  }
}

/**
 * Singleton session service instance
 */
export const sessionService = new SessionService({
  ttl: 7 * 24 * 60 * 60, // 7 days
  slidingExpiration: true,
});
