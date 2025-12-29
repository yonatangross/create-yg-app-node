---
name: streaming-api-patterns
description: Implement real-time data streaming with Server-Sent Events (SSE), WebSockets, and ReadableStream APIs for Hono and Node.js applications.
version: 1.0.0
tags: [streaming, sse, websocket, real-time, hono, node]
---

# Streaming API Patterns

## Overview

Modern applications require real-time data delivery. This skill covers SSE for server-to-client streaming, WebSockets for bidirectional communication, and the Streams API for backpressure handling.

**When to use:**
- Streaming LLM responses (ChatGPT-style interfaces)
- Real-time notifications and updates
- Live data feeds
- Progress updates for long-running tasks

## Core Technologies

### 1. Server-Sent Events (SSE) with Hono

**Best for**: Server-to-client streaming (LLM responses, notifications)

```typescript
// Hono SSE route
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'

const app = new Hono()

app.get('/api/stream', (c) => {
  return streamSSE(c, async (stream) => {
    // Send data
    await stream.writeSSE({
      data: JSON.stringify({ message: 'Hello' }),
      event: 'message'
    })

    // Stream LLM response
    for await (const chunk of llmStream) {
      await stream.writeSSE({
        data: JSON.stringify({ content: chunk }),
        event: 'token'
      })
    }

    // Signal completion
    await stream.writeSSE({ data: '[DONE]', event: 'done' })
  })
})
```

### 2. ReadableStream API

**Best for**: Processing large data with backpressure

```typescript
export async function GET(req: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of generateData()) {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
      }
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

### 3. LLM Streaming Pattern

```typescript
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

// Using Vercel AI SDK (recommended)
app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json()

  const result = streamText({
    model: openai('gpt-4-turbo'),
    messages,
  })

  return result.toDataStreamResponse()
})

// Manual streaming with OpenAI
app.post('/api/chat/raw', async (c) => {
  const { messages } = await c.req.json()

  const stream = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages,
    stream: true
  })

  return streamSSE(c, async (sseStream) => {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        await sseStream.writeSSE({
          data: JSON.stringify({ content }),
          event: 'token'
        })
      }
    }
    await sseStream.writeSSE({ data: '[DONE]', event: 'done' })
  })
})
```

### 4. Client-Side Consumption

```typescript
// Using EventSource
const eventSource = new EventSource('/api/stream')

eventSource.addEventListener('token', (event) => {
  const { content } = JSON.parse(event.data)
  appendToChat(content)
})

eventSource.addEventListener('done', () => {
  eventSource.close()
})

eventSource.onerror = () => {
  eventSource.close()
  // Implement reconnection
}

// Using fetch with ReadableStream
async function streamChat(messages: Message[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  })

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  while (reader) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    processChunk(chunk)
  }
}
```

### 5. Reconnection Strategy

```typescript
class ReconnectingEventSource {
  private eventSource: EventSource | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000

  constructor(
    private url: string,
    private onMessage: (data: string) => void
  ) {
    this.connect()
  }

  private connect() {
    this.eventSource = new EventSource(this.url)

    this.eventSource.onmessage = (event) => {
      this.reconnectDelay = 1000 // Reset on success
      this.onMessage(event.data)
    }

    this.eventSource.onerror = () => {
      this.eventSource?.close()
      // Exponential backoff
      setTimeout(() => this.connect(), this.reconnectDelay)
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      )
    }
  }

  close() {
    this.eventSource?.close()
  }
}
```

## Best Practices

### SSE
- ✅ Use for one-way server-to-client streaming
- ✅ Implement automatic reconnection
- ✅ Send keepalive messages every 30s
- ✅ Handle browser connection limits (6 per domain)

### Backpressure
- ✅ Use ReadableStream with proper flow control
- ✅ Monitor buffer sizes
- ✅ Implement timeouts for slow consumers

### Performance
- ✅ Compress data (gzip/brotli)
- ✅ Batch small messages
- ✅ Use Vercel AI SDK for LLM streaming

## Resources

- [Hono Streaming](https://hono.dev/helpers/streaming)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
