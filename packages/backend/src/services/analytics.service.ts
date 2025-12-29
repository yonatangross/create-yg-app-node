/**
 * Analytics Service - Redis-based analytics and metrics
 *
 * Features:
 * - Leaderboards (ZSET for rankings)
 * - Unique visitor tracking (HyperLogLog for cardinality)
 * - Page view counters
 * - Daily/weekly/monthly aggregations
 *
 * Key Patterns:
 *   analytics:leaderboard:<name>        - Rankings (ZSET)
 *   analytics:uv:<resource>:<date>      - Unique visitors (HLL)
 *   analytics:pageviews:<page>:<date>   - Page view count (STRING)
 *   analytics:events:<event>:<date>     - Event counter (STRING)
 *
 * Usage:
 *   await analyticsService.trackPageView('/home', 'user123', '2025-12-29');
 *   const visitors = await analyticsService.getUniqueVisitors('/home', '2025-12-29');
 */

import { getRedis } from '../core/redis.js';
import { getLogger } from '../core/logger.js';
import type { Redis } from 'ioredis';

const logger = getLogger();

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  id: string;
  score: number;
  rank: number;
}

/**
 * Analytics time range
 */
export type TimeRange = 'daily' | 'weekly' | 'monthly' | 'all-time';

/**
 * Analytics service for tracking metrics
 */
export class AnalyticsService {
  private redis: Redis;

  constructor() {
    this.redis = getRedis();
  }

  /**
   * Track page view with unique visitor counting
   *
   * @param page - Page identifier (e.g., '/home', '/dashboard')
   * @param userId - User or session ID
   * @param date - Date in YYYY-MM-DD format (default: today)
   */
  async trackPageView(
    page: string,
    userId: string,
    date?: string
  ): Promise<void> {
    const dateKey = date || new Date().toISOString().split('T')[0];

    const uvKey = `analytics:uv:${page}:${dateKey}`;
    const pvKey = `analytics:pageviews:${page}:${dateKey}`;

    try {
      await Promise.all([
        // Add to unique visitors (HyperLogLog)
        this.redis.pfadd(uvKey, userId),
        // Increment page view counter
        this.redis.incr(pvKey),
      ]);

      // Set TTL (90 days retention)
      await Promise.all([
        this.redis.expire(uvKey, 90 * 24 * 60 * 60),
        this.redis.expire(pvKey, 90 * 24 * 60 * 60),
      ]);

      logger.debug({ page, userId, date: dateKey }, 'Page view tracked');
    } catch (error) {
      logger.error(
        { error, page, userId, date: dateKey },
        'Failed to track page view'
      );
    }
  }

  /**
   * Get unique visitors for page
   *
   * @param page - Page identifier
   * @param date - Date in YYYY-MM-DD format (default: today)
   * @returns Approximate unique visitor count
   */
  async getUniqueVisitors(page: string, date?: string): Promise<number> {
    const dateKey = date || new Date().toISOString().split('T')[0];
    const uvKey = `analytics:uv:${page}:${dateKey}`;

    try {
      return await this.redis.pfcount(uvKey);
    } catch (error) {
      logger.error(
        { error, page, date: dateKey },
        'Failed to get unique visitors'
      );
      return 0;
    }
  }

  /**
   * Get unique visitors for date range
   *
   * Merges HyperLogLogs across multiple dates for accurate unique count.
   *
   * @param page - Page identifier
   * @param dates - Array of dates in YYYY-MM-DD format
   * @returns Approximate unique visitor count across all dates
   */
  async getUniqueVisitorsRange(page: string, dates: string[]): Promise<number> {
    if (dates.length === 0) return 0;

    const keys = dates.map((date) => `analytics:uv:${page}:${date}`);

    try {
      // PFCOUNT merges HLLs and returns combined unique count
      return await this.redis.pfcount(...keys);
    } catch (error) {
      logger.error(
        { error, page, dates },
        'Failed to get unique visitors range'
      );
      return 0;
    }
  }

