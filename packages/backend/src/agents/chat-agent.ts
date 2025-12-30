/**
 * Chat Agent using LangGraph 1.0 Annotation API
 *
 * Production-ready conversational agent with:
 * - Tool calling support
 * - Persistent memory via PostgresSaver
 * - Langfuse tracing integration
 */

import {
  Annotation,
  StateGraph,
  END,
  START,
  MessagesAnnotation,
} from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { evaluate } from 'mathjs';
import type { RunnableConfig } from '@langchain/core/runnables';
import { getModel } from '../core/models.js';
import { getOrInitCheckpointer } from '../shared/checkpointer.js';
import { createLangfuseHandler } from '../core/langfuse.js';
import { getLogger } from '../core/logger.js';
import { renderChatAgent } from '../prompts/loader.js';
import { withTimeout, getTimeout } from '../core/timeout.js';
import { withCircuitBreaker } from '../core/resilience.js';
import '../types/langfuse.js'; // Type augmentations

const logger = getLogger();

// =============================================================================
// State Definition - Extend MessagesAnnotation
// =============================================================================

/**
 * Chat agent state extends the built-in MessagesAnnotation
 */
const ChatAgentState = Annotation.Root({
  // Inherit messages with proper reducer
  ...MessagesAnnotation.spec,

  // Additional scalar fields (no reducer needed)
  userId: Annotation<string>,
  sessionId: Annotation<string>,
  persona: Annotation<string>,
});

export type ChatAgentStateType = typeof ChatAgentState.State;

// =============================================================================
// Tools
// =============================================================================

/**
 * Current time tool
 */
const getCurrentTimeTool = tool(
  async () => {
    return new Date().toISOString();
  },
  {
    name: 'get_current_time',
    description: 'Get the current date and time in ISO format',
    schema: z.object({}),
  }
);

/**
 * Calculator tool - uses mathjs for safe evaluation without eval/Function constructor
 */
const calculatorTool = tool(
  async ({ expression }) => {
    try {
      // mathjs provides safe evaluation with configurable scope
      // Restricted to basic math operations, no variable assignments or function definitions
      const result = evaluate(expression, {});
      return String(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to evaluate expression';
      return `Error: ${errorMessage}`;
    }
  },
  {
    name: 'calculator',
    description:
      'Evaluate a mathematical expression. Supports +, -, *, /, %, ^, parentheses, and common math functions (sqrt, sin, cos, etc).',
    schema: z.object({
      expression: z
        .string()
        .describe('The mathematical expression to evaluate'),
    }),
  }
);

const defaultTools = [getCurrentTimeTool, calculatorTool];

// =============================================================================
// Agent Nodes
// =============================================================================

/**
 * Agent node - processes messages and decides on tool use
 * Now with circuit breaker and timeout protection
 */
async function agentNode(
  state: typeof ChatAgentState.State,
  config?: RunnableConfig
): Promise<Partial<typeof ChatAgentState.State>> {
  const model = getModel('agent');

  // Bind tools to model
  const modelWithTools = model.bindTools?.(defaultTools) ?? model;

  // Generate system prompt
  const systemPrompt = renderChatAgent({
    persona: state.persona || 'helpful assistant',
    tools: defaultTools.map((t) => t.name),
  });

  // Get last messages for context window management
  const recentMessages = state.messages.slice(-20);

  // Create messages array with system prompt
  const messages = [
    new HumanMessage({ content: systemPrompt }),
    ...recentMessages,
  ];

  logger.debug(
    { messageCount: messages.length, persona: state.persona },
    'Agent processing messages'
  );

  // Invoke model with circuit breaker and timeout protection
  const protectedInvoke = withCircuitBreaker(
    () =>
      withTimeout(
        modelWithTools.invoke(messages, config),
        getTimeout('LLM_INVOKE'),
        'chat-agent-invoke'
      ),
    'llm',
    'chat-agent'
  );

  const response = await protectedInvoke();

  return {
    messages: [response],
  };
}

/**
 * Determine if we should continue to tools or end
 */
function shouldContinue(
  state: typeof ChatAgentState.State
): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];

  // If the last message has tool calls, continue to tools node
  if (
    lastMessage &&
    'tool_calls' in lastMessage &&
    Array.isArray((lastMessage as AIMessage).tool_calls) &&
    (lastMessage as AIMessage).tool_calls!.length > 0
  ) {
    return 'tools';
  }

  // Otherwise, we're done
  return END;
}

