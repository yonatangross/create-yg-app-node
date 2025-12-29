/**
 * Integration tests for health check routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../../app.js';

// Type definitions for health check responses
interface HealthResponse {
  success: boolean;
  data: {
    status: 'healthy' | 'degraded';
    version: string;
    timestamp: string;
    services: {
      api: { status: string };
      database: { status: string };
      redis?: { status: string };
    };
  };
}

interface LiveResponse {
  status: 'ok';
}

interface ReadyResponse {
  status: 'ready' | 'not ready';
  database: 'connected' | 'disconnected';
  redis?: 'connected' | 'disconnected';
}

// Mock database client
vi.mock('../../db/client.js', () => ({
  checkDbHealth: vi.fn(),
}));

// Mock Redis client
vi.mock('../../core/redis.js', () => ({
  isRedisHealthy: vi.fn(),
  getRedisStats: vi.fn(),
}));

describe('Health Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status when database and redis are up', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      const { isRedisHealthy, getRedisStats } =
        await import('../../core/redis.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);
      vi.mocked(isRedisHealthy).mockResolvedValue(true);
      vi.mocked(getRedisStats).mockResolvedValue({
        connected: true,
        memoryUsedBytes: 1024,
        memoryUsedHuman: '1K',
        connectedClients: 1,
        uptime: 3600,
        version: '7.0.0',
      });

      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const body = (await res.json()) as HealthResponse;

      expect(body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          services: {
            api: { status: 'up' },
            database: { status: 'up' },
            redis: { status: 'up' },
          },
        },
      });

      expect(body.data.version).toBeDefined();
      expect(body.data.timestamp).toBeDefined();
    });

    it('should return 200 with degraded status when database is down', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      const { isRedisHealthy } = await import('../../core/redis.js');
      vi.mocked(checkDbHealth).mockResolvedValue(false);
      vi.mocked(isRedisHealthy).mockResolvedValue(true);

      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const body = (await res.json()) as HealthResponse;

      expect(body).toMatchObject({
        success: true,
        data: {
          status: 'degraded',
          services: {
            api: { status: 'up' },
            database: { status: 'down' },
          },
        },
      });
    });

    it('should return degraded when redis is down', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      const { isRedisHealthy } = await import('../../core/redis.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);
      vi.mocked(isRedisHealthy).mockResolvedValue(false);

      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const body = (await res.json()) as HealthResponse;

      expect(body.data.status).toBe('degraded');
    });

    it('should include version and timestamp', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      const { isRedisHealthy } = await import('../../core/redis.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);
      vi.mocked(isRedisHealthy).mockResolvedValue(true);

      const res = await app.request('/health');
      const body = (await res.json()) as HealthResponse;

      expect(body.data.version).toMatch(/^\d+\.\d+\.\d+/); // Semver format
      expect(new Date(body.data.timestamp).getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 with ok status', async () => {
      const res = await app.request('/health/live');

      expect(res.status).toBe(200);
      const body = (await res.json()) as LiveResponse;

      expect(body).toEqual({ status: 'ok' });
    });

    it('should not check database (liveness only checks process)', async () => {
      const { checkDbHealth } = await import('../../db/client.js');

      await app.request('/health/live');

      expect(checkDbHealth).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when database and redis are connected', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      const { isRedisHealthy } = await import('../../core/redis.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);
      vi.mocked(isRedisHealthy).mockResolvedValue(true);

      const res = await app.request('/health/ready');

      expect(res.status).toBe(200);
      const body = (await res.json()) as ReadyResponse;

      expect(body).toEqual({
        status: 'ready',
        database: 'connected',
        redis: 'connected',
      });
    });

    it('should return 503 when database is disconnected', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      const { isRedisHealthy } = await import('../../core/redis.js');
      vi.mocked(checkDbHealth).mockResolvedValue(false);
      vi.mocked(isRedisHealthy).mockResolvedValue(true);

      const res = await app.request('/health/ready');

      expect(res.status).toBe(503);
      const body = (await res.json()) as ReadyResponse;

      expect(body).toEqual({
        status: 'not ready',
        database: 'disconnected',
        redis: 'connected',
      });
    });

    it('should return 503 when redis is disconnected', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      const { isRedisHealthy } = await import('../../core/redis.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);
      vi.mocked(isRedisHealthy).mockResolvedValue(false);

      const res = await app.request('/health/ready');

      expect(res.status).toBe(503);
      const body = (await res.json()) as ReadyResponse;

      expect(body).toEqual({
        status: 'not ready',
        database: 'connected',
        redis: 'disconnected',
      });
    });

    it('should check database and redis health', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      const { isRedisHealthy } = await import('../../core/redis.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);
      vi.mocked(isRedisHealthy).mockResolvedValue(true);

      await app.request('/health/ready');

      expect(checkDbHealth).toHaveBeenCalledOnce();
      expect(isRedisHealthy).toHaveBeenCalledOnce();
    });
  });
});
