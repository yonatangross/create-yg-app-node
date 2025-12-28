import { Hono } from 'hono';
import { config } from '../config/env.js';
import type { AppEnv } from '../types.js';
import type { HealthCheck } from '@yg-app/shared';

const healthRoutes = new Hono<AppEnv>();

/**
 * Health check endpoint
 * Returns service status and dependency health
 */
healthRoutes.get('/', async (c) => {
  const health: HealthCheck = {
    status: 'healthy',
    version: config.VERSION,
    timestamp: new Date().toISOString(),
    services: {
      api: { status: 'up' },
      // Add database and redis checks here
    },
  };

  return c.json({
    success: true,
    data: health,
  });
});

/**
 * Liveness probe for Kubernetes
 * Simple check that the service is running
 */
healthRoutes.get('/live', (c) => {
  return c.json({ status: 'ok' });
});

/**
 * Readiness probe for Kubernetes
 * Check if service is ready to accept traffic
 */
healthRoutes.get('/ready', async (c) => {
  // Add checks for database connection, etc.
  const isReady = true;

  if (isReady) {
    return c.json({ status: 'ready' });
  }

  return c.json({ status: 'not ready' }, 503);
});

export { healthRoutes };