  /**
   * Get page views count
   *
   * @param page - Page identifier
   * @param date - Date in YYYY-MM-DD format (default: today)
   * @returns Page view count
   */
  async getPageViews(page: string, date?: string): Promise<number> {
    const dateKey = date || new Date().toISOString().split('T')[0];
    const pvKey = `analytics:pageviews:${page}:${dateKey}`;

    try {
      const count = await this.redis.get(pvKey);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error({ error, page, date: dateKey }, 'Failed to get page views');
      return 0;
    }
  }

  /**
   * Track custom event
   *
   * @param event - Event name
   * @param userId - User or session ID
   * @param date - Date in YYYY-MM-DD format (default: today)
   */
  async trackEvent(
    event: string,
    userId: string,
    date?: string
  ): Promise<void> {
    const dateKey = date || new Date().toISOString().split('T')[0];

    const uvKey = `analytics:events:uv:${event}:${dateKey}`;
    const countKey = `analytics:events:count:${event}:${dateKey}`;

    try {
      await Promise.all([
        this.redis.pfadd(uvKey, userId),
        this.redis.incr(countKey),
      ]);

      await Promise.all([
        this.redis.expire(uvKey, 90 * 24 * 60 * 60),
        this.redis.expire(countKey, 90 * 24 * 60 * 60),
      ]);

      logger.debug({ event, userId, date: dateKey }, 'Event tracked');
    } catch (error) {
      logger.error(
        { error, event, userId, date: dateKey },
        'Failed to track event'
      );
    }
  }

  /**
   * Get event count
   *
   * @param event - Event name
   * @param date - Date in YYYY-MM-DD format (default: today)
   * @returns Event count
   */
  async getEventCount(event: string, date?: string): Promise<number> {
    const dateKey = date || new Date().toISOString().split('T')[0];
    const countKey = `analytics:events:count:${event}:${dateKey}`;

    try {
      const count = await this.redis.get(countKey);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error(
        { error, event, date: dateKey },
        'Failed to get event count'
      );
      return 0;
    }
  }

  /**
   * Add score to leaderboard
   *
   * @param leaderboard - Leaderboard name
   * @param userId - User ID
   * @param score - Score to add (can be negative)
   * @param range - Time range (daily, weekly, monthly, all-time)
   */
  async addToLeaderboard(
    leaderboard: string,
    userId: string,
    score: number,
    range: TimeRange = 'all-time'
  ): Promise<void> {
    const key = this.getLeaderboardKey(leaderboard, range);

    try {
      // ZINCRBY adds score to existing or creates new entry
      await this.redis.zincrby(key, score, userId);

      // Set TTL based on range
      const ttl = this.getLeaderboardTTL(range);
      if (ttl > 0) {
        await this.redis.expire(key, ttl);
      }

      logger.debug(
        { leaderboard, userId, score, range },
        'Leaderboard score added'
      );
    } catch (error) {
      logger.error(
        { error, leaderboard, userId, score },
        'Failed to add to leaderboard'
      );
    }
  }

