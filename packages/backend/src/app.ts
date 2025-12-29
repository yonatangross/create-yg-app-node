/**
 * Hono Application with RPC Type Export
 *
 * Uses method chaining for proper type inference with hono/client
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { usersRoutes } from './routes/users.js';
import { chatRoutes, ragRoutes } from './routes/chat.js';
import type { AppEnv } from './types.js';

// =============================================================================
// Base App with Middleware
// =============================================================================

const baseApp = new Hono<AppEnv>();

// Global middleware
baseApp.use('*', requestId());
baseApp.use('*', requestLogger());
baseApp.use('*', secureHeaders());
baseApp.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:4000'],
    credentials: true,
  })
);

// Error handling
baseApp.onError(errorHandler);

// =============================================================================
// Routes with Method Chaining for RPC Type Inference
// =============================================================================

/**
 * App with all routes mounted using method chaining.
 * This enables proper type inference for Hono RPC client.
 *
 * The chain pattern ensures TypeScript can infer all route types
 * for end-to-end type safety with the frontend.
 */
const app = baseApp
  .route('/health', healthRoutes)
  .route('/api/users', usersRoutes)
  .route('/api/chat', chatRoutes)
  .route('/api/rag', ragRoutes);

// 404 handler (added after chaining since it doesn't affect types)
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

// =============================================================================
// Type Export for Frontend RPC Client
// =============================================================================

/**
 * Export app type for Hono RPC client.
 *
 * Frontend usage:
 * ```typescript
 * import { hc } from 'hono/client';
 * import type { AppType } from '@backend/app';
 *
 * const client = hc<AppType>('http://localhost:3000');
 * const res = await client.api.users.$get();
 * ```
 */
export type AppType = typeof app;

export { app };
