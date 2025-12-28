# LangGraph 1.0 Patterns (December 2025)

> **Version**: @langchain/langgraph 1.0.7 | @langchain/core 1.1.8

## Why LangGraph over LangChain Agents

LangGraph is the **recommended approach** for building agents in 2025:
- Cyclic stateful workflows (not just DAGs)
- Human-in-the-loop with interrupt/resume
- Streaming support for all node outputs
- Built-in persistence for long-running tasks
- Better debugging and observability

## Annotation API (1.0 Recommended Pattern)

```typescript
import { Annotation, StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// Define state with Annotation (replaces channels)
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  context: Annotation<string>({
    default: () => "",
  }),
  iteration: Annotation<number>({
    reducer: (prev, next) => next,
    default: () => 0,
  }),
});

// Type-safe state access
type AgentStateType = typeof AgentState.State;

// Create graph with Annotation
const workflow = new StateGraph(AgentState);
```

## Tool-Calling Agent Pattern

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";

// Define tools with @tool decorator pattern
const searchTool = tool(
  async ({ query }) => {
    const results = await searchService.search(query);
    return JSON.stringify(results);
  },
  {
    name: "search",
    description: "Search for information",
    schema: z.object({
      query: z.string().describe("Search query"),
    }),
  }
);

const tools = [searchTool];

// Bind tools to model
const model = new ChatOpenAI({ model: "gpt-4-turbo" }).bindTools(tools);

// Agent node
async function agent(state: AgentStateType) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

// Should continue decision
function shouldContinue(state: AgentStateType) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
}

// Build graph
const workflow = new StateGraph(AgentState)
  .addNode("agent", agent)
  .addNode("tools", new ToolNode(tools))
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

const app = workflow.compile();

// Run
const result = await app.invoke({
  messages: [new HumanMessage("What is the weather in Tokyo?")],
});
```

## Human-in-the-Loop with Interrupt

```typescript
import { MemorySaver } from "@langchain/langgraph";

// Add checkpointer for state persistence
const checkpointer = new MemorySaver();

const workflow = new StateGraph(AgentState)
  .addNode("agent", agent)
  .addNode("tools", new ToolNode(tools))
  .addNode("human_review", async (state) => {
    // This node is interrupted before execution
    return state;
  })
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue, {
    tools: "human_review",
    [END]: END,
  })
  .addEdge("human_review", "tools")
  .addEdge("tools", "agent");

// Compile with checkpointer and interrupt
const app = workflow.compile({
  checkpointer,
  interruptBefore: ["human_review"],
});

// Start execution
const config = { configurable: { thread_id: "user-123" } };
const result1 = await app.invoke(
  { messages: [new HumanMessage("Book a flight to Tokyo")] },
  config
);

// Check if interrupted
const state = await app.getState(config);
if (state.next.includes("human_review")) {
  console.log("Awaiting human approval...");
  console.log("Pending action:", state.values.messages.at(-1));
}

// Resume after approval
const result2 = await app.invoke(null, config);
```

## Streaming Patterns

```typescript
// Stream all events
for await (const event of app.streamEvents(
  { messages: [new HumanMessage("Analyze this data")] },
  { version: "v2" }
)) {
  if (event.event === "on_chat_model_stream") {
    process.stdout.write(event.data.chunk.content);
  } else if (event.event === "on_tool_start") {
    console.log(`\nCalling tool: ${event.name}`);
  }
}

// Stream with Hono SSE
import { streamSSE } from "hono/streaming";

app.get("/api/chat/stream", async (c) => {
  const { message, threadId } = c.req.query();

  return streamSSE(c, async (stream) => {
    const config = { configurable: { thread_id: threadId } };

    for await (const event of agent.streamEvents(
      { messages: [new HumanMessage(message)] },
      { ...config, version: "v2" }
    )) {
      if (event.event === "on_chat_model_stream") {
        await stream.writeSSE({
          event: "token",
          data: JSON.stringify({ content: event.data.chunk.content }),
        });
      }
    }

    await stream.writeSSE({ event: "done", data: "" });
  });
});
```

## Subgraphs for Complex Workflows

```typescript
// Research subgraph
const ResearchState = Annotation.Root({
  query: Annotation<string>(),
  sources: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

const researchGraph = new StateGraph(ResearchState)
  .addNode("search", searchNode)
  .addNode("summarize", summarizeNode)
  .addEdge("__start__", "search")
  .addEdge("search", "summarize")
  .addEdge("summarize", END);

// Main graph with subgraph
const MainState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  research: Annotation<typeof ResearchState.State>(),
});

const mainGraph = new StateGraph(MainState)
  .addNode("router", routerNode)
  .addNode("research", researchGraph.compile())
  .addNode("respond", respondNode)
  .addEdge("__start__", "router")
  .addConditionalEdges("router", routeDecision, ["research", "respond"])
  .addEdge("research", "respond")
  .addEdge("respond", END);
```

## Best Practices

1. **Use Annotation API** - Type-safe, cleaner than channels
2. **Add checkpointers** - Enable human-in-loop and recovery
3. **Use ToolNode** - Built-in tool execution with error handling
4. **Prefer streamEvents** - Better UX than invoke
5. **Subgraphs for complexity** - Compose smaller graphs
6. **Thread IDs** - Enable conversation persistence
