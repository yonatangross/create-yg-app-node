import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config/env.js';
import { logger } from './lib/logger.js';
import { gracefulShutdown } from './lib/shutdown.js';

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
    logger.info('Closing database connections...');
    // Add database cleanup here
  },
});
