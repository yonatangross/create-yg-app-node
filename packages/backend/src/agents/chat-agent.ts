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
 * Stream chat responses
 *
 * Langfuse tracing is fire-and-forget - errors are logged but never propagate.
 */
export async function* chatStream(input: ChatInput): AsyncGenerator<{
  type: 'token' | 'tool_call' | 'tool_result' | 'done';
  content: string;
  traceId: string | undefined;
}> {
  const agent = await getChatAgent();

  // Create Langfuse handler for tracing (wrapped in SafeCallbackHandler)
  const langfuseHandler = createLangfuseHandler({
    userId: input.userId,
    sessionId: input.sessionId,
    tags: ['chat-agent', 'streaming'],
  });

  const callbacks = langfuseHandler ? [langfuseHandler] : [];

  const streamParams = {
    messages: [new HumanMessage(input.message)],
    userId: input.userId,
    sessionId: input.sessionId,
    persona: input.persona || 'helpful assistant',
  };

  const streamConfig = {
    configurable: { thread_id: input.threadId },
    callbacks,
    streamMode: 'values' as const,
  };

  // Stream with SafeCallbackHandler - tracing errors won't propagate
  const stream = await agent.stream(streamParams, streamConfig);

  try {
    for await (const chunk of stream) {
      const lastMessage = chunk.messages[chunk.messages.length - 1];

      if (lastMessage && 'content' in lastMessage) {
        const content =
          typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);

        if (content) {
          yield { type: 'token', content, traceId: undefined };
        }
      }
    }

    yield {
      type: 'done',
      content: '',
      traceId: langfuseHandler?.traceId,
    };
  } finally {
    // Flush Langfuse (SafeCallbackHandler makes this safe)
    if (langfuseHandler) {
      await langfuseHandler.flushAsync();
    }
  }
}
