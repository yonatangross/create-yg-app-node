/**
 * OpenTelemetry Instrumentation for Langfuse
 *
 * This file initializes the OpenTelemetry SDK with Langfuse's span processor.
 * It must be imported BEFORE any other modules that create spans.
 *
 * @langfuse/langchain v4.x uses OpenTelemetry internally, so this setup
 * enables traces to be exported to Langfuse's OTel endpoint.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { getConfig } from './config.js';
import { getLogger } from './logger.js';

const logger = getLogger();

let sdk: NodeSDK | null = null;
let spanProcessor: LangfuseSpanProcessor | null = null;

/**
 * Initialize OpenTelemetry with Langfuse span processor
 */
export function initializeOtel(): void {
  const config = getConfig();

  // Check if Langfuse credentials are available
  if (
    !config.LANGFUSE_PUBLIC_KEY ||
    !config.LANGFUSE_SECRET_KEY ||
    !config.LANGFUSE_HOST
  ) {
    logger.info('OpenTelemetry disabled - missing Langfuse credentials');
    return;
  }

  // Check if already initialized
  if (sdk) {
    logger.debug('OpenTelemetry already initialized');
    return;
  }

  try {
    // Create Langfuse span processor
    spanProcessor = new LangfuseSpanProcessor({
      publicKey: config.LANGFUSE_PUBLIC_KEY,
      secretKey: config.LANGFUSE_SECRET_KEY,
      baseUrl: config.LANGFUSE_HOST,
    });

    // Initialize NodeSDK with Langfuse processor
    sdk = new NodeSDK({
      spanProcessors: [spanProcessor],
    });

    sdk.start();

    logger.info(
      { host: config.LANGFUSE_HOST },
      'OpenTelemetry initialized with Langfuse'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to initialize OpenTelemetry');
  }
}

/**
 * Flush all pending spans to Langfuse
 */
export async function flushOtel(): Promise<void> {
  if (spanProcessor) {
    try {
      await spanProcessor.forceFlush();
      logger.debug('OpenTelemetry spans flushed');
    } catch (error) {
      logger.warn({ error }, 'Failed to flush OpenTelemetry spans');
    }
  }
}

/**
 * Shutdown OpenTelemetry gracefully
 */
export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry shutdown complete');
    } catch (error) {
      logger.error({ error }, 'Error shutting down OpenTelemetry');
    } finally {
      sdk = null;
      spanProcessor = null;
    }
  }
}
