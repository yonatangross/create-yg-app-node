/**
 * Timeout Wrapper
 *
 * Wraps async operations with configurable timeouts to prevent
 * indefinite hangs on external service calls.
 *
 * Production pattern: All external calls (LLM, vector search, database)
 * MUST have timeouts to ensure system resilience.
 */

import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'TimeoutError';
    Error.captureStackTrace(this, TimeoutError);
  }
}

/**
 * Wrap a promise with a timeout
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Description of the operation (for logging)
 * @returns The promise result or throws TimeoutError
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   model.invoke(messages),
 *   30000,
 *   'llm-chat-completion'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new TimeoutError(
        `Operation timed out after ${timeoutMs}ms`,
        operation,
        timeoutMs
      );
      logger.error(
        {
          operation,
          timeoutMs,
          error: error.message,
        },
        'Operation timeout'
      );
      reject(error);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * Default timeout values for different operation types (in milliseconds)
 */
export const DEFAULT_TIMEOUTS = {
  // LLM operations
  LLM_INVOKE: 30000, // 30s for model.invoke()
  LLM_STREAM: 60000, // 60s for streaming responses

  // Vector search operations
  VECTOR_SEARCH: 10000, // 10s for similarity search
  VECTOR_EMBED: 15000, // 15s for embedding generation

  // Database operations
  DATABASE_QUERY: 10000, // 10s for queries
  DATABASE_TRANSACTION: 30000, // 30s for transactions

  // External API calls
  HTTP_REQUEST: 10000, // 10s for HTTP requests
  WEBHOOK: 5000, // 5s for webhook deliveries
} as const;

/**
 * Type-safe timeout configuration
 */
export type TimeoutConfig = typeof DEFAULT_TIMEOUTS;
export type TimeoutType = keyof TimeoutConfig;

/**
 * Get timeout value for an operation type
 *
 * @param type - The operation type
 * @returns Timeout in milliseconds
 */
export function getTimeout(type: TimeoutType): number {
  return DEFAULT_TIMEOUTS[type];
}

/**
 * Wrap a function with automatic timeout handling
 *
 * @param fn - The async function to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Description of the operation
 * @returns Wrapped function with timeout
 *
 * @example
 * ```typescript
 * const safeLLMCall = withTimeoutWrapper(
 *   (messages) => model.invoke(messages),
 *   30000,
 *   'llm-completion'
 * );
 *
 * const result = await safeLLMCall(messages);
 * ```
 */
export function withTimeoutWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  timeoutMs: number,
  operation: string
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withTimeout(fn(...args), timeoutMs, operation);
  };
}
