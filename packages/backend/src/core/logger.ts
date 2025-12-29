/**
 * Structured logging with Pino and AsyncLocalStorage for request context
 *
 * Pattern: AsyncLocalStorage allows child loggers to inherit request context
 * (requestId, traceId) without explicitly passing it through every function.
 */

import pino, { type Logger, type LoggerOptions } from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getConfig } from './config.js';

const asyncLocalStorage = new AsyncLocalStorage<LogContext>();

export interface LogContext {
  requestId?: string;
  traceId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Create the root logger
 */
function createLogger(): Logger {
  const config = getConfig();

  const options: LoggerOptions = {
    level: config.LOG_LEVEL,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'password',
        'token',
        'authorization',
        'cookie',
        'apiKey',
        'api_key',
        'secret',
        '*.password',
        '*.token',
        '*.authorization',
      ],
      remove: true,
    },
    base: {
      env: config.NODE_ENV,
      version: config.VERSION,
    },
  };

  // Use pino-pretty in development for readable logs
  if (config.NODE_ENV === 'development') {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'HH:MM:ss Z',
        singleLine: false,
      },
    };
  }

  return pino(options);
}

const rootLogger = createLogger();

/**
 * Get logger with current async context
 *
 * Usage:
 * ```typescript
 * const logger = getLogger();
 * logger.info({ userId: 123 }, 'User logged in');
 * ```
 */
export function getLogger(): Logger {
  const context = asyncLocalStorage.getStore();

  if (!context || Object.keys(context).length === 0) {
    return rootLogger;
  }

  return rootLogger.child(context);
}

/**
 * Execute a function with logging context
 *
 * Usage:
 * ```typescript
 * await withContext({ requestId: 'abc123' }, async () => {
 *   const logger = getLogger();
 *   logger.info('This log will include requestId');
 * });
 * ```
 */
export function withContext<T>(
  context: LogContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const existingContext = asyncLocalStorage.getStore() || {};
  const mergedContext = { ...existingContext, ...context };

  return asyncLocalStorage.run(mergedContext, fn);
}

/**
 * Get current logging context
 */
export function getContext(): LogContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Create a child logger with additional bindings
 *
 * Usage:
 * ```typescript
 * const serviceLogger = createChildLogger({ service: 'auth' });
 * serviceLogger.info('Auth service started');
 * ```
 */
export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}

/**
 * Export root logger for direct use (discouraged, prefer getLogger())
 */
export const logger = rootLogger;

// Re-export types
export type { Logger };
