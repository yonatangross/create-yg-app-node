import type { MiddlewareHandler } from 'hono';
import { logger as pinoLogger } from '../lib/logger.js';
import type { AppEnv } from '../types.js';

/**
 * Request logging middleware using Pino
 */
export function requestLogger(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = Date.now();
    const requestId = c.get('requestId');

    pinoLogger.info(
      {
        requestId,
        method: c.req.method,
        path: c.req.path,
        userAgent: c.req.header('User-Agent'),
      },
      'Request started'
    );

    await next();

    const duration = Date.now() - start;

    pinoLogger.info(
      {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: duration,
      },
      'Request completed'
    );
  };
}
