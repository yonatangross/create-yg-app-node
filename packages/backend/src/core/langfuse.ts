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
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
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

// =============================================================================
// Safe Callback Handler Wrapper
// =============================================================================

/**
 * SafeCallbackHandler wraps the Langfuse CallbackHandler to ensure that
 * tracing errors NEVER propagate to the main LLM chain.
 *
 * This implements true fire-and-forget observability:
 * - All callback methods are wrapped in try/catch
 * - Errors are logged but never thrown
 * - LLM operations continue unaffected by tracing failures
 *
 * Fixes: 403 Forbidden errors from Langfuse breaking the chat agent
 *
 * Note: @langfuse/langchain v4.x uses OpenTelemetry internally.
 * The flushAsync method must use the main Langfuse singleton, not the handler.
 */
class SafeCallbackHandler extends BaseCallbackHandler {
  name = 'SafeCallbackHandler';

  constructor(private handler: CallbackHandler) {
    super();
  }

  /**
   * Access the underlying trace ID
   * Note: In v4.x, this property is `last_trace_id` not `traceId`
   */
  get traceId(): string | undefined {
    try {
      // v4.x uses last_trace_id property
      return this.handler.last_trace_id ?? undefined;
    } catch (error) {
      logger.warn({ error }, 'Failed to get traceId from Langfuse handler');
      return undefined;
    }
  }

  /**
   * Wrapper for flushAsync - uses the main Langfuse singleton client
   * Note: @langfuse/langchain v4.x CallbackHandler doesn't have flushAsync,
   * so we flush the main Langfuse client instead
   */
  async flushAsync(): Promise<void> {
    try {
      // Use the singleton Langfuse client for flushing
      const client = getLangfuseClient();
      if (client) {
        await client.flushAsync();
      }
    } catch (error) {
      // Extract meaningful error information for logging
      const errorInfo =
        error instanceof Error
          ? { message: error.message, name: error.name, stack: error.stack }
          : { raw: String(error) };
      logger.warn(
        { error: errorInfo },
        'Langfuse flush failed - continuing without tracing'
      );
    }
  }

  // =============================================================================
  // LLM Callbacks
  // =============================================================================

  async handleLLMStart(
    ...args: Parameters<NonNullable<BaseCallbackHandler['handleLLMStart']>>
  ): Promise<void> {
    try {
      await this.handler.handleLLMStart?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleLLMStart failed');
    }
  }

  async handleLLMNewToken(
    ...args: Parameters<NonNullable<BaseCallbackHandler['handleLLMNewToken']>>
  ): Promise<void> {
    try {
      await this.handler.handleLLMNewToken?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleLLMNewToken failed');
    }
  }

  async handleLLMError(
    ...args: Parameters<NonNullable<CallbackHandler['handleLLMError']>>
  ): Promise<void> {
    try {
      await this.handler.handleLLMError?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleLLMError failed');
    }
  }

  async handleLLMEnd(
    ...args: Parameters<NonNullable<CallbackHandler['handleLLMEnd']>>
  ): Promise<void> {
    try {
      await this.handler.handleLLMEnd?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleLLMEnd failed');
    }
  }

  // =============================================================================
  // Chat Model Callbacks
  // =============================================================================

  async handleChatModelStart(
    ...args: Parameters<
      NonNullable<BaseCallbackHandler['handleChatModelStart']>
    >
  ): Promise<void> {
    try {
      await this.handler.handleChatModelStart?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleChatModelStart failed');
    }
  }

  // =============================================================================
  // Chain Callbacks
  // =============================================================================

  async handleChainStart(
    ...args: Parameters<NonNullable<CallbackHandler['handleChainStart']>>
  ): Promise<void> {
    try {
      await this.handler.handleChainStart?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleChainStart failed');
    }
  }

  async handleChainError(
    ...args: Parameters<NonNullable<CallbackHandler['handleChainError']>>
  ): Promise<void> {
    try {
      await this.handler.handleChainError?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleChainError failed');
    }
  }

  async handleChainEnd(
    ...args: Parameters<NonNullable<CallbackHandler['handleChainEnd']>>
  ): Promise<void> {
    try {
      await this.handler.handleChainEnd?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleChainEnd failed');
    }
  }

