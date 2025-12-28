import { logger } from './logger.js';

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

      // Run cleanup
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
