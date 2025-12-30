/**
 * API Client Tests
 * Tests for chatStream SSE parsing and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, type StreamEvent } from '../api';

describe('api.chatStream', () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetAllMocks();
  });

  function mockStreamResponse(events: StreamEvent[]) {
    const chunks = events.map((event) => `data: ${JSON.stringify(event)}\n\n`);

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(chunks.join('')),
        })
        .mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });
  }

  it('parses text_delta events', async () => {
    mockStreamResponse([
      { type: 'text_delta', content: 'Hello ' },
      { type: 'text_delta', content: 'World' },
      { type: 'done', traceId: 'trace-123' },
    ]);

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test')) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'text_delta', content: 'Hello ' });
    expect(events[1]).toEqual({ type: 'text_delta', content: 'World' });
    expect(events[2]).toEqual({ type: 'done', traceId: 'trace-123' });
  });

  it('parses tool_call events', async () => {
    mockStreamResponse([
      {
        type: 'tool_call',
        toolCallId: 'call-1',
        toolName: 'search',
        toolInput: { query: 'weather' },
      },
      { type: 'done', traceId: undefined },
    ]);

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('search weather')) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: 'tool_call',
      toolCallId: 'call-1',
      toolName: 'search',
      toolInput: { query: 'weather' },
    });
  });

  it('parses tool_result events', async () => {
    mockStreamResponse([
      {
        type: 'tool_result',
        toolCallId: 'call-1',
        result: 'Sunny, 72°F',
      },
      { type: 'done', traceId: 'trace-456' },
    ]);

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test')) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: 'tool_result',
      toolCallId: 'call-1',
      result: 'Sunny, 72°F',
    });
  });

  it('parses error events', async () => {
    mockStreamResponse([{ type: 'error', message: 'Rate limit exceeded' }]);

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test')) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: 'error',
      message: 'Rate limit exceeded',
    });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    });

    const consumeStream = async () => {
      const events: StreamEvent[] = [];
      for await (const event of api.chatStream('test')) {
        events.push(event);
      }
      return events;
    };

    await expect(consumeStream).rejects.toThrow(
      'Stream failed: Internal Server Error'
    );
  });

  it('throws when no response body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: null,
    });

    const consumeStream = async () => {
      const events: StreamEvent[] = [];
      for await (const event of api.chatStream('test')) {
        events.push(event);
      }
      return events;
    };

    await expect(consumeStream).rejects.toThrow('No response body');
  });

  it('includes threadId in query params when provided', async () => {
    mockStreamResponse([{ type: 'done', traceId: undefined }]);

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test', 'thread-123')) {
      events.push(event);
    }

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('threadId=thread-123')
    );
    expect(events).toHaveLength(1);
  });

  it('includes persona in query params when provided', async () => {
    mockStreamResponse([{ type: 'done', traceId: undefined }]);

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test', undefined, 'helpful')) {
      events.push(event);
    }

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('persona=helpful')
    );
    expect(events).toHaveLength(1);
  });

  it('ignores [DONE] marker', async () => {
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            'data: {"type":"text_delta","content":"Hi"}\n\ndata: [DONE]\n\n'
          ),
        })
        .mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test')) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'text_delta', content: 'Hi' });
  });

  it('handles chunked data across multiple reads', async () => {
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"type":"text_'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('delta","content":"Hello"}\n\n'),
        })
        .mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test')) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'text_delta', content: 'Hello' });
  });

  it('ignores malformed JSON and validates with Zod', async () => {
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            'data: {invalid json}\n\ndata: {"type":"done"}\n\n'
          ),
        })
        .mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test')) {
      events.push(event);
    }

    // Should only have the valid event (malformed JSON is skipped)
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('done');
  });

  it('releases reader lock on completion', async () => {
    const mockReader = {
      read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const events: StreamEvent[] = [];
    for await (const event of api.chatStream('test')) {
      events.push(event);
    }

    expect(mockReader.releaseLock).toHaveBeenCalled();
    expect(events).toHaveLength(0); // No events yielded since stream is done immediately
  });
});

describe('api.sendChatMessage', () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it('sends POST request with message', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            response: 'Hello!',
            threadId: '12345678-1234-1234-1234-123456789abc',
          },
        }),
    });

    await api.sendChatMessage('Hi');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
    // Verify message is included in body
    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.message).toBe('Hi');
  });

  it('validates response with Zod', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            // Missing required 'response' field
            threadId: 'thread-1',
          },
        }),
    });

    await expect(api.sendChatMessage('Hi')).rejects.toThrow(
      'Invalid chat response format'
    );
  });

  it('returns validated response', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            response: 'Hello back!',
            threadId: '12345678-1234-1234-1234-123456789abc',
          },
        }),
    });

    const result = await api.sendChatMessage('Hi');

    expect(result.response).toBe('Hello back!');
    expect(result.threadId).toBe('12345678-1234-1234-1234-123456789abc');
  });
});