  /**
   * Get top entries from leaderboard
   *
   * @param leaderboard - Leaderboard name
   * @param limit - Number of entries to return
   * @param range - Time range
   * @returns Array of leaderboard entries with ranks
   */
  async getTopLeaderboard(
    leaderboard: string,
    limit = 10,
    range: TimeRange = 'all-time'
  ): Promise<LeaderboardEntry[]> {
    const key = this.getLeaderboardKey(leaderboard, range);

    try {
      // ZREVRANGE with WITHSCORES (descending order)
      const results = await this.redis.zrevrange(
        key,
        0,
        limit - 1,
        'WITHSCORES'
      );

      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < results.length; i += 2) {
        const id = results[i];
        const scoreStr = results[i + 1];
        if (id !== undefined && scoreStr !== undefined) {
          entries.push({
            id,
            score: parseFloat(scoreStr),
            rank: i / 2 + 1,
          });
        }
      }

      return entries;
    } catch (error) {
      logger.error(
        { error, leaderboard, limit },
        'Failed to get top leaderboard'
      );
      return [];
    }
  }

  /**
   * Get user rank on leaderboard
   *
   * @param leaderboard - Leaderboard name
   * @param userId - User ID
   * @param range - Time range
   * @returns Rank (1-indexed) or null if not on leaderboard
   */
  async getUserRank(
    leaderboard: string,
    userId: string,
    range: TimeRange = 'all-time'
  ): Promise<number | null> {
    const key = this.getLeaderboardKey(leaderboard, range);

    try {
      const rank = await this.redis.zrevrank(key, userId);
      return rank !== null ? rank + 1 : null; // Convert 0-indexed to 1-indexed
    } catch (error) {
      logger.error({ error, leaderboard, userId }, 'Failed to get user rank');
      return null;
    }
  }

  /**
   * Get user score on leaderboard
   *
   * @param leaderboard - Leaderboard name
   * @param userId - User ID
   * @param range - Time range
   * @returns Score or null if not on leaderboard
   */
  async getUserScore(
    leaderboard: string,
    userId: string,
    range: TimeRange = 'all-time'
  ): Promise<number | null> {
    const key = this.getLeaderboardKey(leaderboard, range);

    try {
      const score = await this.redis.zscore(key, userId);
      return score !== null ? parseFloat(score) : null;
    } catch (error) {
      logger.error({ error, leaderboard, userId }, 'Failed to get user score');
      return null;
    }
  }

  /**
   * Get leaderboard entry count
   *
   * @param leaderboard - Leaderboard name
   * @param range - Time range
   * @returns Number of entries
   */
  async getLeaderboardSize(
    leaderboard: string,
    range: TimeRange = 'all-time'
  ): Promise<number> {
    const key = this.getLeaderboardKey(leaderboard, range);

    try {
      return await this.redis.zcard(key);
    } catch (error) {
      logger.error({ error, leaderboard }, 'Failed to get leaderboard size');
      return 0;
    }
  }

  /**
   * Remove user from leaderboard
   *
   * @param leaderboard - Leaderboard name
   * @param userId - User ID
   * @param range - Time range
   * @returns True if user was removed
   */
  async removeFromLeaderboard(
    leaderboard: string,
    userId: string,
    range: TimeRange = 'all-time'
  ): Promise<boolean> {
    const key = this.getLeaderboardKey(leaderboard, range);

    try {
      const removed = await this.redis.zrem(key, userId);
      return removed > 0;
    } catch (error) {
      logger.error(
        { error, leaderboard, userId },
        'Failed to remove from leaderboard'
      );
      return false;
    }
  }

  /**
   * Generate leaderboard key with time range
   */
  private getLeaderboardKey(leaderboard: string, range: TimeRange): string {
    const now = new Date();

    switch (range) {
      case 'daily':
        return `analytics:leaderboard:${leaderboard}:${now.toISOString().split('T')[0]}`;
      case 'weekly': {
        const year = now.getFullYear();
        const week = this.getWeekNumber(now);
        return `analytics:leaderboard:${leaderboard}:${year}-W${week}`;
      }
      case 'monthly': {
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        return `analytics:leaderboard:${leaderboard}:${year}-${month}`;
      }
      case 'all-time':
      default:
        return `analytics:leaderboard:${leaderboard}:all-time`;
    }
  }

  /**
   * Get TTL for leaderboard based on range
   */
  private getLeaderboardTTL(range: TimeRange): number {
    switch (range) {
      case 'daily':
        return 7 * 24 * 60 * 60; // 7 days
      case 'weekly':
        return 30 * 24 * 60 * 60; // 30 days
      case 'monthly':
        return 365 * 24 * 60 * 60; // 1 year
      case 'all-time':
      default:
        return 0; // No expiration
    }
  }

  /**
   * Get ISO week number for date
   */
  private getWeekNumber(date: Date): string {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
    );
    return weekNo.toString().padStart(2, '0');
  }
}

/**
 * Singleton analytics service instance
 */
export const analyticsService = new AnalyticsService();
