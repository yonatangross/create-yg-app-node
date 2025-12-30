/**
 * Backend Server Entry Point
 *
 * Starts the Hono server and exports types for frontend RPC client.
 */

// Initialize OpenTelemetry FIRST - before any other imports that create spans
import { initializeOtel, shutdownOtel } from './core/instrumentation.js';
initializeOtel();

import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './core/config.js';
import { logger } from './lib/logger.js';
import { gracefulShutdown } from './lib/shutdown.js';

// =============================================================================
// Type Re-exports for Frontend
// =============================================================================

/**
 * Re-export AppType for frontend consumption.
 *
 * Frontend can import:
 * ```typescript
 * import type { AppType } from '@yg-app/backend';
 * ```
 */
export type { AppType } from './app.js';

// =============================================================================
// Server Startup
// =============================================================================

const server = serve(
  {
    fetch: app.fetch,
    port: config.PORT,
  },
  (info) => {
    logger.info(
      {
        port: info.port,
        env: config.NODE_ENV,
        version: config.VERSION,
      },
      `🚀 Server running at http://localhost:${info.port}`
    );
  }
);

// Graceful shutdown
gracefulShutdown(server, {
  onShutdown: async () => {
    // Shutdown OpenTelemetry to flush remaining spans
    await shutdownOtel();

    logger.info('Closing database connections...');
    const { closeDb } = await import('./db/client.js');
    await closeDb();
  },
});
