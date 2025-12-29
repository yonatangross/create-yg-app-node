/**
 * Integration tests for health check routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../../app.js';

// Mock database client
vi.mock('../../db/client.js', () => ({
  checkDbHealth: vi.fn(),
}));

describe('Health Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status when database is up', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);

      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          services: {
            api: { status: 'up' },
            database: { status: 'up' },
          },
        },
      });

      expect(body.data.version).toBeDefined();
      expect(body.data.timestamp).toBeDefined();
    });

    it('should return 200 with degraded status when database is down', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      vi.mocked(checkDbHealth).mockResolvedValue(false);

      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const body = await res.json();

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

    it('should include version and timestamp', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);

      const res = await app.request('/health');
      const body = await res.json();

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
      const body = await res.json();

      expect(body).toEqual({ status: 'ok' });
    });

    it('should not check database (liveness only checks process)', async () => {
      const { checkDbHealth } = await import('../../db/client.js');

      await app.request('/health/live');

      expect(checkDbHealth).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when database is connected', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);

      const res = await app.request('/health/ready');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toEqual({
        status: 'ready',
        database: 'connected',
      });
    });

    it('should return 503 when database is disconnected', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      vi.mocked(checkDbHealth).mockResolvedValue(false);

      const res = await app.request('/health/ready');

      expect(res.status).toBe(503);
      const body = await res.json();

      expect(body).toEqual({
        status: 'not ready',
        database: 'disconnected',
      });
    });

    it('should check database health', async () => {
      const { checkDbHealth } = await import('../../db/client.js');
      vi.mocked(checkDbHealth).mockResolvedValue(true);

      await app.request('/health/ready');

      expect(checkDbHealth).toHaveBeenCalledOnce();
    });
  });
});
