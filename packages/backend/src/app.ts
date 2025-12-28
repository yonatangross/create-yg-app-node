import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { usersRoutes } from './routes/users.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

// Global middleware
app.use('*', requestId());
app.use('*', requestLogger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: ['http://localhost:4173', 'http://localhost:4000'],
    credentials: true,
  })
);

// Error handling
app.onError(errorHandler);

// Routes
app.route('/health', healthRoutes);
app.route('/api/users', usersRoutes);

// 404 handler
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

export { app };
