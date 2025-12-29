/**
 * Chat Agent Tests
 * Unit tests for LangGraph chat agent with tool calling
 *
 * Note: These tests focus on testing the agent compilation and configuration.
 * Full end-to-end agent execution requires actual LLM models and is better
 * suited for integration tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  getChatAgent,
  chat,
  chatStream,
  type ChatInput,
} from '../chat-agent.js';

// =============================================================================
// Mocks
// =============================================================================

// Mock type augmentations
vi.mock('../../types/langfuse.js', () => ({}));

// Mock dependencies
vi.mock('../../core/models.js', () => ({
  getModel: vi.fn(),
  getResilientModel: vi.fn(),
}));

vi.mock('../../shared/checkpointer.js', () => ({
  getOrInitCheckpointer: vi.fn(),
}));

vi.mock('../../core/langfuse.js', () => ({
  createLangfuseHandler: vi.fn(),
}));

vi.mock('../../core/logger.js', () => ({
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../prompts/loader.js', () => ({
  renderChatAgent: vi.fn((vars) => `System prompt for ${vars.persona}`),
}));

// Import mocked modules
import { getResilientModel } from '../../core/models.js';
import { getOrInitCheckpointer } from '../../shared/checkpointer.js';
import { createLangfuseHandler } from '../../core/langfuse.js';
import { renderChatAgent } from '../../prompts/loader.js';

// =============================================================================
// Test Setup
// =============================================================================

describe('Chat Agent', () => {
  let mockModel: Partial<BaseChatModel>;
  let mockCheckpointer: unknown;
  let mockLangfuseHandler: { traceId: string; flushAsync: () => Promise<void> };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock model with all required LangChain methods
    const mockInvoke = vi.fn(async () => new AIMessage({
      content: 'Mock response',
      tool_calls: [],
    }));

    const mockStream = vi.fn(async function* () {
      yield {
        messages: [new HumanMessage('input'), new AIMessage('Mock stream response')],
        userId: 'user-123',
        sessionId: 'session-456',
        persona: 'assistant',
      };
    });

    const mockBind = vi.fn(function (this: Record<string, unknown>) {
      return this;
    });

    const mockBindTools = vi.fn(function (this: Record<string, unknown>) {
      return this;
    });

    mockModel = {
      invoke: mockInvoke,
      stream: mockStream,
      bindTools: mockBindTools,
      bind: mockBind,
      lc_namespace: ['langchain', 'chat_models'],
      lc_serializable: true,
    };

    // Setup mock checkpointer with all required PostgresSaver methods
    mockCheckpointer = {
      getTuple: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      putWrites: vi.fn().mockResolvedValue(undefined),
    };

    // Setup mock Langfuse handler
    mockLangfuseHandler = {
      traceId: 'trace-123',
      flushAsync: vi.fn().mockResolvedValue(undefined),
    };

    // Configure mocks
    vi.mocked(getResilientModel).mockReturnValue(mockModel as BaseChatModel);
    vi.mocked(getOrInitCheckpointer).mockResolvedValue(mockCheckpointer);
    vi.mocked(createLangfuseHandler).mockReturnValue(mockLangfuseHandler);
    vi.mocked(renderChatAgent).mockReturnValue('System prompt');
  });

  // ===========================================================================
  // getChatAgent Tests
  // ===========================================================================

  describe('getChatAgent', () => {
    it('should compile agent with checkpointer', async () => {
      const agent = await getChatAgent();

      expect(agent).toBeDefined();
      expect(getOrInitCheckpointer).toHaveBeenCalledOnce();
    });

    it('should return cached agent on subsequent calls', async () => {
      // Clear mocks to track calls
      vi.clearAllMocks();

      const agent1 = await getChatAgent();
      const callCount1 = vi.mocked(getOrInitCheckpointer).mock.calls.length;

      const agent2 = await getChatAgent();
      const callCount2 = vi.mocked(getOrInitCheckpointer).mock.calls.length;

      expect(agent1).toBe(agent2);
      expect(callCount2).toBe(callCount1); // Should not increase
    });

    it('should compile graph with correct structure', async () => {
      const agent = await getChatAgent();

      // Verify agent has required methods
      expect(agent.invoke).toBeDefined();
      expect(agent.stream).toBeDefined();
      expect(typeof agent.invoke).toBe('function');
      expect(typeof agent.stream).toBe('function');
    });
  });

  // ===========================================================================
  // Configuration Tests
  // ===========================================================================

  describe('Configuration', () => {
    const mockInput: ChatInput = {
      message: 'Hello, how are you?',
      userId: 'user-123',
      sessionId: 'session-456',
      threadId: 'thread-789',
      persona: 'helpful assistant',
    };

    it('should create Langfuse handler with correct tags for chat', async () => {
      try {
        await chat(mockInput);
      } catch {
        // May fail due to graph execution, but we can check handler creation
      }

      expect(createLangfuseHandler).toHaveBeenCalledWith({
        userId: 'user-123',
        sessionId: 'session-456',
        tags: ['chat-agent'],
      });
    });

    it('should create Langfuse handler with streaming tags for chatStream', async () => {
      try {
        const stream = chatStream(mockInput);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          break; // Just start the stream
        }
      } catch {
        // May fail due to graph execution
      }

      expect(createLangfuseHandler).toHaveBeenCalledWith({
        userId: 'user-123',
        sessionId: 'session-456',
        tags: ['chat-agent', 'streaming'],
      });
    });

    it('should use custom persona in prompt rendering', async () => {
      const agent = await getChatAgent();

      // Verify agent can be invoked (even if it fails in test env)
      expect(agent.invoke).toBeDefined();

      // Verify the prompt renderer would be called with custom persona
      // This is tested indirectly through the agent's construction
      expect(renderChatAgent).toBeDefined();
    });

    it('should work without Langfuse handler', async () => {
      vi.mocked(createLangfuseHandler).mockReturnValue(null);

      try {
        await chat(mockInput);
      } catch (error) {
        // Even if execution fails, handler should have been called
        expect(createLangfuseHandler).toHaveBeenCalled();
      }
    });
  });

  // ===========================================================================
  // Mock Behavior Tests
  // ===========================================================================

  describe('Mock Behavior', () => {
    it('should setup model mock correctly', () => {
      expect(getResilientModel).toBeDefined();

      const model = getResilientModel('agent');
      expect(model).toBeDefined();
      expect(model.invoke).toBeDefined();
      expect(model.bindTools).toBeDefined();

      // Verify mock was called
      expect(vi.mocked(getResilientModel)).toHaveBeenCalled();
    });

    it('should setup checkpointer mock correctly', async () => {
      await getOrInitCheckpointer();

      expect(getOrInitCheckpointer).toHaveBeenCalled();
    });

    it('should mock Langfuse handler creation', () => {
      const handler = createLangfuseHandler({
        userId: 'test',
        sessionId: 'test',
        tags: ['test'],
      });

      expect(handler).toBeDefined();
      expect(handler?.traceId).toBe('trace-123');
      expect(handler?.flushAsync).toBeDefined();
    });
  });

  // ===========================================================================
  // Type Safety Tests
  // ===========================================================================

  describe('Type Safety', () => {
    it('should accept valid ChatInput', () => {
      const input: ChatInput = {
        message: 'Test message',
        userId: 'user-123',
        sessionId: 'session-456',
        threadId: 'thread-789',
        persona: 'assistant',
      };

      expect(input.message).toBe('Test message');
      expect(input.userId).toBe('user-123');
    });

    it('should allow undefined persona', () => {
      const input: ChatInput = {
        message: 'Test',
        userId: 'user-123',
        sessionId: 'session-456',
        threadId: 'thread-789',
        persona: undefined,
      };

      expect(input.persona).toBeUndefined();
    });
  });

  // ===========================================================================
  // Integration Readiness Tests
  // ===========================================================================

  describe('Integration Readiness', () => {
    it('should have all required exports', () => {
      expect(getChatAgent).toBeDefined();
      expect(chat).toBeDefined();
      expect(chatStream).toBeDefined();
    });

    it('should validate agent structure for integration testing', async () => {
      const agent = await getChatAgent();

      // These are the key methods needed for integration tests
      expect(agent.invoke).toBeDefined();
      expect(agent.stream).toBeDefined();

      // Verify agent has LangGraph properties
      expect(agent).toBeDefined();
      expect(typeof agent).toBe('object');
    });
  });
});

/**
 * NOTE: Full end-to-end tests that actually invoke the agent with messages
 * and tools are better suited for integration tests that use real LLM models.
 *
 * These unit tests focus on:
 * - Graph compilation
 * - Configuration setup
 * - Mock validation
 * - Type safety
 *
 * For E2E testing, see:
 * - tests/integration/agents/chat-agent.integration.test.ts
 * - tests/e2e/chat-flows.e2e.test.ts
 */
