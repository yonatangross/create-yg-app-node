---
name: langfuse-observability
description: Use this skill for LLM observability, tracing, prompt management, and evaluations with Langfuse. Integrates with LangChain.js for production monitoring.
version: 1.0.0
author: YG Node Starter
tags: [observability, tracing, llm, langfuse, monitoring, analytics]
---

# Langfuse Observability

## Overview

Production patterns for LLM observability using Langfuse with LangChain.js. Provides tracing, prompt management, cost tracking, and LLM evaluations.

## Basic Setup

### Installation
```bash
pnpm add langfuse @langfuse/langchain
```

### Environment Configuration
```bash
# .env
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASEURL=https://cloud.langfuse.com  # or self-hosted URL
```

### Initialize Client
```typescript
import { Langfuse } from 'langfuse';

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASEURL,
});

// Ensure traces are flushed on shutdown
process.on('beforeExit', async () => {
  await langfuse.shutdownAsync();
});
```

## LangChain.js Integration

### Callback Handler (Automatic Tracing)
```typescript
import { CallbackHandler } from '@langfuse/langchain';

// Create handler for a trace
const langfuseHandler = new CallbackHandler({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  userId: 'user-123',           // Optional: associate with user
  sessionId: 'session-456',     // Optional: group traces by session
  metadata: { feature: 'chat' }, // Optional: custom metadata
});

// Use with any LangChain chain
const result = await chain.invoke(
  { input: 'Hello!' },
  { callbacks: [langfuseHandler] }
);

// Flush at end of request
await langfuseHandler.flushAsync();
```

### Tracing with Scores
```typescript
const handler = new CallbackHandler();

const result = await chain.invoke({ input }, { callbacks: [handler] });

// Add score to trace (for evaluations/analytics)
handler.langfuse.score({
  traceId: handler.traceId,
  name: 'user-feedback',
  value: 1,  // 0-1 or -1 to 1
  comment: 'User rated response as helpful',
});

await handler.flushAsync();
```

## Prompt Management

### Fetch Prompts from Langfuse
```typescript
import { Langfuse } from 'langfuse';
import { PromptTemplate } from '@langchain/core/prompts';

const langfuse = new Langfuse();

// Get prompt by name (with optional version/label)
const langfusePrompt = await langfuse.getPrompt('rag-assistant');

// Convert to LangChain prompt
const prompt = PromptTemplate.fromTemplate(
  langfusePrompt.getLangchainPrompt()  // Handles variable syntax conversion
);

// Link prompt to traces for analytics
const promptWithMetadata = prompt.withConfig({
  metadata: { langfusePrompt },  // Auto-links to prompt version
});
```

### Prompt Versioning Pattern
```typescript
// Development: use latest
const devPrompt = await langfuse.getPrompt('summarizer');

// Production: pin to label or version
const prodPrompt = await langfuse.getPrompt('summarizer', undefined, {
  label: 'production',  // Use labeled version
});

// Or specific version
const pinnedPrompt = await langfuse.getPrompt('summarizer', 3);
```

### Chat Prompts
```typescript
import { ChatPromptTemplate } from '@langchain/core/prompts';

const langfusePrompt = await langfuse.getPrompt('chat-assistant', undefined, {
  type: 'chat',  // Specify chat type
});

// Convert chat messages array to LangChain format
const messages = langfusePrompt.getLangchainPrompt();
const chatPrompt = ChatPromptTemplate.fromMessages(messages);
```

## Manual Tracing

### Custom Traces
```typescript
const trace = langfuse.trace({
  name: 'document-processing',
  userId: 'user-123',
  metadata: { documentId: 'doc-456' },
  tags: ['batch', 'pdf'],
});

// Create spans for operations
const span = trace.span({
  name: 'extract-text',
  input: { pages: 10 },
});

// Log results
span.end({ output: { characters: 50000 } });

// Create generation for LLM calls
const generation = trace.generation({
  name: 'summarize',
  model: 'gpt-4-turbo',
  modelParameters: { temperature: 0 },
  input: [{ role: 'user', content: 'Summarize...' }],
});

// After LLM response
generation.end({
  output: 'Summary text...',
  usage: { input: 1000, output: 200 },
});
```

### Nested Spans
```typescript
const trace = langfuse.trace({ name: 'rag-query' });

// Parent span
const retrievalSpan = trace.span({ name: 'retrieval' });

// Child spans
const embeddingGen = retrievalSpan.generation({
  name: 'embed-query',
  model: 'text-embedding-3-small',
});
embeddingGen.end({ usage: { input: 50 } });

const searchSpan = retrievalSpan.span({ name: 'vector-search' });
searchSpan.end({ output: { documents: 5 } });

retrievalSpan.end();

// LLM generation
const llmGen = trace.generation({
  name: 'generate-answer',
  model: 'gpt-4-turbo',
  input: messages,
});
llmGen.end({ output: response, usage: { input: 2000, output: 500 } });
```

