# SSE Streaming

## Basic SSE

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const app = new Hono();

app.get("/events", async (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;

    while (true) {
      await stream.writeSSE({
        id: String(id++),
        event: "message",
        data: JSON.stringify({ time: Date.now() }),
      });

      await stream.sleep(1000);
    }
  });
});
```

## SSE with Abort Signal

```typescript
app.get("/events", async (c) => {
  return streamSSE(c, async (stream) => {
    const abortController = new AbortController();

    // Clean up on client disconnect
    c.req.raw.signal.addEventListener("abort", () => {
      abortController.abort();
    });

    let id = 0;
    while (!abortController.signal.aborted) {
      await stream.writeSSE({
        id: String(id++),
        event: "ping",
        data: JSON.stringify({ timestamp: Date.now() }),
      });
      await stream.sleep(5000);
    }
  });
});
```

## Multiple Event Types

```typescript
app.get("/notifications", async (c) => {
  const userId = c.get("userId");

  return streamSSE(c, async (stream) => {
    // Subscribe to different event sources
    const unsubscribe = eventBus.subscribe(userId, async (event) => {
      await stream.writeSSE({
        event: event.type, // "message", "notification", "alert"
        data: JSON.stringify(event.payload),
      });
    });

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({
        event: "heartbeat",
        data: "",
      });
    }, 30000);

    // Cleanup
    c.req.raw.signal.addEventListener("abort", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    // Keep stream open
    await new Promise(() => {});
  });
});
```

## Streaming with Progress

```typescript
app.post("/upload/process", async (c) => {
  const { fileId } = await c.req.json();

  return streamSSE(c, async (stream) => {
    const steps = ["Validating", "Processing", "Optimizing", "Complete"];

    for (let i = 0; i < steps.length; i++) {
      await stream.writeSSE({
        event: "progress",
        data: JSON.stringify({
          step: steps[i],
          progress: ((i + 1) / steps.length) * 100,
        }),
      });

      // Simulate work
      await stream.sleep(1000);
    }

    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({ fileId, status: "complete" }),
    });
  });
});
```

## LLM Streaming Integration

```typescript
import { streamSSE } from "hono/streaming";
import { ChatOpenAI } from "@langchain/openai";

app.get("/chat/stream", async (c) => {
  const message = c.req.query("message");
  if (!message) return c.json({ error: "message required" }, 400);

  const model = new ChatOpenAI({
    model: "gpt-4-turbo",
    streaming: true,
  });

  return streamSSE(c, async (stream) => {
    try {
      const response = await model.stream(message);

      for await (const chunk of response) {
        if (chunk.content) {
          await stream.writeSSE({
            event: "token",
            data: JSON.stringify({ content: chunk.content }),
          });
        }
      }

      await stream.writeSSE({
        event: "done",
        data: "",
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
```

## Frontend EventSource

```typescript
function createEventStream(url: string) {
  const eventSource = new EventSource(url);
  let buffer = "";

  return {
    onToken: (callback: (content: string) => void) => {
      eventSource.addEventListener("token", (e) => {
        const { content } = JSON.parse(e.data);
        buffer += content;
        callback(content);
      });
    },

    onDone: (callback: (fullResponse: string) => void) => {
      eventSource.addEventListener("done", () => {
        callback(buffer);
        eventSource.close();
      });
    },

    onError: (callback: (error: Error) => void) => {
      eventSource.addEventListener("error", (e) => {
        callback(new Error("Stream error"));
        eventSource.close();
      });
    },

    close: () => eventSource.close(),
  };
}

// Usage
const stream = createEventStream("/api/chat/stream?message=Hello");
stream.onToken((content) => updateUI(content));
stream.onDone((full) => console.log("Complete:", full));
stream.onError((err) => console.error(err));
```

## React Hook for SSE

```typescript
import { useState, useEffect, useCallback } from "react";

export function useSSE<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!url) return;

    const eventSource = new EventSource(url);

    eventSource.onopen = () => setIsConnected(true);

    eventSource.addEventListener("message", (e) => {
      try {
        setData(JSON.parse(e.data));
      } catch {
        setError(new Error("Failed to parse SSE data"));
      }
    });

    eventSource.onerror = () => {
      setError(new Error("SSE connection error"));
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [url]);

  return { data, error, isConnected };
}
```

## Best Practices

1. **Use event types** - Differentiate message, error, done
2. **Heartbeat** - Prevent connection timeout (30s intervals)
3. **Cleanup** - Listen for abort signal, close resources
4. **Error handling** - Send error event before closing
5. **Reconnection** - Client should implement retry logic
6. **Buffering** - Consider batching rapid updates
