/**
 * LangGraph 1.0 Agent Template
 * Production-ready agent with Annotation API, tools, and streaming
 */

import { Annotation, StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { z } from "zod";
import { evaluate } from "mathjs";

// =============================================================================
// State Definition with Annotation API
// =============================================================================

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  context: Annotation<string>({
    default: () => "",
  }),
  toolResults: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
});

type AgentStateType = typeof AgentState.State;

// =============================================================================
// Tool Definitions
// =============================================================================

const searchTool = tool(
  async ({ query }) => {
    // Replace with actual search implementation
    const results = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    return JSON.stringify(await results.json());
  },
  {
    name: "search",
    description: "Search for information in the knowledge base",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

const calculatorTool = tool(
  async ({ expression }) => {
    // Using mathjs for safe mathematical expression evaluation
    // This prevents code injection attacks that would be possible with eval/Function
    try {
      // Evaluate with empty scope to prevent access to external variables
      const result = evaluate(expression, {});
      return String(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error: Invalid expression - ${message}`;
    }
  },
  {
    name: "calculator",
    description: "Perform mathematical calculations",
    schema: z.object({
      expression: z.string().describe("Mathematical expression to evaluate"),
    }),
  }
);

const tools = [searchTool, calculatorTool];

// =============================================================================
// Model Configuration
// =============================================================================

const model = new ChatOpenAI({
  model: "gpt-4-turbo",
  temperature: 0,
}).bindTools(tools);

// =============================================================================
// Node Functions
// =============================================================================

async function agentNode(state: AgentStateType) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

function shouldContinue(state: AgentStateType): "tools" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];

  if (
    lastMessage &&
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }

  return END;
}

// =============================================================================
// Graph Construction
// =============================================================================

const toolNode = new ToolNode(tools);

const workflow = new StateGraph(AgentState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

// =============================================================================
// Compile with Checkpointer (for persistence)
// =============================================================================

const checkpointer = new MemorySaver();

export const agent = workflow.compile({
  checkpointer,
});

// =============================================================================
// Usage Examples
// =============================================================================

export async function invokeAgent(message: string, threadId: string) {
  const config = { configurable: { thread_id: threadId } };

  const result = await agent.invoke(
    { messages: [new HumanMessage(message)] },
    config
  );

  return result.messages[result.messages.length - 1];
}

export async function* streamAgent(message: string, threadId: string) {
  const config = { configurable: { thread_id: threadId } };

  for await (const event of agent.streamEvents(
    { messages: [new HumanMessage(message)] },
    { ...config, version: "v2" }
  )) {
    if (event.event === "on_chat_model_stream") {
      yield {
        type: "token" as const,
        content: event.data.chunk.content,
      };
    } else if (event.event === "on_tool_start") {
      yield {
        type: "tool_start" as const,
        name: event.name,
      };
    } else if (event.event === "on_tool_end") {
      yield {
        type: "tool_end" as const,
        name: event.name,
        result: event.data.output,
      };
    }
  }
}
