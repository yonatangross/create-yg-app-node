import type { MiddlewareHandler } from 'hono';
import { generateRequestId } from '@yg-app/shared';
import type { AppEnv } from '../types.js';

/**
 * Middleware to add a unique request ID to each request
 * Uses X-Request-ID header if provided, otherwise generates one
 */
export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const id = c.req.header('X-Request-ID') ?? generateRequestId();
    c.set('requestId', id);
    c.set('startTime', Date.now());
    c.header('X-Request-ID', id);
    await next();
  };
}
