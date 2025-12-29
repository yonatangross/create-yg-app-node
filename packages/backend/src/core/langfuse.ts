/**
 * Langfuse Observability Client
 *
 * Singleton pattern for Langfuse client with lazy initialization.
 * Provides request-scoped handler factory for LangChain.js tracing.
 *
 * Usage:
 *   const handler = createLangfuseHandler({ userId, sessionId });
 *   await chain.invoke(input, { callbacks: [handler] });
 *   await handler.flushAsync();
 */

import { Langfuse } from 'langfuse';
import { CallbackHandler } from '@langfuse/langchain';
import { getConfig } from './config.js';
import { getLogger } from './logger.js';

const logger = getLogger();

// Singleton instance
let langfuseInstance: Langfuse | null = null;
let isEnabled = false;

/**
 * Initialize Langfuse client (lazy)
 */
function getLangfuseClient(): Langfuse | null {
  const config = getConfig();

  // Check if Langfuse is enabled
  const enabled =
    config.LANGFUSE_PUBLIC_KEY &&
    config.LANGFUSE_SECRET_KEY &&
    config.LANGFUSE_HOST;

  if (!enabled) {
    if (!isEnabled) {
      logger.info('Langfuse disabled - missing credentials');
      isEnabled = false;
    }
    return null;
  }

  // Return existing instance
  if (langfuseInstance) {
    return langfuseInstance;
  }

  // Create new instance
  try {
    langfuseInstance = new Langfuse({
      publicKey: config.LANGFUSE_PUBLIC_KEY!,
      secretKey: config.LANGFUSE_SECRET_KEY!,
      baseUrl: config.LANGFUSE_HOST!,
      flushAt: 15, // Batch size before flush
      flushInterval: 5000, // Max ms between flushes
    });

    isEnabled = true;
    logger.info({ host: config.LANGFUSE_HOST }, 'Langfuse initialized');

    return langfuseInstance;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Langfuse');
    return null;
  }
}

/**
 * Create request-scoped Langfuse callback handler
 *
 * @param options - Handler options
 * @returns CallbackHandler instance or null if disabled
 */
export function createLangfuseHandler(options?: {
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}): CallbackHandler | null {
  const config = getConfig();

  if (!isEnabled || !config.LANGFUSE_PUBLIC_KEY || !config.LANGFUSE_SECRET_KEY) {
    return null;
  }

  try {
    const handlerOptions: Record<string, unknown> = {};
    if (options?.userId) handlerOptions.userId = options.userId;
    if (options?.sessionId) handlerOptions.sessionId = options.sessionId;
    if (options?.tags) handlerOptions.tags = options.tags;

    // CallbackHandler constructor type is too strict, use type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new CallbackHandler(handlerOptions as any);
  } catch (error) {
    logger.error({ error }, 'Failed to create Langfuse handler');
    return null;
  }
}

/**
 * Score a trace (for evaluations/analytics)
 *
 * @param traceId - Trace ID to score
 * @param name - Score name (e.g., 'user-rating', 'accuracy')
 * @param value - Score value (0-1 or -1 to 1)
 * @param options - Additional options
 */
export async function scoreTrace(
  traceId: string,
  name: string,
  value: number,
  options?: {
    comment?: string | null;
    dataType?: 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL';
  }
): Promise<void> {
  const client = getLangfuseClient();
  if (!client) return;

  try {
    client.score({
      traceId,
      name,
      value,
      comment: options?.comment ?? null,
      dataType: options?.dataType || 'NUMERIC',
    });
  } catch (error) {
    logger.error({ error, traceId, name }, 'Failed to score trace');
  }
}

/**
 * Graceful shutdown with flush timeout
 *
 * @param timeout - Flush timeout in ms (default: 5000)
 */
export async function shutdownLangfuse(timeout = 5000): Promise<void> {
  const client = getLangfuseClient();
  if (!client) return;

  try {
    logger.info('Flushing Langfuse traces...');

    // Race between shutdown and timeout
    await Promise.race([
      client.shutdownAsync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Flush timeout')), timeout)
      ),
    ]);

    logger.info('Langfuse traces flushed');
  } catch (error) {
    logger.error({ error }, 'Error flushing Langfuse traces');
  } finally {
    langfuseInstance = null;
  }
}

/**
 * Get Langfuse client instance (for advanced usage)
 *
 * @returns Langfuse instance or null if disabled
 */
export function getLangfuse(): Langfuse | null {
  return getLangfuseClient();
}

/**
 * Check if Langfuse is enabled
 */
export function isLangfuseEnabled(): boolean {
  return isEnabled;
}
