import { Hono } from 'hono';
import { config } from '../config/env.js';
import type { AppEnv } from '../types.js';
import type { HealthCheck } from '@yg-app/shared';
import { getCircuitBreakerHealth } from '../core/resilience.js';

const healthRoutes = new Hono<AppEnv>();

/**
 * Health check endpoint
 * Returns service status and dependency health
 * Now includes circuit breaker status
 */
healthRoutes.get('/', async (c) => {
  const { checkDbHealth } = await import('../db/client.js');

  const dbHealthy = await checkDbHealth();
  const circuitHealth = getCircuitBreakerHealth();

  const health: HealthCheck = {
    status: dbHealthy && circuitHealth.healthy ? 'healthy' : 'degraded',
    version: config.VERSION,
    timestamp: new Date().toISOString(),
    services: {
      api: { status: 'up' },
      database: { status: dbHealthy ? 'up' : 'down' },
      // Circuit breakers are additional metadata (not part of strict HealthCheck type)
    },
    // Add circuit breaker info as additional metadata
    ...(circuitHealth.totalCircuits > 0 && {
      circuitBreakers: {
        healthy: circuitHealth.healthy,
        openCircuits: circuitHealth.openCircuits,
        totalCircuits: circuitHealth.totalCircuits,
      },
    }),
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
  const { checkDbHealth } = await import('../db/client.js');

  const dbHealthy = await checkDbHealth();
  const isReady = dbHealthy;

  if (isReady) {
    return c.json({ status: 'ready', database: 'connected' });
  }

  return c.json({ status: 'not ready', database: 'disconnected' }, 503);
});

export { healthRoutes };
