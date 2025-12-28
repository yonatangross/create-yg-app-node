import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import type { AppEnv } from '../types.js';
import type { ApiError } from '@yg-app/shared';

/**
 * Global error handler
 * Converts various error types to consistent API error responses
 */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId');

  // Zod validation errors
  if (err instanceof ZodError) {
    const error: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.flatten().fieldErrors,
    };

    logger.warn({ requestId, error: err.flatten() }, 'Validation error');

    return c.json({ success: false, error }, 400);
  }

  // HTTP exceptions (from hono)
  if (err instanceof HTTPException) {
    const error: ApiError = {
      code: 'HTTP_ERROR',
      message: err.message,
    };

    logger.warn(
      { requestId, status: err.status, message: err.message },
      'HTTP exception'
    );

    return c.json({ success: false, error }, err.status);
  }

  // Unknown errors
  logger.error({ requestId, err }, 'Unhandled error');

  const error: ApiError = {
    code: 'INTERNAL_ERROR',
    message:
      process.env['NODE_ENV'] === 'production'
        ? 'An unexpected error occurred'
        : err.message,
  };

  return c.json({ success: false, error }, 500);
};
