import { Hono } from 'hono';
import { config } from '../core/config.js';
import type { AppEnv } from '../types.js';
import type { HealthCheck } from '@yg-app/shared';
import { getCircuitBreakerHealth } from '../core/resilience.js';
import { isRedisHealthy, getRedisStats } from '../core/redis.js';

const healthRoutes = new Hono<AppEnv>();

/**
 * Health check endpoint
 * Returns service status and dependency health
 * Now includes Redis and circuit breaker status
 */
healthRoutes.get('/', async (c) => {
  const { checkDbHealth } = await import('../db/client.js');

  // Check all services in parallel
  const [dbHealthy, redisHealthy] = await Promise.all([
    checkDbHealth(),
    isRedisHealthy(),
  ]);
  const circuitHealth = getCircuitBreakerHealth();

  // Get Redis stats if healthy
  let redisStats = null;
  if (redisHealthy) {
    try {
      redisStats = await getRedisStats();
    } catch {
      // Stats unavailable, continue with basic health info
    }
  }

  const allHealthy = dbHealthy && redisHealthy && circuitHealth.healthy;

  const health: HealthCheck = {
    status: allHealthy ? 'healthy' : 'degraded',
    version: config.VERSION,
    timestamp: new Date().toISOString(),
    services: {
      api: { status: 'up' },
      database: { status: dbHealthy ? 'up' : 'down' },
      redis: { status: redisHealthy ? 'up' : 'down' },
    },
    // Add Redis stats as additional metadata
    ...(redisStats && {
      redis: {
        status: redisHealthy ? 'up' : 'down',
        memoryUsed: redisStats.memoryUsedHuman,
        connectedClients: redisStats.connectedClients,
        uptime: redisStats.uptime,
        version: redisStats.version,
      },
    }),
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

  // Check database and Redis in parallel
  const [dbHealthy, redisHealthy] = await Promise.all([
    checkDbHealth(),
    isRedisHealthy(),
  ]);

  const isReady = dbHealthy && redisHealthy;

  if (isReady) {
    return c.json({
      status: 'ready',
      database: 'connected',
      redis: 'connected',
    });
  }

  return c.json(
    {
      status: 'not ready',
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected',
    },
    503
  );
});

export { healthRoutes };
