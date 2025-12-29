# Production Patterns for Langfuse

## Overview

Production-ready patterns for Langfuse integration:
- Request-scoped handlers
- Middleware integration
- Batching and performance
- Error handling
- Graceful shutdown

## Hono Middleware Integration

### Basic Middleware
```typescript
import { Hono } from 'hono';
import { CallbackHandler } from '@langfuse/langchain';
import type { Context, Next } from 'hono';

// Type augmentation for Hono context
declare module 'hono' {
  interface ContextVariableMap {
    langfuseHandler: CallbackHandler;
  }
}

// Middleware factory
export function langfuseMiddleware() {
  return async (c: Context, next: Next) => {
    const handler = new CallbackHandler({
      userId: c.get('userId'),  // From auth middleware
      sessionId: c.req.header('x-session-id'),
      metadata: {
        path: c.req.path,
        method: c.req.method,
        userAgent: c.req.header('user-agent'),
      },
      tags: [process.env.NODE_ENV || 'development'],
    });

    c.set('langfuseHandler', handler);

    try {
      await next();
    } finally {
      // Always flush, even on error
      await handler.flushAsync();
    }
  };
}

// Usage
const app = new Hono();
app.use('/api/ai/*', langfuseMiddleware());

app.post('/api/ai/chat', async (c) => {
  const handler = c.get('langfuseHandler');
  const { message } = await c.req.json();

  const result = await chain.invoke(
    { input: message },
    { callbacks: [handler] }
  );

  return c.json({ response: result, traceId: handler.traceId });
});
```

### With Request ID
```typescript
import { nanoid } from 'nanoid';

app.use('/api/*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || nanoid();
  c.header('x-request-id', requestId);
  c.set('requestId', requestId);
  await next();
});

app.use('/api/ai/*', async (c, next) => {
  const handler = new CallbackHandler({
    metadata: {
      requestId: c.get('requestId'),
    },
  });
  c.set('langfuseHandler', handler);

  try {
    await next();
  } finally {
    await handler.flushAsync();
  }
});
```

## Batching Configuration

### High-Throughput Settings
```typescript
import { Langfuse } from 'langfuse';

// For high-volume applications
const langfuse = new Langfuse({
  flushAt: 25,           // Batch size before auto-flush
  flushInterval: 10000,  // Max 10s between flushes
});

// Per-handler batching
const handler = new CallbackHandler({
  flushAt: 25,
  flushInterval: 10000,
});
```

### Low-Latency Settings
```typescript
// For real-time requirements
const langfuse = new Langfuse({
  flushAt: 1,            // Flush immediately
  flushInterval: 1000,   // Or every 1s
});
```

### Background Worker Pattern
```typescript
// For batch processing jobs
const langfuse = new Langfuse({
  flushAt: 100,          // Large batches
  flushInterval: 30000,  // 30s intervals
});

async function processDocuments(docs: Document[]) {
  for (const doc of docs) {
    const trace = langfuse.trace({
      name: 'document-processing',
      metadata: { docId: doc.id },
    });

    await processDocument(doc, trace);
  }

  // Single flush at end
  await langfuse.flushAsync();
}
```

## Error Handling

### Comprehensive Error Capture
```typescript
async function invokeWithTracing<T>(
  chain: RunnableSequence,
  input: Record<string, unknown>,
  handler: CallbackHandler
): Promise<T> {
  try {
    const result = await chain.invoke(input, { callbacks: [handler] });

    // Success score
    handler.langfuse.score({
      traceId: handler.traceId,
      name: 'success',
      value: 1,
      dataType: 'BOOLEAN',
    });

    return result as T;
  } catch (error) {
    // Capture error details
    handler.langfuse.score({
      traceId: handler.traceId,
      name: 'error',
      value: 0,
      dataType: 'BOOLEAN',
      comment: error instanceof Error ? error.message : 'Unknown error',
    });

    // Update trace metadata
    handler.langfuse.trace({
      id: handler.traceId,
      metadata: {
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      tags: ['error'],
    });

    throw error;
  } finally {
    await handler.flushAsync();
  }
}
```

### Retry with Tracing
```typescript
async function invokeWithRetry<T>(
  chain: RunnableSequence,
  input: Record<string, unknown>,
  maxRetries = 3
): Promise<T> {
  const handler = new CallbackHandler();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await chain.invoke(input, { callbacks: [handler] });

      handler.langfuse.trace({
        id: handler.traceId,
        metadata: { attempts: attempt, success: true },
      });

      return result as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      handler.langfuse.span({
        name: `retry-attempt-${attempt}`,
        input: { error: lastError.message },
        level: 'WARNING',
      });

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  handler.langfuse.trace({
    id: handler.traceId,
    metadata: { attempts: maxRetries, success: false },
    tags: ['max-retries-exceeded'],
  });

  await handler.flushAsync();
  throw lastError;
}
```

## Graceful Shutdown

### Process Handlers
```typescript
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse();

// Ensure flush on process exit
async function shutdown() {
  console.log('Shutting down, flushing Langfuse...');
  await langfuse.shutdownAsync();
  console.log('Langfuse flushed');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// For uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await langfuse.flushAsync();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection:', reason);
  await langfuse.flushAsync();
  process.exit(1);
});
```

### With Hono
```typescript
import { serve } from '@hono/node-server';

const server = serve({
  fetch: app.fetch,
  port: 3000,
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Graceful shutdown initiated');

  server.close(async () => {
    console.log('HTTP server closed');
    await langfuse.shutdownAsync();
    console.log('Langfuse flushed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Health Checks

### Langfuse Health Endpoint
```typescript
app.get('/health/langfuse', async (c) => {
  try {
    // Simple trace to verify connectivity
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
        error: error instanceof Error ? error.message : 'Unknown'
      },
      500
    );
  }
});
```

## Environment-Specific Configuration

```typescript
const langfuseConfig = {
  development: {
    flushAt: 1,           // Immediate flush for debugging
    flushInterval: 1000,
  },
  staging: {
    flushAt: 10,
    flushInterval: 5000,
  },
  production: {
    flushAt: 25,
    flushInterval: 10000,
  },
};

const config = langfuseConfig[process.env.NODE_ENV || 'development'];

const langfuse = new Langfuse({
  ...config,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
});
```

## Best Practices

1. **Always use middleware** for consistent tracing
2. **Flush in finally block** to handle errors
3. **Include request IDs** for correlation
4. **Configure batching** per environment
5. **Handle shutdown gracefully** to prevent data loss
6. **Add health checks** for monitoring
7. **Tag by environment** for filtering
8. **Log traceId** for debugging support requests