  // =============================================================================
  // Tool Callbacks
  // =============================================================================

  async handleToolStart(
    ...args: Parameters<NonNullable<BaseCallbackHandler['handleToolStart']>>
  ): Promise<void> {
    try {
      await this.handler.handleToolStart?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleToolStart failed');
    }
  }

  async handleToolError(
    ...args: Parameters<NonNullable<CallbackHandler['handleToolError']>>
  ): Promise<void> {
    try {
      await this.handler.handleToolError?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleToolError failed');
    }
  }

  async handleToolEnd(
    ...args: Parameters<NonNullable<CallbackHandler['handleToolEnd']>>
  ): Promise<void> {
    try {
      await this.handler.handleToolEnd?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleToolEnd failed');
    }
  }

  // =============================================================================
  // Agent Callbacks
  // =============================================================================

  async handleAgentAction(
    ...args: Parameters<NonNullable<CallbackHandler['handleAgentAction']>>
  ): Promise<void> {
    try {
      await this.handler.handleAgentAction?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleAgentAction failed');
    }
  }

  async handleAgentEnd(
    ...args: Parameters<NonNullable<CallbackHandler['handleAgentEnd']>>
  ): Promise<void> {
    try {
      await this.handler.handleAgentEnd?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleAgentEnd failed');
    }
  }

  // =============================================================================
  // Retriever Callbacks
  // =============================================================================

  async handleRetrieverStart(
    ...args: Parameters<
      NonNullable<BaseCallbackHandler['handleRetrieverStart']>
    >
  ): Promise<void> {
    try {
      await this.handler.handleRetrieverStart?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleRetrieverStart failed');
    }
  }

  async handleRetrieverError(
    ...args: Parameters<NonNullable<CallbackHandler['handleRetrieverError']>>
  ): Promise<void> {
    try {
      await this.handler.handleRetrieverError?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleRetrieverError failed');
    }
  }

  async handleRetrieverEnd(
    ...args: Parameters<NonNullable<CallbackHandler['handleRetrieverEnd']>>
  ): Promise<void> {
    try {
      await this.handler.handleRetrieverEnd?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleRetrieverEnd failed');
    }
  }

  // =============================================================================
  // Text Callbacks
  // =============================================================================

  async handleText(
    ...args: Parameters<NonNullable<BaseCallbackHandler['handleText']>>
  ): Promise<void> {
    try {
      await this.handler.handleText?.(...args);
    } catch (error) {
      logger.warn({ error }, 'Langfuse handleText failed');
    }
  }
}

/**
 * Create request-scoped Langfuse callback handler
 *
 * @param options - Handler options
 * @returns SafeCallbackHandler instance (wraps CallbackHandler) or null if disabled
 */
export function createLangfuseHandler(options?: {
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}): SafeCallbackHandler | null {
  const config = getConfig();

  // Check if credentials are available BEFORE checking isEnabled
  if (
    !config.LANGFUSE_PUBLIC_KEY ||
    !config.LANGFUSE_SECRET_KEY ||
    !config.LANGFUSE_HOST
  ) {
    return null;
  }

  // Initialize client if needed (will set isEnabled flag)
  const client = getLangfuseClient();
  if (!client || !isEnabled) {
    return null;
  }

  try {
    // CallbackHandler requires credentials - pass them explicitly
    const handlerOptions: Record<string, unknown> = {
      publicKey: config.LANGFUSE_PUBLIC_KEY,
      secretKey: config.LANGFUSE_SECRET_KEY,
      baseUrl: config.LANGFUSE_HOST,
    };
    if (options?.userId) handlerOptions.userId = options.userId;
    if (options?.sessionId) handlerOptions.sessionId = options.sessionId;
    if (options?.tags) handlerOptions.tags = options.tags;

    // CallbackHandler constructor type is too strict, use type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawHandler = new CallbackHandler(handlerOptions as any);

    // Wrap in SafeCallbackHandler to prevent errors from propagating
    return new SafeCallbackHandler(rawHandler);
  } catch (error) {
    logger.warn(
      { error },
      'Failed to create Langfuse handler - tracing disabled'
    );
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
