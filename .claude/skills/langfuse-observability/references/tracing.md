# LangChain.js Tracing with Langfuse

## CallbackHandler Overview

The `@langfuse/langchain` package provides automatic tracing for all LangChain.js operations:
- **Chains**: Every invoke, batch, and stream call
- **Agents**: Tool calls, reasoning steps, final outputs
- **Retrievers**: Vector searches, document fetches
- **LLM Calls**: Prompts, completions, token counts

## Basic Usage

```typescript
import { CallbackHandler } from '@langfuse/langchain';

const handler = new CallbackHandler({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
});

// Automatic tracing for any chain
const result = await chain.invoke(
  { input: 'Your question here' },
  { callbacks: [handler] }
);

// CRITICAL: Always flush to ensure data is sent
await handler.flushAsync();
```

## Trace Context

### User Association
```typescript
const handler = new CallbackHandler({
  userId: 'user-123',  // Links trace to user in Langfuse
});
```

### Session Grouping
```typescript
const handler = new CallbackHandler({
  sessionId: 'conversation-456',  // Groups traces by session
});
```

### Custom Metadata
```typescript
const handler = new CallbackHandler({
  metadata: {
    feature: 'document-qa',
    environment: 'production',
    version: '2.1.0',
  },
  tags: ['production', 'rag', 'priority-high'],
});
```

## Streaming with Traces

```typescript
import { streamSSE } from 'hono/streaming';

app.get('/api/chat/stream', async (c) => {
  const handler = new CallbackHandler({
    userId: c.get('userId'),
  });

  return streamSSE(c, async (stream) => {
    const llmStream = await chain.stream(
      { input: message },
      { callbacks: [handler] }
    );

    for await (const chunk of llmStream) {
      await stream.writeSSE({
        data: JSON.stringify({ content: chunk }),
      });
    }

    // Flush after stream completes
    await handler.flushAsync();
  });
});
```

## Manual Spans within Traces

```typescript
// Access the underlying Langfuse client
const trace = handler.langfuse.trace({
  id: handler.traceId,  // Use same trace ID
});

// Add custom span
const span = trace.span({
  name: 'custom-processing',
  input: { step: 'validation' },
});

// Do work...
await validateInput(input);

span.end({ output: { valid: true } });
```

## Trace Hierarchies

LangChain.js operations automatically create nested traces:

```
Trace: rag-query
├── Span: retriever
│   ├── Generation: embed-query (text-embedding-3-small)
│   └── Span: vector-search
├── Generation: llm-call (gpt-4-turbo)
└── Span: output-parse
```

## Debug Mode

```typescript
const handler = new CallbackHandler({
  debug: true,  // Logs all events to console
});
```

## Error Tracing

```typescript
try {
  const result = await chain.invoke(input, { callbacks: [handler] });
} catch (error) {
  // Error is automatically captured in trace
  // Add additional context:
  handler.langfuse.trace({
    id: handler.traceId,
    metadata: {
      errorType: error.name,
      errorMessage: error.message,
    },
    tags: ['error'],
  });
  throw error;
} finally {
  await handler.flushAsync();
}
```

## Multiple Chains in One Trace

```typescript
const handler = new CallbackHandler();

// First chain
const summaryResult = await summaryChain.invoke(
  { document },
  { callbacks: [handler] }
);

// Second chain (same trace)
const analysisResult = await analysisChain.invoke(
  { summary: summaryResult },
  { callbacks: [handler] }
);

await handler.flushAsync();
// Both chains appear under single trace
```