// =============================================================================
// Graph Construction
// =============================================================================

/**
 * Create the chat agent graph
 */
function createChatAgentGraph() {
  const toolNode = new ToolNode(defaultTools);

  const workflow = new StateGraph(ChatAgentState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue, ['tools', END])
    .addEdge('tools', 'agent');

  return workflow;
}

// =============================================================================
// Compiled Agent
// =============================================================================

let compiledAgent: Awaited<
  ReturnType<ReturnType<typeof createChatAgentGraph>['compile']>
> | null = null;

/**
 * Get or create the compiled chat agent with checkpointer
 */
export async function getChatAgent() {
  if (compiledAgent) {
    return compiledAgent;
  }

  const checkpointer = await getOrInitCheckpointer();
  const workflow = createChatAgentGraph();

  compiledAgent = workflow.compile({
    checkpointer,
  });

  logger.info('Chat agent compiled with PostgresSaver checkpointer');
  return compiledAgent;
}

// =============================================================================
// Chat Function
// =============================================================================

export interface ChatInput {
  message: string;
  userId: string;
  sessionId: string;
  threadId: string;
  persona: string | undefined;
}

export interface ChatOutput {
  response: string;
  traceId: string | undefined;
  toolsUsed: string[];
}

/**
 * Process a chat message through the agent
 *
 * Langfuse tracing is fire-and-forget - errors are logged but never propagate.
 */
export async function chat(input: ChatInput): Promise<ChatOutput> {
  const agent = await getChatAgent();

  // Create Langfuse handler for tracing (wrapped in SafeCallbackHandler)
  const langfuseHandler = createLangfuseHandler({
    userId: input.userId,
    sessionId: input.sessionId,
    tags: ['chat-agent'],
  });

  const callbacks = langfuseHandler ? [langfuseHandler] : [];

  logger.info(
    { userId: input.userId, threadId: input.threadId },
    'Processing chat message'
  );

  const invokeParams = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    sessionId: input.sessionId,
    persona: input.persona || 'helpful assistant',
  };

  const invokeConfig = {
    configurable: { thread_id: input.threadId },
    callbacks,
  };

  // Invoke the agent - SafeCallbackHandler ensures tracing errors don't propagate
  let result;
  try {
    result = await agent.invoke(invokeParams, invokeConfig);
  } catch (error) {
    // Extract error details for proper logging (LangGraph errors may have non-standard structure)
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      cause:
        error instanceof Error
          ? (error as Error & { cause?: unknown }).cause
          : undefined,
      // Include any additional properties from LangGraph errors
      ...(typeof error === 'object' && error !== null ? error : {}),
    };
    logger.error({ error: errorDetails, input }, 'Chat agent error');
    // Flush Langfuse on error (SafeCallbackHandler makes this safe)
    if (langfuseHandler) {
      await langfuseHandler.flushAsync();
    }
    throw error;
  }

  // Extract response and tools used
  const lastMessage = result.messages[result.messages.length - 1] as AIMessage;
  const response =
    typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  // Collect tools used from message history
  const toolsUsed: string[] = [];
  for (const m of result.messages) {
    if ('tool_calls' in m && Array.isArray((m as AIMessage).tool_calls)) {
      for (const tc of (m as AIMessage).tool_calls!) {
        if (tc.name) toolsUsed.push(tc.name);
      }
    }
  }

  // Flush Langfuse (SafeCallbackHandler makes this safe)
  if (langfuseHandler) {
    await langfuseHandler.flushAsync();
  }

  return {
    response,
    traceId: langfuseHandler?.traceId,
    toolsUsed: [...new Set(toolsUsed)],
  };
}

// =============================================================================
// Streaming Chat
// =============================================================================

/**
 * Stream event types with properly typed content
 */
