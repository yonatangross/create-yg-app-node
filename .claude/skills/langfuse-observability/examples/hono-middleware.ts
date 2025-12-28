/**
 * Hono Middleware Integration for Langfuse
 *
 * Production-ready middleware for request-scoped LLM tracing.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import { nanoid } from 'nanoid';
import { Langfuse } from 'langfuse';
import { CallbackHandler } from '@langfuse/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { Context, Next } from 'hono';

// ============================================================================
// Type Augmentation
// ============================================================================

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    userId?: string;
    langfuseHandler: CallbackHandler;
  }
}

// ============================================================================
// Langfuse Client (Singleton)
// ============================================================================

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASEURL,
  // Production batching settings
  flushAt: process.env.NODE_ENV === 'production' ? 25 : 1,
  flushInterval: process.env.NODE_ENV === 'production' ? 10000 : 1000,
});

// ============================================================================
// Middleware: Request ID
// ============================================================================

export function requestIdMiddleware() {
  return async (c: Context, next: Next) => {
    const requestId = c.req.header('x-request-id') || nanoid();
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);
    await next();
  };
}

// ============================================================================
// Middleware: Auth (Example)
// ============================================================================

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    // Example: Extract user from JWT
    const authHeader = c.req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // In real app: verify JWT and extract userId
      const token = authHeader.slice(7);
      // const decoded = verifyJwt(token);
      c.set('userId', `user-${token.slice(0, 8)}`); // Placeholder
    }
    await next();
  };
}

// ============================================================================
// Middleware: Langfuse Handler
// ============================================================================

export function langfuseMiddleware() {
  return async (c: Context, next: Next) => {
    const handler = new CallbackHandler({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_BASEURL,
      // Request context
      userId: c.get('userId'),
      sessionId: c.req.header('x-session-id') || undefined,
      // Metadata for filtering/debugging
      metadata: {
        requestId: c.get('requestId'),
        path: c.req.path,
        method: c.req.method,
        userAgent: c.req.header('user-agent'),
      },
      // Tags for dashboard filtering
      tags: [
        process.env.NODE_ENV || 'development',
        c.req.path.split('/')[2] || 'unknown', // e.g., 'chat', 'completion'
      ],
    });

    c.set('langfuseHandler', handler);

    try {
      await next();

      // Log success if 2xx status
      if (c.res.status >= 200 && c.res.status < 300) {
        handler.langfuse.score({
          traceId: handler.traceId,
          name: 'http-success',
          value: 1,
          dataType: 'BOOLEAN',
        });
      }
    } catch (error) {
      // Log error
      handler.langfuse.score({
        traceId: handler.traceId,
        name: 'http-error',
        value: 0,
        dataType: 'BOOLEAN',
        comment: error instanceof Error ? error.message : 'Unknown error',
      });

      handler.langfuse.trace({
        id: handler.traceId,
        tags: ['error'],
        metadata: {
          error: {
            name: error instanceof Error ? error.name : 'Error',
            message: error instanceof Error ? error.message : String(error),
          },
        },
      });

      throw error;
    } finally {
      // CRITICAL: Always flush
      await handler.flushAsync();
    }
  };
}

// ============================================================================
// LLM Chain Setup
// ============================================================================

const model = new ChatOpenAI({
  modelName: 'gpt-4-turbo',
  temperature: 0.7,
});

const chatPrompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant. Be concise and informative.'],
  ['human', '{message}'],
]);

const chatChain = chatPrompt.pipe(model).pipe(new StringOutputParser());

// ============================================================================
// App Setup
// ============================================================================

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors());
app.use('*', requestIdMiddleware());
app.use('*', authMiddleware());

// Langfuse middleware only for AI routes
app.use('/api/ai/*', langfuseMiddleware());

// ============================================================================
// Routes
// ============================================================================

/**
 * Basic chat endpoint with tracing
 */
app.post('/api/ai/chat', async (c) => {
  const handler = c.get('langfuseHandler');
  const { message } = await c.req.json<{ message: string }>();

  const response = await chatChain.invoke(
    { message },
    { callbacks: [handler] }
  );

  return c.json({
    response,
    traceId: handler.traceId, // Return for debugging/feedback
  });
});

/**
 * Streaming chat endpoint with tracing
 */
app.post('/api/ai/chat/stream', async (c) => {
  const handler = c.get('langfuseHandler');
  const { message } = await c.req.json<{ message: string }>();

  return streamSSE(c, async (stream) => {
    try {
      const llmStream = await chatChain.stream(
        { message },
        { callbacks: [handler] }
      );

      for await (const chunk of llmStream) {
        await stream.writeSSE({
          data: JSON.stringify({ content: chunk }),
        });
      }

      // Send trace ID at end for feedback linking
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ traceId: handler.traceId }),
      });
    } catch (error) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          traceId: handler.traceId,
        }),
      });
    }
  });
});

/**
 * Feedback endpoint for trace scoring
 */
app.post('/api/ai/feedback', async (c) => {
  const { traceId, helpful, rating, comment } = await c.req.json<{
    traceId: string;
    helpful?: boolean;
    rating?: number;
    comment?: string;
  }>();

  // Score the trace
  if (helpful !== undefined) {
    langfuse.score({
      traceId,
      name: 'user-helpful',
      value: helpful ? 1 : 0,
      dataType: 'BOOLEAN',
      comment,
    });
  }

  if (rating !== undefined) {
    langfuse.score({
      traceId,
      name: 'user-rating',
      value: rating,
      dataType: 'NUMERIC',
      comment,
    });
  }

  await langfuse.flushAsync();

  return c.json({ success: true });
});

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({ status: 'healthy' });
});

app.get('/health/langfuse', async (c) => {
  try {
    const trace = langfuse.trace({
      name: 'health-check',
      metadata: { type: 'health' },
    });
    trace.update({ output: 'ok' });
    await langfuse.flushAsync();

    return c.json({ status: 'healthy', traceId: trace.id });
  } catch (error) {
    return c.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown',
      },
      500
    );
  }
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown() {
  console.log('Shutting down...');
  await langfuse.shutdownAsync();
  console.log('Langfuse flushed');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================================================
// Export
// ============================================================================

export default app;

// For running directly
// import { serve } from '@hono/node-server';
// serve({ fetch: app.fetch, port: 3000 });
