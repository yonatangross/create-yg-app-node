---
name: production-resilience
description: Use this skill when building production-ready Node.js services. Provides patterns for circuit breakers, graceful shutdown, health checks, rate limiting, and observability.
version: 1.0.0
author: YG Node Starter
tags: [production, resilience, observability, node.js, typescript]
---

# Production Resilience Patterns (Node.js)

## Overview

Essential patterns for building production-ready, resilient Node.js services.

## Circuit Breaker (opossum)

### Installation
```bash
pnpm add opossum
pnpm add -D @types/opossum
```

### Basic Usage
```typescript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000,                    // Time in ms before a call is considered failed
  errorThresholdPercentage: 50,     // Error percentage to open circuit
  resetTimeout: 30000,              // Time to wait before trying again
  volumeThreshold: 5,               // Minimum requests before tripping
};

const breaker = new CircuitBreaker(externalServiceCall, options);

// Event handlers
breaker.on('success', (result) => logger.debug('Call succeeded'));
breaker.on('timeout', () => logger.warn('Call timed out'));
breaker.on('reject', () => logger.warn('Call rejected - circuit open'));
breaker.on('open', () => logger.error('Circuit opened'));
breaker.on('halfOpen', () => logger.info('Circuit half-open'));
breaker.on('close', () => logger.info('Circuit closed'));
breaker.on('fallback', (result) => logger.info('Fallback called'));

// Use with fallback
breaker.fallback(() => ({ cached: true, data: getCachedData() }));

const result = await breaker.fire(params);
```

### Service Wrapper
```typescript
class ResilientService {
  private breaker: CircuitBreaker;

  constructor(
    private service: ExternalService,
    private cache: Redis
  ) {
    this.breaker = new CircuitBreaker(
      (params) => this.service.call(params),
      { timeout: 5000, errorThresholdPercentage: 50 }
    );

    this.breaker.fallback(async (params) => {
      const cached = await this.cache.get(`service:${params.id}`);
      if (cached) return JSON.parse(cached);
      throw new Error('Service unavailable and no cache');
    });
  }

  async call(params: ServiceParams): Promise<ServiceResult> {
    return this.breaker.fire(params);
  }

  getStats() {
    return this.breaker.stats;
  }
}
```

## Graceful Shutdown

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();
let isShuttingDown = false;

// Health check that respects shutdown
app.get('/health', (c) => {
  if (isShuttingDown) {
    return c.json({ status: 'shutting_down' }, 503);
  }
  return c.json({ status: 'ok' });
});

const server = serve({ fetch: app.fetch, port: 3000 });

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  isShuttingDown = true;

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Wait for in-flight requests (with timeout)
  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);

  try {
    // Close database connections
    await db.end();
    logger.info('Database connections closed');

    // Close Redis connections
    await redis.quit();
    logger.info('Redis connections closed');

    // Close other resources...

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

## Health Checks

```typescript
interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
}

const healthChecks: HealthCheck[] = [
  {
    name: 'database',
    check: async () => {
      const result = await db.execute(sql`SELECT 1`);
      return result.length > 0;
    },
    critical: true,
  },
  {
    name: 'redis',
    check: async () => {
      const result = await redis.ping();
      return result === 'PONG';
    },
    critical: true,
  },
  {
    name: 'external_api',
    check: async () => {
      const res = await fetch('https://api.example.com/health');
      return res.ok;
    },
    critical: false,
  },
];

app.get('/health', async (c) => {
  const results = await Promise.all(
    healthChecks.map(async (hc) => {
      try {
        const healthy = await Promise.race([
          hc.check(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          ),
        ]);
        return { name: hc.name, healthy, critical: hc.critical };
      } catch {
        return { name: hc.name, healthy: false, critical: hc.critical };
      }
    })
  );

  const criticalFailed = results.some((r) => r.critical && !r.healthy);
  const status = criticalFailed ? 503 : 200;

  return c.json({ status: criticalFailed ? 'unhealthy' : 'healthy', checks: results }, status);
});

// Kubernetes-style probes
app.get('/ready', async (c) => {
  // Check if app can serve traffic
  const dbHealthy = await healthChecks[0].check();
  return c.json({ ready: dbHealthy }, dbHealthy ? 200 : 503);
});

app.get('/live', (c) => {
  // Just check if process is alive
  return c.json({ alive: true });
});
```

## Rate Limiting

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Different limiters for different endpoints
const limiters = {
  api: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:api',
    points: 100,      // 100 requests
    duration: 60,     // per 60 seconds
  }),
  auth: new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rl:auth',
    points: 5,        // 5 attempts
    duration: 60 * 15, // per 15 minutes
    blockDuration: 60 * 60, // block for 1 hour
  }),
};

// Middleware
const rateLimitMiddleware = (limiter: RateLimiterRedis) => {
  return createMiddleware(async (c, next) => {
    const key = c.req.header('x-forwarded-for') || 'unknown';

    try {
      await limiter.consume(key);
      await next();
    } catch (rateLimiterRes) {
      const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter,
        },
      }, 429);
    }
  });
};

app.use('/api/*', rateLimitMiddleware(limiters.api));
app.use('/auth/*', rateLimitMiddleware(limiters.auth));
```

## Timeouts

```typescript
// Promise-based timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]);
}

// Usage
const result = await withTimeout(externalService.call(), 5000);

// AbortController approach
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Retry with Exponential Backoff

```typescript
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry?: (error: Error) => boolean;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, shouldRetry = () => true } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = delay * 0.1 * Math.random();

      logger.warn({
        attempt: attempt + 1,
        maxRetries,
        delay: delay + jitter,
        error: lastError.message,
      }, 'Retrying after error');

      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError!;
}

// Usage
const result = await withRetry(
  () => externalService.call(),
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error) => !error.message.includes('NOT_FOUND'),
  }
);
```

## Structured Logging (Pino)

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['password', 'token', 'authorization'],
});

// Request logging middleware
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  const start = Date.now();

  c.set('requestId', requestId);
  c.header('x-request-id', requestId);

  await next();

  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: Date.now() - start,
  });
});
```

## Checklist

- [ ] Circuit breakers on all external calls
- [ ] Graceful shutdown handling
- [ ] Health check endpoints (/health, /ready, /live)
- [ ] Rate limiting on public endpoints
- [ ] Timeouts on all async operations
- [ ] Retry logic with exponential backoff
- [ ] Structured logging with request IDs
- [ ] Connection pooling for databases
- [ ] Error handling that doesn't leak details
