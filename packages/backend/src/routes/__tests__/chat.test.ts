/**
 * Integration tests for chat and RAG routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from '../../app.js';

// Mock chat agent
vi.mock('../../agents/chat-agent.js', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
}));

// Mock RAG agent
vi.mock('../../agents/rag-agent.js', () => ({
  ragQuery: vi.fn(),
  ragQueryStream: vi.fn(),
}));

describe('Chat Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/chat', () => {
    it('should process chat message successfully', async () => {
      const { chat } = await import('../../agents/chat-agent.js');
      const mockResponse = {
        response: 'Hello! How can I help you?',
        toolsUsed: ['search', 'summarize'],
        traceId: 'trace-123',
      };
      vi.mocked(chat).mockResolvedValue(mockResponse);

      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        response: 'Hello! How can I help you?',
        toolsUsed: ['search', 'summarize'],
        traceId: 'trace-123',
      });
      expect(body.data.threadId).toMatch(/^[0-9a-f-]{36}$/); // UUID
    });

    it('should use provided threadId', async () => {
      const { chat } = await import('../../agents/chat-agent.js');
      vi.mocked(chat).mockResolvedValue({
        response: 'Response',
        toolsUsed: [],
        traceId: 'trace-456',
      });

      const threadId = '12345678-1234-1234-1234-123456789abc';
      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Continue conversation',
          threadId,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.threadId).toBe(threadId);
      expect(chat).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId,
          message: 'Continue conversation',
        })
      );
    });

    it('should pass persona to agent', async () => {
      const { chat } = await import('../../agents/chat-agent.js');
      vi.mocked(chat).mockResolvedValue({
        response: 'Response',
        toolsUsed: [],
        traceId: 'trace-789',
      });

      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello',
          persona: 'helpful-assistant',
        }),
      });

      expect(res.status).toBe(200);
      expect(chat).toHaveBeenCalledWith(
        expect.objectContaining({
          persona: 'helpful-assistant',
        })
      );
    });

    it('should reject empty message', async () => {
      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should reject message over 10000 characters', async () => {
      const longMessage = 'a'.repeat(10001);
      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: longMessage,
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid threadId format', async () => {
      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello',
          threadId: 'not-a-uuid',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject persona over 100 characters', async () => {
      const longPersona = 'a'.repeat(101);
      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello',
          persona: longPersona,
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should handle agent errors gracefully', async () => {
      const { chat } = await import('../../agents/chat-agent.js');
      vi.mocked(chat).mockRejectedValue(new Error('Agent failure'));

      const res = await app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello',
        }),
      });

      expect(res.status).toBe(500);
      const body = await res.json();

      expect(body.success).toBe(false);
      expect(body.error).toMatchObject({
        code: 'CHAT_ERROR',
        message: 'Failed to process chat message',
      });
    });
  });

  describe('GET /api/chat/stream', () => {
    it('should stream chat responses via SSE', async () => {
      const { chatStream } = await import('../../agents/chat-agent.js');

      // Mock async generator
      const mockGenerator = async function* () {
        yield { type: 'start', content: 'Starting...', traceId: 'trace-1' };
        yield { type: 'token', content: 'Hello', traceId: 'trace-1' };
        yield { type: 'token', content: ' world', traceId: 'trace-1' };
        yield { type: 'end', content: 'Done', traceId: 'trace-1' };
      };
      vi.mocked(chatStream).mockReturnValue(mockGenerator());

      const res = await app.request('/api/chat/stream?message=Hello');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      // Read stream
      const text = await res.text();
      expect(text).toContain('event: start');
      expect(text).toContain('event: token');
      expect(text).toContain('event: end');
      expect(text).toContain('Starting...');
      expect(text).toContain('Hello');
      expect(text).toContain(' world');
    });

    it('should use query parameters for stream', async () => {
      const { chatStream } = await import('../../agents/chat-agent.js');
      const mockGenerator = async function* () {
        yield { type: 'end', content: 'Done', traceId: 'trace-2' };
      };
      vi.mocked(chatStream).mockReturnValue(mockGenerator());

      const threadId = '12345678-1234-1234-1234-123456789abc';
      await app.request(
        `/api/chat/stream?message=Test&threadId=${threadId}&persona=assistant`
      );

      expect(chatStream).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test',
          threadId,
          persona: 'assistant',
        })
      );
    });

    it('should reject empty message', async () => {
      const res = await app.request('/api/chat/stream?message=');

      expect(res.status).toBe(400);
    });

    it('should reject invalid threadId', async () => {
      const res = await app.request(
        '/api/chat/stream?message=Hello&threadId=invalid'
      );

      expect(res.status).toBe(400);
    });

    it('should send error event on stream failure', async () => {
      const { chatStream } = await import('../../agents/chat-agent.js');
      const mockGenerator = async function* () {
        yield { type: 'start', content: 'Starting...', traceId: 'trace-3' };
        throw new Error('Stream error');
      };
      vi.mocked(chatStream).mockReturnValue(mockGenerator());

      const res = await app.request('/api/chat/stream?message=Hello');

      const text = await res.text();
      expect(text).toContain('event: error');
      expect(text).toContain('Stream error occurred');
    });
  });
});

describe('RAG Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/rag/query', () => {
    it('should process RAG query successfully', async () => {
      const { ragQuery } = await import('../../agents/rag-agent.js');
      const mockResponse = {
        response: 'Based on the documents...',
        sources: [
          { id: 'doc-1', title: 'Document 1', score: 0.95 },
          { id: 'doc-2', title: 'Document 2', score: 0.87 },
        ],
        usedFallback: false,
        traceId: 'rag-trace-123',
      };
      vi.mocked(ragQuery).mockResolvedValue(mockResponse);

      const res = await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What is the capital of France?',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        response: 'Based on the documents...',
        sources: [
          { id: 'doc-1', title: 'Document 1', score: 0.95 },
          { id: 'doc-2', title: 'Document 2', score: 0.87 },
        ],
        usedFallback: false,
        traceId: 'rag-trace-123',
      });
      expect(body.data.threadId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should pass maxSources parameter', async () => {
      const { ragQuery } = await import('../../agents/rag-agent.js');
      vi.mocked(ragQuery).mockResolvedValue({
        response: 'Answer',
        sources: [],
        usedFallback: false,
        traceId: 'trace-456',
      });

      await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Question',
          maxSources: 5,
        }),
      });

      expect(ragQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          maxSources: 5,
        })
      );
    });

    it('should pass requireCitations parameter', async () => {
      const { ragQuery } = await import('../../agents/rag-agent.js');
      vi.mocked(ragQuery).mockResolvedValue({
        response: 'Answer',
        sources: [],
        usedFallback: false,
        traceId: 'trace-789',
      });

      await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Question',
          requireCitations: true,
        }),
      });

      expect(ragQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          requireCitations: true,
        })
      );
    });

    it('should reject empty query', async () => {
      const res = await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject query over 5000 characters', async () => {
      const longQuery = 'a'.repeat(5001);
      const res = await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: longQuery,
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject maxSources over 10', async () => {
      const res = await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Question',
          maxSources: 11,
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject maxSources less than 1', async () => {
      const res = await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Question',
          maxSources: 0,
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid threadId', async () => {
      const res = await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Question',
          threadId: 'not-a-uuid',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should handle agent errors gracefully', async () => {
      const { ragQuery } = await import('../../agents/rag-agent.js');
      vi.mocked(ragQuery).mockRejectedValue(new Error('RAG failure'));

      const res = await app.request('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Question',
        }),
      });

      expect(res.status).toBe(500);
      const body = await res.json();

      expect(body.success).toBe(false);
      expect(body.error).toMatchObject({
        code: 'RAG_ERROR',
        message: 'Failed to process RAG query',
      });
    });
  });

  describe('GET /api/rag/stream', () => {
    it('should stream RAG responses via SSE', async () => {
      const { ragQueryStream } = await import('../../agents/rag-agent.js');

      const mockGenerator = async function* () {
        yield { type: 'sources', content: 'Found 2 sources', traceId: 'trace-1' };
        yield { type: 'token', content: 'Based on', traceId: 'trace-1' };
        yield { type: 'token', content: ' the documents', traceId: 'trace-1' };
        yield { type: 'end', content: 'Done', traceId: 'trace-1' };
      };
      vi.mocked(ragQueryStream).mockReturnValue(mockGenerator());

      const res = await app.request('/api/rag/stream?query=Question');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      const text = await res.text();
      expect(text).toContain('event: sources');
      expect(text).toContain('event: token');
      expect(text).toContain('event: end');
      expect(text).toContain('Found 2 sources');
      expect(text).toContain('Based on');
    });

    it('should use query parameters including maxSources', async () => {
      const { ragQueryStream } = await import('../../agents/rag-agent.js');
      const mockGenerator = async function* () {
        yield { type: 'end', content: 'Done', traceId: 'trace-2' };
      };
      vi.mocked(ragQueryStream).mockReturnValue(mockGenerator());

      const threadId = '12345678-1234-1234-1234-123456789abc';
      await app.request(
        `/api/rag/stream?query=Test&threadId=${threadId}&maxSources=3`
      );

      expect(ragQueryStream).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Test',
          threadId,
          maxSources: 3,
          requireCitations: true, // Default from route
        })
      );
    });

    it('should coerce maxSources to number', async () => {
      const { ragQueryStream } = await import('../../agents/rag-agent.js');
      const mockGenerator = async function* () {
        yield { type: 'end', content: 'Done', traceId: 'trace-3' };
      };
      vi.mocked(ragQueryStream).mockReturnValue(mockGenerator());

      await app.request('/api/rag/stream?query=Test&maxSources=5');

      expect(ragQueryStream).toHaveBeenCalledWith(
        expect.objectContaining({
          maxSources: 5, // Should be number, not string
        })
      );
    });

    it('should reject empty query', async () => {
      const res = await app.request('/api/rag/stream?query=');

      expect(res.status).toBe(400);
    });

    it('should reject invalid threadId', async () => {
      const res = await app.request(
        '/api/rag/stream?query=Question&threadId=invalid'
      );

      expect(res.status).toBe(400);
    });

    it('should reject maxSources over 10', async () => {
      const res = await app.request(
        '/api/rag/stream?query=Question&maxSources=11'
      );

      expect(res.status).toBe(400);
    });

    it('should send error event on stream failure', async () => {
      const { ragQueryStream } = await import('../../agents/rag-agent.js');
      const mockGenerator = async function* () {
        yield { type: 'sources', content: 'Starting...', traceId: 'trace-4' };
        throw new Error('Stream error');
      };
      vi.mocked(ragQueryStream).mockReturnValue(mockGenerator());

      const res = await app.request('/api/rag/stream?query=Question');

      const text = await res.text();
      expect(text).toContain('event: error');
      expect(text).toContain('Stream error occurred');
    });
  });
});
