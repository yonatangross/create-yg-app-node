---
name: ai-powered-endpoint
description: Implement AI-powered API endpoints with LangGraph
skills: [langchain-js-patterns, api-design-framework, hono-patterns, production-resilience]
agents: [ai-ml-engineer, backend-system-architect, code-quality-reviewer]
---

# AI-Powered Endpoint Workflow

## Overview
Create production-ready AI endpoints with LangGraph agents, streaming, and resilience patterns.

## Workflow Steps

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Feature Request                        │
│         (e.g., "Add AI chat", "RAG search")                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. ARCHITECTURE PHASE                                       │
│     ├─ Define agent state (Annotation API)                   │
│     ├─ Plan tool definitions                                 │
│     ├─ Design streaming response format                      │
│     └─ Plan embedding strategy (if RAG)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. AGENT IMPLEMENTATION (ai-ml-engineer)                   │
│     ├─ Create LangGraph agent with Annotation API            │
│     ├─ Implement tools with Zod schemas                      │
│     ├─ Add embedding cache (Redis)                           │
│     └─ Configure model fallbacks                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. API LAYER (backend-system-architect)                    │
│     ├─ Create Hono SSE endpoint                              │
│     ├─ Add circuit breaker                                   │
│     ├─ Implement rate limiting                               │
│     └─ Add cost tracking metrics                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. PRODUCTION HARDENING                                     │
│     ├─ Timeout configuration (<30s)                          │
│     ├─ Graceful degradation                                  │
│     ├─ Error handling & logging                              │
│     └─ Token usage tracking                                  │
└─────────────────────────────────────────────────────────────┘
```

## LangGraph 1.0 Template

```typescript
// backend/src/agents/feature-agent.ts
import { Annotation, StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";

// 1. Define state with Annotation
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  context: Annotation<string>({
    default: () => "",
  }),
});

// 2. Define tools
const searchTool = tool(
  async ({ query }) => {
    const results = await vectorStore.similaritySearch(query, 5);
    return results.map(d => d.pageContent).join("\n");
  },
  {
    name: "search",
    description: "Search knowledge base",
    schema: z.object({ query: z.string() }),
  }
);

// 3. Create agent
const model = new ChatOpenAI({ model: "gpt-4-turbo" }).bindTools([searchTool]);
const tools = new ToolNode([searchTool]);

const workflow = new StateGraph(AgentState)
  .addNode("agent", async (state) => {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("tools", tools)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

export const agent = workflow.compile();
```

## Streaming Endpoint Template

```typescript
// backend/src/routes/ai.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import CircuitBreaker from "opossum";
import { agent } from "../agents/feature-agent";

const app = new Hono();

const agentBreaker = new CircuitBreaker(
  async (input) => agent.streamEvents(input, { version: "v2" }),
  { timeout: 30000, errorThresholdPercentage: 50 }
);

app.get("/api/ai/stream", async (c) => {
  const message = c.req.query("message");

  return streamSSE(c, async (stream) => {
    try {
      const eventStream = await agentBreaker.fire({
        messages: [new HumanMessage(message)],
      });

      for await (const event of eventStream) {
        if (event.event === "on_chat_model_stream") {
          await stream.writeSSE({
            event: "token",
            data: JSON.stringify({ content: event.data.chunk.content }),
          });
        }
      }

      await stream.writeSSE({ event: "done", data: "" });
    } catch (error) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: "Service temporarily unavailable" }),
      });
    }
  });
});
```

## Production Checklist

- [ ] LangGraph agent uses Annotation API (not channels)
- [ ] Tools defined with `tool()` function and Zod schemas
- [ ] Streaming via Hono SSE (`streamSSE`)
- [ ] Circuit breaker on agent invocation
- [ ] Embedding cache with Redis (24h TTL)
- [ ] Timeout < 30s on all LLM calls
- [ ] Cost tracking (token counter metrics)
- [ ] Graceful degradation on circuit open
- [ ] Rate limiting on endpoint
- [ ] Structured logging with request IDs
