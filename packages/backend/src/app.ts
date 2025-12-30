/**
 * Hono Application with RPC Type Export
 *
 * Uses method chaining for proper type inference with hono/client
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { usersRoutes } from './routes/users.js';
import { chatRoutes, ragRoutes } from './routes/chat.js';
import { getConfig } from './core/config.js';
import type { AppEnv } from './types.js';

// =============================================================================
// Base App with Middleware
// =============================================================================

const baseApp = new Hono<AppEnv>();

const config = getConfig();

// Global middleware
baseApp.use('*', requestId());
baseApp.use('*', requestLogger());

// Body size limit to prevent DoS attacks (1MB default, 10MB for uploads)
baseApp.use(
  '*',
  bodyLimit({
    maxSize: 1024 * 1024, // 1MB
    onError: (c) => {
      return c.json(
        {
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request body exceeds 1MB limit',
          },
        },
        413
      );
    },
  })
);

// Security headers with CSP and HSTS
// In production, apply strict CSP; in dev, use minimal headers for hot-reload
if (config.NODE_ENV === 'production') {
  baseApp.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  );
} else {
  // Development: minimal security headers (CSP disabled for hot-reload)
  baseApp.use(
    '*',
    secureHeaders({
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  );
}

// Parse CORS origins from environment configuration
const corsOrigins = config.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Validate no wildcards in production (security risk)
if (config.NODE_ENV === 'production') {
  if (corsOrigins.some((origin) => origin.includes('*'))) {
    throw new Error('Wildcard CORS origins are forbidden in production');
  }
}

baseApp.use(
  '*',
  cors({
    origin: corsOrigins,
    credentials: true,
    maxAge: 600, // 10 minutes preflight cache
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposeHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
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