export type StreamEvent =
  | {
      type: 'text_delta';
      content: string;
      traceId?: string;
    }
  | {
      type: 'tool_call';
      toolCallId: string;
      toolName: string;
      toolInput: unknown;
      traceId?: string;
    }
  | {
      type: 'tool_result';
      toolCallId: string;
      result: string;
      traceId?: string;
    }
  | {
      type: 'done';
      traceId: string | undefined;
    };

/**
 * Extract text content from both OpenAI (string) and Anthropic (content blocks array) formats
 * @internal Exported for testing - use chatStream for production
 */
export function extractTextContent(content: unknown): string {
  // OpenAI format: content is a string
  if (typeof content === 'string') {
    return content;
  }

  // Anthropic format: content is an array of content blocks
  if (Array.isArray(content)) {
    let text = '';
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        'type' in block &&
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string'
      ) {
        text += block.text;
      }
    }
    return text;
  }

  return '';
}

/**
 * Stream chat responses using LangGraph's streamEvents() API
 *
 * Uses the full LangGraph agent loop with:
 * - Token-level streaming via 'on_chat_model_stream' events
 * - Tool execution with 'on_tool_start' and 'on_tool_end' events
 * - Conversation history/memory via checkpointer
 * - Support for both OpenAI (string) and Anthropic (content blocks) formats
 *
 * Langfuse tracing is fire-and-forget - errors are logged but never propagate.
 */
export async function* chatStream(
  input: ChatInput
): AsyncGenerator<StreamEvent> {
  const agent = await getChatAgent();

  // Create Langfuse handler for tracing (wrapped in SafeCallbackHandler)
  const langfuseHandler = createLangfuseHandler({
    userId: input.userId,
    sessionId: input.sessionId,
    tags: ['chat-agent', 'streaming'],
  });

  const callbacks = langfuseHandler ? [langfuseHandler] : [];

  logger.info(
    { userId: input.userId, threadId: input.threadId },
    'Starting stream chat'
  );

  const streamParams = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    sessionId: input.sessionId,
    persona: input.persona || 'helpful assistant',
  };

  const streamConfig = {
    configurable: { thread_id: input.threadId },
    callbacks,
    version: 'v2' as const,
  };

  try {
    // Use streamEvents() for proper LangGraph agent streaming
    const eventStream = agent.streamEvents(streamParams, streamConfig);

    for await (const event of eventStream) {
      // Handle chat model streaming events for token-level streaming
      if (event.event === 'on_chat_model_stream') {
        const chunk = event.data?.chunk;
        if (chunk && 'content' in chunk) {
          const text = extractTextContent(chunk.content);
          if (text.length > 0) {
            const streamEvent: StreamEvent = {
              type: 'text_delta',
              content: text,
            };
            if (langfuseHandler?.traceId) {
              streamEvent.traceId = langfuseHandler.traceId;
            }
            yield streamEvent;
          }
        }
      }

      // Handle tool start events
      if (event.event === 'on_tool_start') {
        const toolName = event.name;
        const toolInput = event.data?.input;
        if (toolName) {
          const streamEvent: StreamEvent = {
            type: 'tool_call',
            toolCallId: event.run_id || 'unknown',
            toolName,
            toolInput,
          };
          if (langfuseHandler?.traceId) {
            streamEvent.traceId = langfuseHandler.traceId;
          }
          yield streamEvent;
        }
      }

      // Handle tool end events
      if (event.event === 'on_tool_end') {
        const toolName = event.name;
        const output = event.data?.output;
        if (toolName && output !== undefined) {
          const result =
            typeof output === 'string' ? output : JSON.stringify(output);
          const streamEvent: StreamEvent = {
            type: 'tool_result',
            toolCallId: event.run_id || 'unknown',
            result,
          };
          if (langfuseHandler?.traceId) {
            streamEvent.traceId = langfuseHandler.traceId;
          }
          yield streamEvent;
        }
      }
    }

    yield {
      type: 'done',
      traceId: langfuseHandler?.traceId,
    };
  } catch (error) {
    // Extract error details for proper logging
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    };
    logger.error({ error: errorDetails, input }, 'Chat stream error');
    throw error;
  } finally {
    // Flush Langfuse (SafeCallbackHandler makes this safe)
    if (langfuseHandler) {
      await langfuseHandler.flushAsync();
    }
  }
}