## Evaluations

### Score Traces
```typescript
// User feedback
langfuse.score({
  traceId: 'trace-123',
  name: 'user-rating',
  value: 5,
  dataType: 'NUMERIC',  // NUMERIC, BOOLEAN, or CATEGORICAL
});

// Binary feedback
langfuse.score({
  traceId: 'trace-123',
  name: 'helpful',
  value: 1,
  dataType: 'BOOLEAN',
});

// Categorical
langfuse.score({
  traceId: 'trace-123',
  name: 'category',
  value: 'accurate',
  dataType: 'CATEGORICAL',
});
```

### LLM-as-Judge Evaluations
```typescript
// Create evaluation trace
const evalTrace = langfuse.trace({ name: 'llm-evaluation' });

// Get original trace to evaluate
const originalTrace = await langfuse.fetchTrace('original-trace-id');

// Run evaluation
const evalResult = await evaluatorChain.invoke({
  query: originalTrace.input,
  response: originalTrace.output,
});

// Score the original trace
langfuse.score({
  traceId: 'original-trace-id',
  name: 'llm-judge-relevance',
  value: evalResult.score,
  comment: evalResult.reasoning,
});
```

## Cost Tracking

### Automatic (with CallbackHandler)
```typescript
// Cost is automatically calculated for supported models
const handler = new CallbackHandler();
await chain.invoke(input, { callbacks: [handler] });
// Costs appear in Langfuse dashboard
```

### Manual Cost Logging
```typescript
const generation = trace.generation({
  name: 'custom-model',
  model: 'custom-llm',
  input: prompt,
});

generation.end({
  output: response,
  usage: {
    input: inputTokens,
    output: outputTokens,
    unit: 'TOKENS',
  },
  // Custom cost calculation
  metadata: {
    inputCost: inputTokens * 0.00001,
    outputCost: outputTokens * 0.00003,
    totalCost: (inputTokens * 0.00001) + (outputTokens * 0.00003),
  },
});
```

## Production Patterns

### Request-Scoped Handler
```typescript
import { Hono } from 'hono';
import { CallbackHandler } from '@langfuse/langchain';

const app = new Hono();

// Middleware to create trace per request
app.use('/api/ai/*', async (c, next) => {
  const handler = new CallbackHandler({
    userId: c.get('userId'),
    sessionId: c.req.header('x-session-id'),
    metadata: {
      path: c.req.path,
      method: c.req.method,
    },
  });

  c.set('langfuseHandler', handler);

  await next();

  // Flush after response
  await handler.flushAsync();
});

app.post('/api/ai/chat', async (c) => {
  const handler = c.get('langfuseHandler');
  const { message } = await c.req.json();

  const result = await chain.invoke(
    { input: message },
    { callbacks: [handler] }
  );

  return c.json({ response: result });
});
```

### Batched Flushing
```typescript
import { Langfuse } from 'langfuse';

// Configure batching for high-throughput
const langfuse = new Langfuse({
  flushAt: 15,          // Batch size before flush
  flushInterval: 5000,  // Max ms between flushes
});

// For high-volume: disable per-request flush
const handler = new CallbackHandler({
  flushAt: 50,  // Larger batches
});
```

### Error Handling
```typescript
try {
  const result = await chain.invoke(input, { callbacks: [handler] });

  handler.langfuse.score({
    traceId: handler.traceId,
    name: 'success',
    value: 1,
  });

  return result;
} catch (error) {
  // Log error to trace
  handler.langfuse.score({
    traceId: handler.traceId,
    name: 'error',
    value: 0,
    comment: error.message,
  });

  // Update trace with error
  handler.langfuse.trace({
    id: handler.traceId,
    metadata: { error: error.message, stack: error.stack },
    tags: ['error'],
  });

  throw error;
} finally {
  await handler.flushAsync();
}
```

## Best Practices

1. **Always flush** at request end: `await handler.flushAsync()`
2. **Use sessions** to group related traces
3. **Add user IDs** for per-user analytics
4. **Tag traces** for filtering (e.g., `['production', 'chat']`)
5. **Link prompts** to traces for A/B testing
6. **Score traces** for quality monitoring
7. **Pin prompt versions** in production
8. **Handle shutdown** to prevent data loss:
   ```typescript
   process.on('SIGTERM', async () => {
     await langfuse.shutdownAsync();
   });
   ```
