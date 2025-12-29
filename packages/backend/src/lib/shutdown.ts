import { getLogger } from '../core/logger.js';
import { shutdownLangfuse } from '../core/langfuse.js';
import { shutdownRedis } from '../core/redis.js';
import { shutdownEmbeddingsCache } from '../shared/embeddings.js';
import { closeVectorStore } from '../shared/vector-store.js';
import { closeCheckpointer } from '../shared/checkpointer.js';
import { shutdownCircuitBreakers } from '../core/resilience.js';
import { shutdownRateLimiter } from '../middleware/rate-limit.js';

const logger = getLogger();

interface ShutdownOptions {
  onShutdown?: () => Promise<void>;
  timeoutMs?: number;
}

interface CloseableServer {
  close(callback?: (err?: Error) => void): void;
}

/**
 * Setup graceful shutdown handlers
 */
export function gracefulShutdown(
  server: CloseableServer,
  options: ShutdownOptions = {}
): void {
  const { onShutdown, timeoutMs = 30000 } = options;

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    isShuttingDown = true;
    logger.info(
      { signal },
      'Received shutdown signal, starting graceful shutdown'
    );

    // Force shutdown after timeout
    const forceShutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, timeoutMs);

    try {
      // Stop accepting new connections
      server.close((err) => {
        if (err) {
          logger.error({ err }, 'Error closing server');
        } else {
          logger.info('Server closed successfully');
        }
      });

      // Cleanup AI/LLM services first (they may use Redis)
      await Promise.allSettled([
        shutdownLangfuse(5000),
        shutdownEmbeddingsCache(),
        closeVectorStore(),
        closeCheckpointer(),
        shutdownRateLimiter(),
      ]);

      // Shutdown Redis after all dependent services (single connection point)
      await shutdownRedis();

      // Cleanup circuit breakers (synchronous)
      shutdownCircuitBreakers();

      // Run custom cleanup
      if (onShutdown) {
        await onShutdown();
      }

      clearTimeout(forceShutdownTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceShutdownTimeout);
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    shutdown('unhandledRejection');
  });
}
