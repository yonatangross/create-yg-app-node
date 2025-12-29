/**
 * Chat Routes - AI Agent Endpoints
 *
 * Provides chat and RAG functionality using LangGraph agents
 * with Langfuse tracing and streaming support.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AppEnv } from '../types.js';
import { getLogger } from '../core/logger.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';

const logger = getLogger();

// =============================================================================
// Request Schemas
// =============================================================================

const ChatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  threadId: z.string().uuid().optional(),
  persona: z.string().max(100).optional(),
});

const RAGQuerySchema = z.object({
  query: z.string().min(1).max(5000),
  threadId: z.string().uuid().optional(),
  maxSources: z.number().int().min(1).max(10).optional(),
  requireCitations: z.boolean().optional(),
});

// =============================================================================
// Chat Routes
// =============================================================================

/**
 * Chat routes with method chaining for Hono RPC type inference
 * Rate limited: 20 requests per minute per IP
 */
const chatRoutes = new Hono<AppEnv>()
  /**
   * POST /api/chat - Send a chat message
   */
  .post(
    '/',
    rateLimitMiddleware('CHAT'),
    zValidator('json', ChatMessageSchema),
    async (c) => {
    const { message, threadId, persona } = c.req.valid('json');
    const requestId = c.get('requestId');

    // Generate IDs if not provided
    // NOTE: Using default user ID until authentication middleware is implemented
    // Future: Extract userId from JWT token in auth middleware (c.get('userId'))
    const userId = 'user-default';
    const sessionId = requestId;
    const thread = threadId ?? crypto.randomUUID();

    logger.info({ userId, threadId: thread }, 'Processing chat message');

    try {
      // Lazy import to avoid circular dependencies
      const { chat } = await import('../agents/chat-agent.js');

      const result = await chat({
        message,
        userId,
        sessionId,
        threadId: thread,
        persona,
      });

      return c.json({
        success: true,
        data: {
          response: result.response,
          threadId: thread,
          toolsUsed: result.toolsUsed,
          traceId: result.traceId,
        },
      });
    } catch (error) {
      logger.error({ error, requestId }, 'Chat error');
      return c.json(
        {
          success: false,
          error: {
            code: 'CHAT_ERROR',
            message: 'Failed to process chat message',
          },
        },
        500
      );
    }
  })

  /**
   * GET /api/chat/stream - Stream chat responses via SSE
   */
  .get(
    '/stream',
    rateLimitMiddleware('CHAT'),
    zValidator('query', z.object({
    message: z.string().min(1),
    threadId: z.string().uuid().optional(),
    persona: z.string().optional(),
  })), async (c) => {
    const { message, threadId, persona } = c.req.valid('query');
    const requestId = c.get('requestId');

    const userId = 'user-default';
    const sessionId = requestId;
    const thread = threadId ?? crypto.randomUUID();

    return streamSSE(c, async (stream) => {
      try {
        const { chatStream } = await import('../agents/chat-agent.js');

        const generator = chatStream({
          message,
          userId,
          sessionId,
          threadId: thread,
          persona,
        });

        for await (const chunk of generator) {
          await stream.writeSSE({
            event: chunk.type,
            data: JSON.stringify({
              content: chunk.content,
              traceId: chunk.traceId,
            }),
          });
        }
      } catch (error) {
        logger.error({ error, requestId }, 'Stream error');
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: 'Stream error occurred' }),
        });
      }
    });
  });

// =============================================================================
// RAG Routes
// =============================================================================

/**
 * RAG routes for retrieval-augmented generation
 * Rate limited: 10 requests per minute per IP (stricter than chat)
 */
const ragRoutes = new Hono<AppEnv>()
  /**
   * POST /api/rag/query - Query with RAG
   */
  .post(
    '/query',
    rateLimitMiddleware('RAG'),
    zValidator('json', RAGQuerySchema),
    async (c) => {
    const { query, threadId, maxSources, requireCitations } = c.req.valid('json');
    const requestId = c.get('requestId');

    const userId = 'user-default';
    const sessionId = requestId;
    const thread = threadId ?? crypto.randomUUID();

    logger.info({ userId, threadId: thread, queryLength: query.length }, 'Processing RAG query');

    try {
      const { ragQuery } = await import('../agents/rag-agent.js');

      const result = await ragQuery({
        query,
        userId,
        sessionId,
        threadId: thread,
        maxSources,
        requireCitations,
      });

      return c.json({
        success: true,
        data: {
          response: result.response,
          sources: result.sources,
          threadId: thread,
          usedFallback: result.usedFallback,
          traceId: result.traceId,
        },
      });
    } catch (error) {
      logger.error({ error, requestId }, 'RAG query error');
      return c.json(
        {
          success: false,
          error: {
            code: 'RAG_ERROR',
            message: 'Failed to process RAG query',
          },
        },
        500
      );
    }
  })

  /**
   * GET /api/rag/stream - Stream RAG responses via SSE
   */
  .get(
    '/stream',
    rateLimitMiddleware('RAG'),
    zValidator('query', z.object({
    query: z.string().min(1),
    threadId: z.string().uuid().optional(),
    maxSources: z.coerce.number().int().min(1).max(10).optional(),
  })), async (c) => {
    const { query, threadId, maxSources } = c.req.valid('query');
    const requestId = c.get('requestId');

    const userId = 'user-default';
    const sessionId = requestId;
    const thread = threadId ?? crypto.randomUUID();

    return streamSSE(c, async (stream) => {
      try {
        const { ragQueryStream } = await import('../agents/rag-agent.js');

        const generator = ragQueryStream({
          query,
          userId,
          sessionId,
          threadId: thread,
          maxSources,
          requireCitations: true,
        });

        for await (const chunk of generator) {
          await stream.writeSSE({
            event: chunk.type,
            data: JSON.stringify({
              content: chunk.content,
              traceId: chunk.traceId,
            }),
          });
        }
      } catch (error) {
        logger.error({ error, requestId }, 'RAG stream error');
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: 'Stream error occurred' }),
        });
      }
    });
  });

export { chatRoutes, ragRoutes };
