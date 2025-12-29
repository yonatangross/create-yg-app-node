# Cost & Usage Tracking with Langfuse

## Overview

Langfuse automatically tracks:
- **Token Usage**: Input and output tokens per generation
- **Cost Calculation**: Based on model pricing
- **Aggregations**: By user, session, prompt, model

## Automatic Cost Tracking

### With CallbackHandler
```typescript
import { CallbackHandler } from '@langfuse/langchain';

const handler = new CallbackHandler();

// Cost automatically calculated for supported models
await chain.invoke(input, { callbacks: [handler] });
await handler.flushAsync();

// View in Langfuse dashboard:
// - Total cost per trace
// - Token breakdown (input/output)
// - Model used
```

### Supported Models
- OpenAI (gpt-4, gpt-3.5-turbo, embeddings)
- Anthropic (claude-3-*, claude-2)
- Azure OpenAI
- Cohere
- And more...

## Manual Token Tracking

### For Custom/Unsupported Models
```typescript
const generation = trace.generation({
  name: 'custom-llm-call',
  model: 'my-custom-model',
  input: prompt,
});

generation.end({
  output: response,
  usage: {
    input: 1500,      // Input tokens
    output: 500,      // Output tokens
    total: 2000,      // Optional total
    unit: 'TOKENS',   // or 'CHARACTERS'
  },
});
```

### With Cost Metadata
```typescript
const inputCost = inputTokens * 0.00001;  // $0.01 per 1K
const outputCost = outputTokens * 0.00003; // $0.03 per 1K

generation.end({
  output: response,
  usage: { input: inputTokens, output: outputTokens },
  metadata: {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    modelPricing: { input: 0.01, output: 0.03 },
  },
});
```

## Embedding Cost Tracking

```typescript
const embeddingGen = trace.generation({
  name: 'embed-documents',
  model: 'text-embedding-3-small',
  input: { documentCount: documents.length },
});

const embeddings = await embeddingsModel.embedDocuments(texts);

embeddingGen.end({
  output: { vectorCount: embeddings.length },
  usage: {
    input: totalCharacters,  // Or tokens if available
    unit: 'CHARACTERS',
  },
});
```

## Cost Aggregation Patterns

### Per-User Cost Tracking
```typescript
// Always include userId
const handler = new CallbackHandler({
  userId: 'user-123',
});

// Query aggregated costs via Langfuse API or dashboard
// Filter by: userId, date range, model
```

### Per-Feature Cost Tracking
```typescript
const handler = new CallbackHandler({
  tags: ['feature:document-qa'],
  metadata: { feature: 'document-qa' },
});

// Dashboard: Filter by tag to see feature costs
```

### Per-Session Cost Tracking
```typescript
const handler = new CallbackHandler({
  sessionId: 'conversation-456',
});

// Dashboard: View session cost totals
```

## Budget Alerts

### Track Against Limits
```typescript
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse();

// After each call, check cumulative cost
const handler = new CallbackHandler();
await chain.invoke(input, { callbacks: [handler] });

// Get user's monthly usage
const traces = await langfuse.fetchTraces({
  userId: 'user-123',
  fromTimestamp: startOfMonth,
});

const totalCost = traces.data.reduce(
  (sum, t) => sum + (t.totalCost || 0),
  0
);

if (totalCost > USER_BUDGET) {
  throw new Error('Monthly budget exceeded');
}
```

### Real-time Monitoring
```typescript
// Add cost to response headers for client tracking
app.post('/api/ai/chat', async (c) => {
  const handler = new CallbackHandler();

  const result = await chain.invoke(input, { callbacks: [handler] });
  await handler.flushAsync();

  // Get trace for cost info
  const trace = await langfuse.fetchTrace(handler.traceId);

  return c.json(result, {
    headers: {
      'X-Token-Input': String(trace.usage?.input || 0),
      'X-Token-Output': String(trace.usage?.output || 0),
      'X-Cost-USD': String(trace.totalCost || 0),
    },
  });
});
```

## Token Counting Utilities

### Pre-count for Validation
```typescript
import { encodingForModel } from 'tiktoken';

const encoding = encodingForModel('gpt-4');

function countTokens(text: string): number {
  return encoding.encode(text).length;
}

// Validate before sending
const inputTokens = countTokens(prompt);
if (inputTokens > MAX_INPUT_TOKENS) {
  throw new Error(`Input too long: ${inputTokens} tokens`);
}
```

### Estimate Cost Before Call
```typescript
const MODEL_PRICING = {
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
};

function estimateCost(
  model: string,
  inputTokens: number,
  estimatedOutputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  return (
    (inputTokens * pricing.input) / 1000 +
    (estimatedOutputTokens * pricing.output) / 1000
  );
}

// Use before expensive calls
const estimated = estimateCost('gpt-4-turbo', inputTokens, 500);
if (estimated > MAX_COST_PER_CALL) {
  // Use cheaper model or truncate input
}
```

## Dashboard Queries

### Common Filters
- **By Date**: Last 7 days, 30 days, custom range
- **By Model**: Compare costs across models
- **By User**: Top users by cost
- **By Tag**: Feature-level costs
- **By Prompt**: Which prompts are most expensive

### Export for Analysis
```typescript
// Export trace data for custom analysis
const traces = await langfuse.fetchTraces({
  fromTimestamp: startDate,
  toTimestamp: endDate,
  limit: 1000,
});

// Write to CSV/JSON for reporting
const costReport = traces.data.map(t => ({
  id: t.id,
  timestamp: t.timestamp,
  userId: t.userId,
  model: t.observations?.[0]?.model,
  inputTokens: t.usage?.input,
  outputTokens: t.usage?.output,
  cost: t.totalCost,
}));
```

## Best Practices

1. **Always include userId** for per-user cost tracking
2. **Tag by feature** for cost attribution
3. **Set budget alerts** in Langfuse dashboard
4. **Pre-validate token counts** for large inputs
5. **Use cheaper models** for non-critical operations
6. **Cache embeddings** to reduce embedding costs
7. **Monitor daily** for unexpected cost spikes
8. **Export monthly** for finance reporting
