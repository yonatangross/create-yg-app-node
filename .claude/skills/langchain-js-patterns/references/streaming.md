# Streaming Responses

## Basic Chain Streaming

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({ model: "gpt-4-turbo", streaming: true });
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant."],
  ["human", "{input}"],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

// Async iterator
for await (const chunk of await chain.stream({ input: "Hello" })) {
  process.stdout.write(chunk);
}
```

## Stream Events (Detailed)

```typescript
const eventStream = await chain.streamEvents(
  { input: "Hello" },
  { version: "v2" }
);

for await (const event of eventStream) {
  switch (event.event) {
    case "on_llm_start":
      console.log("LLM starting...");
      break;
    case "on_llm_stream":
      process.stdout.write(event.data.chunk.content);
      break;
    case "on_llm_end":
      console.log("\nLLM finished");
      break;
    case "on_tool_start":
      console.log(`Tool ${event.name} starting`);
      break;
    case "on_tool_end":
      console.log(`Tool ${event.name} finished:`, event.data.output);
      break;
  }
}
```

## Hono SSE Endpoint

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const app = new Hono();

app.get("/api/chat/stream", async (c) => {
  const message = c.req.query("message");
  if (!message) return c.json({ error: "message required" }, 400);

  return streamSSE(c, async (stream) => {
    try {
      const eventStream = await chain.streamEvents(
        { input: message },
        { version: "v2" }
      );

      for await (const event of eventStream) {
        if (event.event === "on_llm_stream") {
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
        data: JSON.stringify({
          message: error instanceof Error ? error.message : "Unknown error"
        }),
      });
    }
  });
});
```

## LangGraph Agent Streaming

```typescript
import { agent } from "./agent";
import { HumanMessage } from "@langchain/core/messages";

app.get("/api/agent/stream", async (c) => {
  const message = c.req.query("message");
  const threadId = c.req.query("threadId") || crypto.randomUUID();

  return streamSSE(c, async (stream) => {
    const config = { configurable: { thread_id: threadId } };

    for await (const event of agent.streamEvents(
      { messages: [new HumanMessage(message)] },
      { ...config, version: "v2" }
    )) {
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
          data: JSON.stringify({
            name: event.name,
            input: event.data.input,
          }),
        });
      } else if (event.event === "on_tool_end") {
        await stream.writeSSE({
          event: "tool_end",
          data: JSON.stringify({
            name: event.name,
            output: event.data.output,
          }),
        });
      }
    }

    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({ threadId }),
    });
  });
});
```

## Frontend EventSource Client

```typescript
function streamChat(message: string, threadId: string) {
  const url = `/api/chat/stream?message=${encodeURIComponent(message)}&threadId=${threadId}`;
  const eventSource = new EventSource(url);

  let fullResponse = "";

  eventSource.addEventListener("token", (e) => {
    const { content } = JSON.parse(e.data);
    fullResponse += content;
    updateUI(fullResponse);
  });

  eventSource.addEventListener("tool_start", (e) => {
    const { name } = JSON.parse(e.data);
    showToolIndicator(name);
  });

  eventSource.addEventListener("tool_end", (e) => {
    const { name, output } = JSON.parse(e.data);
    hideToolIndicator(name);
  });

  eventSource.addEventListener("done", () => {
    eventSource.close();
    onComplete();
  });

  eventSource.addEventListener("error", (e) => {
    eventSource.close();
    onError(e);
  });

  return () => eventSource.close(); // Cleanup function
}
```

## React Hook for Streaming

```typescript
import { useCallback, useState, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; status: "running" | "done" }[];
}

export function useStreamingChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const sendMessage = useCallback(async (content: string, threadId: string) => {
    // Add user message
    setMessages((prev) => [...prev, { role: "user", content }]);
    setIsStreaming(true);

    const url = `/api/chat/stream?message=${encodeURIComponent(content)}&threadId=${threadId}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    let assistantContent = "";

    eventSource.addEventListener("token", (e) => {
      const { content } = JSON.parse(e.data);
      assistantContent += content;

      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;

        if (newMessages[lastIdx]?.role === "assistant") {
          newMessages[lastIdx] = {
            ...newMessages[lastIdx],
            content: assistantContent
          };
        } else {
          newMessages.push({ role: "assistant", content: assistantContent });
        }

        return newMessages;
      });
    });

    eventSource.addEventListener("done", () => {
      eventSource.close();
      setIsStreaming(false);
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
      setIsStreaming(false);
    });
  }, []);

  const cancel = useCallback(() => {
    eventSourceRef.current?.close();
    setIsStreaming(false);
  }, []);

  return { messages, sendMessage, isStreaming, cancel };
}
```

## Best Practices

1. **Always use version: "v2"** for streamEvents
2. **Handle connection cleanup** - close EventSource on unmount
3. **Send heartbeats** for long streams to prevent timeout
4. **Buffer rapid updates** - don't update UI on every token
5. **Show tool activity** - use tool_start/tool_end events for UX
6. **Graceful error handling** - send error event before closing
