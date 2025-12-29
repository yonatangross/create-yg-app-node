---
name: langchain-js-patterns
description: Use this skill when building AI/LLM features with LangChain.js. Provides patterns for agents, RAG, chains, tools, and LangGraph workflows.
version: 1.0.0
author: YG Node Starter
tags: [ai, llm, langchain, langgraph, rag, typescript]
---

# LangChain.js Patterns

## Overview

Production patterns for building AI features with LangChain.js and LangGraph in Node.js/TypeScript applications.

## Basic Setup

### Installation
```bash
pnpm add @langchain/core @langchain/openai @langchain/anthropic @langchain/langgraph
```

### Model Configuration
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';

// OpenAI
const openai = new ChatOpenAI({
  modelName: 'gpt-4-turbo',
  temperature: 0,
  maxTokens: 4096,
});

// Anthropic
const claude = new ChatAnthropic({
  modelName: 'claude-3-5-sonnet-20241022',
  temperature: 0,
  maxTokens: 4096,
});
```

## Chain Patterns

### Simple Chain
```typescript
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant that {task}.'],
  ['human', '{input}'],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

const result = await chain.invoke({
  task: 'summarizes text',
  input: 'Long text to summarize...',
});
```

### Structured Output
```typescript
import { z } from 'zod';
import { StructuredOutputParser } from 'langchain/output_parsers';

const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    summary: z.string().describe('A brief summary'),
    keyPoints: z.array(z.string()).describe('Key points'),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
  })
);

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'Analyze the text and respond in JSON format.\n{format_instructions}'],
  ['human', '{input}'],
]);

const chain = prompt.pipe(model).pipe(parser);

const result = await chain.invoke({
  input: 'Text to analyze...',
  format_instructions: parser.getFormatInstructions(),
});
// result is typed: { summary: string, keyPoints: string[], sentiment: 'positive' | ... }
```

## RAG (Retrieval-Augmented Generation)

### Vector Store Setup (pgvector)
```typescript
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
});

const vectorStore = await PGVectorStore.initialize(embeddings, {
  postgresConnectionOptions: {
    connectionString: process.env.DATABASE_URL,
  },
  tableName: 'documents',
  columns: {
    idColumnName: 'id',
    vectorColumnName: 'embedding',
    contentColumnName: 'content',
    metadataColumnName: 'metadata',
  },
});
```

### Document Ingestion
```typescript
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from '@langchain/core/documents';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const docs = await splitter.createDocuments([text], [{ source: 'doc.pdf' }]);
await vectorStore.addDocuments(docs);
```

### RAG Chain
```typescript
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';

const retriever = vectorStore.asRetriever({ k: 5 });

const prompt = ChatPromptTemplate.fromMessages([
  ['system', `Answer based on the context. If unsure, say so.

Context: {context}`],
  ['human', '{input}'],
]);

const documentChain = await createStuffDocumentsChain({
  llm: model,
  prompt,
});

const ragChain = await createRetrievalChain({
  retriever,
  combineDocsChain: documentChain,
});

const result = await ragChain.invoke({ input: 'What is...?' });
// result.answer, result.context
```

## Tool Calling

### Define Tools
```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const searchTool = new DynamicStructuredTool({
  name: 'search',
  description: 'Search for information on a topic',
  schema: z.object({
    query: z.string().describe('The search query'),
  }),
  func: async ({ query }) => {
    const results = await searchService.search(query);
    return JSON.stringify(results);
  },
});

const calculatorTool = new DynamicStructuredTool({
  name: 'calculator',
  description: 'Perform mathematical calculations',
  schema: z.object({
    expression: z.string().describe('Math expression to evaluate'),
  }),
  func: async ({ expression }) => {
    return String(eval(expression)); // Use safe math library in production
  },
});
```

### Agent with Tools
```typescript
import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant with access to tools.'],
  ['placeholder', '{chat_history}'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
]);

const agent = await createOpenAIFunctionsAgent({
  llm: model,
  tools: [searchTool, calculatorTool],
  prompt,
});

const executor = new AgentExecutor({
  agent,
  tools: [searchTool, calculatorTool],
});

