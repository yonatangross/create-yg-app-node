/**
 * MSW Request Handlers
 * Mock API responses for integration tests
 */

import { http, HttpResponse } from 'msw';

// Helper to create SSE stream response
function createSSEStream(
  events: Array<{ type: string; [key: string]: unknown }>
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
      controller.close();
    },
  });

  return new HttpResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export const handlers = [
  // Health check
  http.get('/health', () => {
    return HttpResponse.json({
      success: true,
      data: {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
          database: { status: 'up', latencyMs: 5 },
          redis: { status: 'up', latencyMs: 2 },
        },
      },
    });
  }),

  // Non-streaming chat
  http.post('/api/chat', async ({ request }) => {
    const body = (await request.json()) as {
      message: string;
      threadId?: string;
    };

    return HttpResponse.json({
      success: true,
      data: {
        response: `You said: ${body.message}`,
        threadId: body.threadId ?? '12345678-1234-1234-1234-123456789abc',
        toolsUsed: [],
        traceId: 'trace-test-123',
      },
    });
  }),

  // Streaming chat
  http.get('/api/chat/stream', ({ request }) => {
    const url = new URL(request.url);
    const message = url.searchParams.get('message') ?? 'Hello';

    // Simulate a stream with text deltas and a done event
    const events = [
      { type: 'text_delta', content: 'Hello! ' },
      { type: 'text_delta', content: 'I received: ' },
      { type: 'text_delta', content: `"${message}"` },
      { type: 'done', traceId: 'trace-stream-123' },
    ];

    return createSSEStream(events);
  }),
];

// Handler overrides for specific test scenarios
export const errorHandlers = {
  streamError: http.get('/api/chat/stream', () => {
    return createSSEStream([
      { type: 'error', message: 'Stream error occurred' },
    ]);
  }),

  networkError: http.get('/api/chat/stream', () => {
    return HttpResponse.error();
  }),

  timeout: http.get('/api/chat/stream', async () => {
    // Simulate long delay
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return createSSEStream([{ type: 'done', traceId: undefined }]);
  }),

  withToolCall: http.get('/api/chat/stream', () => {
    const events = [
      { type: 'text_delta', content: 'Let me search for that.' },
      {
        type: 'tool_call',
        toolCallId: 'call-123',
        toolName: 'web_search',
        toolInput: { query: 'weather' },
      },
      { type: 'tool_result', toolCallId: 'call-123', result: 'Sunny, 72°F' },
      { type: 'text_delta', content: ' The weather is sunny and 72°F.' },
      { type: 'done', traceId: 'trace-tool-123' },
    ];
    return createSSEStream(events);
  }),
};
