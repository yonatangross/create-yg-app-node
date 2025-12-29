/**
 * Chat Agent Example
 * Complete working example with Hono SSE endpoint
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Annotation, StateGraph, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import CircuitBreaker from "opossum";
import { z } from "zod";

// =============================================================================
// Agent Setup
// =============================================================================

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
});

const weatherTool = tool(
  async ({ location }) => {
    // Mock weather data - replace with real API
    return JSON.stringify({
      location,
      temperature: 22,
      condition: "sunny",
    });
  },
  {
    name: "get_weather",
    description: "Get current weather for a location",
    schema: z.object({
      location: z.string().describe("City name"),
    }),
  }
);

const tools = [weatherTool];
const model = new ChatOpenAI({ model: "gpt-4-turbo" }).bindTools(tools);
const toolNode = new ToolNode(tools);

function shouldContinue(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage?.tool_calls?.length) return "tools";
  return END;
}

const workflow = new StateGraph(AgentState)
  .addNode("agent", async (state) => {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue, ["tools", END])
  .addEdge("tools", "agent");

const checkpointer = new MemorySaver();
const agent = workflow.compile({ checkpointer });

// =============================================================================
// Circuit Breaker for Resilience
// =============================================================================

const agentBreaker = new CircuitBreaker(
  async (input: { messages: BaseMessage[] }, config: { configurable: { thread_id: string } }) => {
    return agent.streamEvents(input, { ...config, version: "v2" });
  },
  {
    timeout: 30000,
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
  }
);

agentBreaker.on("open", () => console.log("Agent circuit OPEN"));
agentBreaker.on("close", () => console.log("Agent circuit CLOSED"));

// =============================================================================
// Hono Routes
// =============================================================================

const app = new Hono();

// Non-streaming endpoint
app.post("/api/chat", async (c) => {
  const { message, threadId } = await c.req.json<{
    message: string;
    threadId: string;
  }>();

  try {
    const result = await agent.invoke(
      { messages: [new HumanMessage(message)] },
      { configurable: { thread_id: threadId } }
    );

    const lastMessage = result.messages[result.messages.length - 1];

    return c.json({
      response: lastMessage.content,
      threadId,
    });
  } catch (error) {
    return c.json({ error: "Agent failed" }, 500);
  }
});

// Streaming endpoint with SSE
app.get("/api/chat/stream", async (c) => {
  const message = c.req.query("message");
  const threadId = c.req.query("threadId") || crypto.randomUUID();

  if (!message) {
    return c.json({ error: "message is required" }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const eventStream = await agentBreaker.fire(
        { messages: [new HumanMessage(message)] },
        { configurable: { thread_id: threadId } }
      );

      for await (const event of eventStream) {
        if (event.event === "on_chat_model_stream") {
          const content = event.data.chunk.content;
          if (content) {
            await stream.writeSSE({
              event: "token",
              data: JSON.stringify({ content }),
            });
          }
        } else if (event.event === "on_tool_start") {
          await stream.writeSSE({
            event: "tool_start",
            data: JSON.stringify({ name: event.name }),
          });
        } else if (event.event === "on_tool_end") {
          await stream.writeSSE({
            event: "tool_end",
            data: JSON.stringify({
              name: event.name,
              result: event.data.output,
            }),
          });
        }
      }

      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({ threadId }),
      });
    } catch (error) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      });
    }
  });
});

// Get conversation history
app.get("/api/chat/:threadId/history", async (c) => {
  const threadId = c.req.param("threadId");

  try {
    const state = await agent.getState({
      configurable: { thread_id: threadId },
    });

    return c.json({
      messages: state.values.messages.map((m: BaseMessage) => ({
        role: m._getType(),
        content: m.content,
      })),
    });
  } catch {
    return c.json({ messages: [] });
  }
});

export default app;

// =============================================================================
// Frontend Usage Example (React)
// =============================================================================

/*
import { useCallback, useState } from 'react';

function useChat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId] = useState(() => crypto.randomUUID());

  const sendMessage = useCallback(async (message: string) => {
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsStreaming(true);

    const eventSource = new EventSource(
      `/api/chat/stream?message=${encodeURIComponent(message)}&threadId=${threadId}`
    );

    let assistantMessage = '';

    eventSource.addEventListener('token', (e) => {
      const { content } = JSON.parse(e.data);
      assistantMessage += content;
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        if (newMessages[lastIdx]?.role === 'assistant') {
          newMessages[lastIdx].content = assistantMessage;
        } else {
          newMessages.push({ role: 'assistant', content: assistantMessage });
        }
        return newMessages;
      });
    });

    eventSource.addEventListener('done', () => {
      eventSource.close();
      setIsStreaming(false);
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
      setIsStreaming(false);
    });
  }, [threadId]);

  return { messages, sendMessage, isStreaming };
}
*/