const result = await executor.invoke({
  input: 'What is the population of Tokyo times 2?',
  chat_history: [],
});
```

## LangGraph 1.0 Workflows (Dec 2025)

### Annotation API (CURRENT - replaces channels)
```typescript
import { Annotation, StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';

/**
 * Define state using Annotation.Root
 *
 * KEY PATTERNS:
 * 1. Spread MessagesAnnotation.spec for messages (includes proper reducer)
 * 2. Use Annotation<Type> directly for scalars (NO object form for simple values)
 * 3. Use object form ONLY when you need a custom reducer or default
 */
const AgentState = Annotation.Root({
  // ✅ Inherit messages with built-in reducer
  ...MessagesAnnotation.spec,

  // ✅ Scalar values - use Annotation<Type> directly (no object form)
  userId: Annotation<string>,
  sessionId: Annotation<string>,

  // ✅ Use object form ONLY for custom reducer/default
  sources: Annotation<Source[]>({
    reducer: (_prev, next) => next, // Replace on each update
    default: () => [],
  }),
});

// Type inference works automatically
export type AgentStateType = typeof AgentState.State;
```

### Node Functions with Proper Types
```typescript
/**
 * Node functions receive state and optional config
 * Return Partial<State> - only fields that changed
 */
async function agentNode(
  state: typeof AgentState.State,
  config?: RunnableConfig
): Promise<Partial<typeof AgentState.State>> {
  const model = getModel('agent');
  const response = await model.invoke(state.messages, config);

  return {
    messages: [response], // Reducer handles merge
  };
}

async function toolNode(
  state: typeof AgentState.State,
  _config?: RunnableConfig  // Prefix unused params with _
): Promise<Partial<typeof AgentState.State>> {
  const lastMessage = state.messages[state.messages.length - 1];
  // Execute tool calls...
  return { messages: [toolResult] };
}
```

### Graph Construction
```typescript
/**
 * Build graph with proper edge definitions
 *
 * KEY: Use START constant, not '__start__' string
 */
const workflow = new StateGraph(AgentState)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')  // ✅ Use START constant
  .addConditionalEdges('agent', shouldContinue, ['tools', END])
  .addEdge('tools', 'agent');

// Conditional routing function
function shouldContinue(state: typeof AgentState.State): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  if ('tool_calls' in lastMessage && lastMessage.tool_calls?.length) {
    return 'tools';
  }
  return END;
}

// Compile with checkpointer for persistence
const app = workflow.compile({
  checkpointer, // PostgresSaver for durable execution
});
```

### Invoke with Thread ID
```typescript
const result = await app.invoke(
  {
    messages: [new HumanMessage('Hello!')],
    userId: 'user-123',
    sessionId: 'session-456',
  },
  {
    configurable: { thread_id: 'thread-789' }, // For persistence
    callbacks: [langfuseHandler],
  }
);
```

### Type Augmentation Pattern
```typescript
/**
 * When library types are incomplete, use declaration merging
 * instead of 'as any' casts
 */
// types/langfuse.d.ts
import '@langfuse/langchain';

declare module '@langfuse/langchain' {
  interface CallbackHandler {
    traceId: string;
    flushAsync(): Promise<void>;
  }
}

// Usage - now properly typed
const handler = createLangfuseHandler({ userId, sessionId });
const traceId: string = handler.traceId; // No cast needed
```

### exactOptionalPropertyTypes Compliance
```typescript
// When strictest TypeScript is enabled, use explicit undefined
interface QueryOutput {
  response: string;
  traceId: string | undefined;  // ✅ Not traceId?: string
  sources: Source[];
}
```

## Streaming

### Stream Chain Output
```typescript
import { streamSSE } from 'hono/streaming';

app.get('/api/chat/stream', async (c) => {
  const { message } = c.req.query();

  return streamSSE(c, async (stream) => {
    const llmStream = await chain.stream({ input: message });

    for await (const chunk of llmStream) {
      await stream.writeSSE({
        data: JSON.stringify({ content: chunk }),
      });
    }
  });
});
```

### Stream with Events
```typescript
const eventStream = await chain.streamEvents(
  { input: message },
  { version: 'v2' }
);

for await (const event of eventStream) {
  if (event.event === 'on_llm_stream') {
    console.log(event.data.chunk.content);
  }
}
```

## Production Patterns

### Caching Embeddings
```typescript
import { Redis } from 'ioredis';
import { createHash } from 'crypto';

class CachedEmbeddings {
  constructor(
    private embeddings: OpenAIEmbeddings,
    private redis: Redis,
    private ttl = 86400
  ) {}

  async embedQuery(text: string): Promise<number[]> {
    const key = `embed:${createHash('sha256').update(text).digest('hex')}`;
    const cached = await this.redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    const embedding = await this.embeddings.embedQuery(text);
    await this.redis.setex(key, this.ttl, JSON.stringify(embedding));
    return embedding;
  }
}
```

### Circuit Breaker
```typescript
import CircuitBreaker from 'opossum';

const llmBreaker = new CircuitBreaker(
  async (input: string) => chain.invoke({ input }),
  {
    timeout: 30000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
  }
);

llmBreaker.on('open', () => logger.warn('LLM circuit opened'));
llmBreaker.on('halfOpen', () => logger.info('LLM circuit half-open'));
llmBreaker.on('close', () => logger.info('LLM circuit closed'));
```

### Token Tracking
```typescript
import { encodingForModel } from 'tiktoken';

const encoding = encodingForModel('gpt-4');

function countTokens(text: string): number {
  return encoding.encode(text).length;
}

// Track usage
const inputTokens = countTokens(prompt);
const outputTokens = countTokens(response);
const cost = (inputTokens * 0.01 + outputTokens * 0.03) / 1000;
```

## Best Practices

1. **Always use structured output** for predictable responses
2. **Cache embeddings** to reduce costs by 80%
3. **Use circuit breakers** on all LLM calls
4. **Stream responses** for better UX
5. **Track token usage** for cost monitoring
6. **Set timeouts** on all external calls
7. **Handle errors gracefully** with fallbacks
