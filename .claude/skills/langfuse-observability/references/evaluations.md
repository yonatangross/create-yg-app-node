# LLM Evaluations with Langfuse

## Overview

Langfuse evaluations enable quality tracking through:
- **Scores**: Numeric, boolean, or categorical ratings
- **User Feedback**: Capture thumbs up/down, ratings
- **LLM-as-Judge**: Automated evaluation using LLMs
- **Custom Evaluators**: Domain-specific quality metrics

## Score Types

### Numeric Scores
```typescript
langfuse.score({
  traceId: 'trace-123',
  name: 'relevance',
  value: 0.85,           // 0-1 or custom range
  dataType: 'NUMERIC',
  comment: 'Response was mostly relevant',
});
```

### Boolean Scores
```typescript
langfuse.score({
  traceId: 'trace-123',
  name: 'contains-hallucination',
  value: 0,              // 0 = false, 1 = true
  dataType: 'BOOLEAN',
});
```

### Categorical Scores
```typescript
langfuse.score({
  traceId: 'trace-123',
  name: 'response-quality',
  value: 'excellent',    // String category
  dataType: 'CATEGORICAL',
});
```

## User Feedback Patterns

### Thumbs Up/Down
```typescript
// API endpoint for feedback
app.post('/api/feedback', async (c) => {
  const { traceId, helpful } = await c.req.json();

  langfuse.score({
    traceId,
    name: 'user-helpful',
    value: helpful ? 1 : 0,
    dataType: 'BOOLEAN',
  });

  await langfuse.flushAsync();
  return c.json({ success: true });
});
```

### Star Ratings
```typescript
app.post('/api/rating', async (c) => {
  const { traceId, rating, comment } = await c.req.json();

  langfuse.score({
    traceId,
    name: 'user-rating',
    value: rating,        // 1-5
    dataType: 'NUMERIC',
    comment,
  });

  await langfuse.flushAsync();
  return c.json({ success: true });
});
```

### Multiple Criteria
```typescript
interface DetailedFeedback {
  traceId: string;
  accuracy: number;      // 1-5
  helpfulness: number;   // 1-5
  clarity: number;       // 1-5
  comment?: string;
}

app.post('/api/detailed-feedback', async (c) => {
  const feedback: DetailedFeedback = await c.req.json();

  const scores = [
    { name: 'accuracy', value: feedback.accuracy },
    { name: 'helpfulness', value: feedback.helpfulness },
    { name: 'clarity', value: feedback.clarity },
  ];

  for (const score of scores) {
    langfuse.score({
      traceId: feedback.traceId,
      name: `user-${score.name}`,
      value: score.value,
      dataType: 'NUMERIC',
      comment: feedback.comment,
    });
  }

  await langfuse.flushAsync();
  return c.json({ success: true });
});
```

## LLM-as-Judge Evaluations

### Basic Evaluator
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

const evaluationSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  issues: z.array(z.string()),
});

const parser = StructuredOutputParser.fromZodSchema(evaluationSchema);

const evaluator = new ChatOpenAI({
  modelName: 'gpt-4-turbo',
  temperature: 0,
});

async function evaluateResponse(
  query: string,
  response: string,
  criteria: string
): Promise<z.infer<typeof evaluationSchema>> {
  const prompt = `Evaluate the following response based on: ${criteria}

Query: ${query}
Response: ${response}

${parser.getFormatInstructions()}`;

  const result = await evaluator.invoke(prompt);
  return parser.parse(result.content as string);
}
```

### Batch Evaluation Job
```typescript
async function runEvaluationBatch() {
  // Fetch traces to evaluate
  const traces = await langfuse.fetchTraces({
    name: 'chat-response',
    fromTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
    limit: 100,
  });

  for (const trace of traces.data) {
    // Skip already evaluated
    const hasScore = trace.scores?.some(s => s.name === 'llm-judge-relevance');
    if (hasScore) continue;

    // Run evaluation
    const evaluation = await evaluateResponse(
      trace.input,
      trace.output,
      'relevance, accuracy, and helpfulness'
    );

    // Record score
    langfuse.score({
      traceId: trace.id,
      name: 'llm-judge-relevance',
      value: evaluation.score,
      comment: evaluation.reasoning,
    });
  }

  await langfuse.flushAsync();
}
```

### RAG-Specific Evaluations
```typescript
interface RAGEvaluation {
  faithfulness: number;    // Does response match retrieved context?
  relevance: number;       // Is response relevant to query?
  completeness: number;    // Does it answer the full question?
}

async function evaluateRAGResponse(
  query: string,
  context: string[],
  response: string
): Promise<RAGEvaluation> {
  const faithfulnessPrompt = `
Given the context and response, rate faithfulness (0-1).
Faithfulness = response only contains information from context.

Context:
${context.join('\n---\n')}

Response:
${response}

Score (0-1):`;

  // Similar for relevance and completeness...

  return {
    faithfulness: await scoreSingleCriterion(faithfulnessPrompt),
    relevance: await scoreSingleCriterion(relevancePrompt),
    completeness: await scoreSingleCriterion(completenessPrompt),
  };
}
```

## Evaluation Datasets

### Create Dataset
```typescript
// In Langfuse UI or via API
const dataset = await langfuse.createDataset({
  name: 'qa-test-cases',
  description: 'Test cases for QA evaluation',
});

// Add items
await langfuse.createDatasetItem({
  datasetName: 'qa-test-cases',
  input: { query: 'What is the capital of France?' },
  expectedOutput: 'Paris',
  metadata: { category: 'geography', difficulty: 'easy' },
});
```

### Run Evaluation on Dataset
```typescript
async function evaluateOnDataset(datasetName: string) {
  const dataset = await langfuse.getDataset(datasetName);

  for (const item of dataset.items) {
    // Create run
    const trace = langfuse.trace({
      name: 'dataset-evaluation',
      metadata: { datasetItem: item.id },
    });

    // Get response from your chain
    const response = await chain.invoke(item.input);

    // Compare with expected
    const isCorrect = response.toLowerCase().includes(
      item.expectedOutput.toLowerCase()
    );

    // Score
    langfuse.score({
      traceId: trace.id,
      name: 'exact-match',
      value: isCorrect ? 1 : 0,
      dataType: 'BOOLEAN',
    });

    // Link to dataset item
    await langfuse.createDatasetRunItem({
      datasetItemId: item.id,
      traceId: trace.id,
    });
  }

  await langfuse.flushAsync();
}
```

## Monitoring Dashboards

Use Langfuse dashboard to:
1. **Track score distributions** over time
2. **Filter by score** to find problematic traces
3. **Compare prompt versions** using linked scores
4. **Set alerts** on score thresholds
5. **Export data** for custom analysis

## Best Practices

1. **Use consistent score names** across the application
2. **Include reasoning** in LLM-judge comments
3. **Batch evaluations** to avoid rate limits
4. **Sample strategically** - evaluate representative traces
5. **Combine methods** - user feedback + automated evaluation
6. **Track over time** - watch for quality drift
7. **Create datasets** for regression testing
