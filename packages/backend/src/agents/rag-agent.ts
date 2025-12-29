/**
 * RAG Agent using LangGraph 1.0 Annotation API
 *
 * Retrieval-Augmented Generation agent with:
 * - Vector similarity search
 * - Source citation
 * - Relevance scoring
 * - Fallback handling
 */

import { Annotation, StateGraph, END, START, MessagesAnnotation } from '@langchain/langgraph';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import { getModel } from '../core/models.js';
import { getOrInitCheckpointer } from '../shared/checkpointer.js';
import { createLangfuseHandler } from '../core/langfuse.js';
import { getLogger } from '../core/logger.js';
import { renderRAGAgent } from '../prompts/loader.js';
import { similaritySearchWithScore } from '../shared/vector-store.js';
import { withTimeout, getTimeout } from '../core/timeout.js';
import { withCircuitBreaker } from '../core/resilience.js';
import '../types/langfuse.js'; // Type augmentations

const logger = getLogger();

// =============================================================================
// Types
// =============================================================================

/**
 * Source document with relevance score
 */
export interface RetrievedSource {
  id: string;
  title: string;
  content: string;
  score: number;
  metadata: Record<string, unknown> | undefined;
}

// =============================================================================
// State Definition
// =============================================================================

/**
 * RAG agent state extends MessagesAnnotation
 */
const RAGAgentState = Annotation.Root({
  // Inherit messages
  ...MessagesAnnotation.spec,

  // Query and response
  query: Annotation<string>,
  response: Annotation<string>,

  // Retrieved documents
  sources: Annotation<RetrievedSource[]>({
    reducer: (_prev, next) => next, // Replace sources on each retrieval
    default: () => [],
  }),

  // Control flags
  hasRelevantSources: Annotation<boolean>,

  // User context
  userId: Annotation<string>,

  // Configuration
  maxSources: Annotation<number>,
  requireCitations: Annotation<boolean>,
});

export type RAGAgentStateType = typeof RAGAgentState.State;

// =============================================================================
// Agent Nodes
// =============================================================================

/**
 * Retrieve relevant documents from vector store
 * Now with timeout protection for vector search operations
 */
async function retrieveNode(
  state: typeof RAGAgentState.State,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config?: RunnableConfig
): Promise<Partial<typeof RAGAgentState.State>> {
  const maxSources = state.maxSources || 5;

  logger.debug({ query: state.query, maxSources }, 'Retrieving documents');

  try {
    // Search with scores - wrapped with timeout protection
    const results = await withTimeout(
      similaritySearchWithScore(state.query, maxSources),
      getTimeout('VECTOR_SEARCH'),
      'vector-similarity-search'
    );

    // Transform to source format
    const sources: RetrievedSource[] = results.map(([doc, score]: [{ pageContent: string; metadata?: Record<string, unknown> }, number], index: number) => ({
      id: (doc.metadata?.id as string) || `doc-${index}`,
      title: (doc.metadata?.title as string) || `Document ${index + 1}`,
      content: doc.pageContent,
      score: 1 - score, // Convert distance to similarity
      metadata: doc.metadata,
    }));

    // Filter by relevance threshold (0.3 similarity after conversion)
    const relevantSources = sources.filter((s) => s.score >= 0.3);
    const hasRelevantSources = relevantSources.length > 0;

    logger.info(
      {
        totalResults: sources.length,
        relevantResults: relevantSources.length,
        query: state.query.slice(0, 50),
      },
      'Documents retrieved'
    );

    return {
      sources: relevantSources,
      hasRelevantSources,
    };
  } catch (error) {
    logger.error({ error, query: state.query }, 'Retrieval failed');
    return {
      sources: [],
      hasRelevantSources: false,
    };
  }
}

/**
 * Generate response based on retrieved context
 * Now with circuit breaker and timeout protection
 */
async function generateNode(
  state: typeof RAGAgentState.State,
  config?: RunnableConfig
): Promise<Partial<typeof RAGAgentState.State>> {
  const model = getModel('agent');

  // Build context from sources
  const contextParts = state.sources.map(
    (s, i) => `[${i + 1}] ${s.title}\n${s.content}`
  );
  const context = contextParts.join('\n\n---\n\n');

  // Generate prompt
  const systemPrompt = renderRAGAgent({
    query: state.query,
    context,
    sources: state.sources.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content.slice(0, 500), // Truncate for prompt
      score: s.score,
    })),
    max_sources: state.maxSources || 5,
    require_citations: state.requireCitations ?? true,
  });

  logger.debug(
    {
      sourceCount: state.sources.length,
      contextLength: context.length,
    },
    'Generating response'
  );

  // Get last user messages
  const recentMessages = state.messages.slice(-10);

  const messages = [
    new SystemMessage(systemPrompt),
    ...recentMessages,
    new HumanMessage(state.query),
  ];

  // Invoke model with circuit breaker and timeout protection
  const protectedInvoke = withCircuitBreaker(
    () => withTimeout(
      model.invoke(messages, config),
      getTimeout('LLM_INVOKE'),
      'rag-generate-invoke'
    ),
    'llm',
    'rag-agent'
  );

  const response = await protectedInvoke();

  const responseText = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  return {
    response: responseText,
    messages: [new AIMessage(responseText)],
  };
}

/**
 * Handle case when no relevant sources found
 * Now with circuit breaker and timeout protection
 */
async function fallbackNode(
  state: typeof RAGAgentState.State,
  config?: RunnableConfig
): Promise<Partial<typeof RAGAgentState.State>> {
  const model = getModel('agent');

  const fallbackPrompt = `You are a helpful assistant. The user asked: "${state.query}"

Unfortunately, I couldn't find any relevant information in the knowledge base to answer this question.

Please provide a helpful response that:
1. Acknowledges you don't have specific information on this topic
2. Suggests what kind of information might help
3. Offers to help with related questions you might be able to answer

Be concise and helpful.`;

  // Invoke model with circuit breaker and timeout protection
  const protectedInvoke = withCircuitBreaker(
    () => withTimeout(
      model.invoke([new SystemMessage(fallbackPrompt), new HumanMessage(state.query)], config),
      getTimeout('LLM_INVOKE'),
      'rag-fallback-invoke'
    ),
    'llm',
    'rag-agent-fallback'
  );

  const response = await protectedInvoke();

  const responseText = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  logger.info({ query: state.query.slice(0, 50) }, 'Using fallback response');

  return {
    response: responseText,
    messages: [new AIMessage(responseText)],
  };
}

/**
 * Route based on retrieval results
 */
function routeAfterRetrieval(
  state: typeof RAGAgentState.State
): 'generate' | 'fallback' {
  if (state.hasRelevantSources && state.sources.length > 0) {
    return 'generate';
  }
  return 'fallback';
}

// =============================================================================
// Graph Construction
// =============================================================================

/**
 * Create the RAG agent graph
 */
function createRAGAgentGraph() {
  const workflow = new StateGraph(RAGAgentState)
    .addNode('retrieve', retrieveNode)
    .addNode('generate', generateNode)
    .addNode('fallback', fallbackNode)
    .addEdge(START, 'retrieve')
    .addConditionalEdges('retrieve', routeAfterRetrieval, ['generate', 'fallback'])
    .addEdge('generate', END)
    .addEdge('fallback', END);

  return workflow;
}

// =============================================================================
// Compiled Agent
// =============================================================================

let compiledAgent: Awaited<ReturnType<ReturnType<typeof createRAGAgentGraph>['compile']>> | null = null;

/**
 * Get or create the compiled RAG agent
 */
export async function getRAGAgent() {
  if (compiledAgent) {
    return compiledAgent;
  }

  const checkpointer = await getOrInitCheckpointer();
  const workflow = createRAGAgentGraph();

  compiledAgent = workflow.compile({
    checkpointer,
  });

  logger.info('RAG agent compiled with PostgresSaver checkpointer');
  return compiledAgent;
}

// =============================================================================
// Query Function
// =============================================================================

export interface RAGQueryInput {
  query: string;
  userId: string;
  sessionId: string;
  threadId: string;
  maxSources: number | undefined;
  requireCitations: boolean | undefined;
}

export interface RAGQueryOutput {
  response: string;
  sources: RetrievedSource[];
  traceId: string | undefined;
  usedFallback: boolean;
}

/**
 * Query the RAG agent
 */
export async function ragQuery(input: RAGQueryInput): Promise<RAGQueryOutput> {
  const agent = await getRAGAgent();

  // Create Langfuse handler
  const langfuseHandler = createLangfuseHandler({
    userId: input.userId,
    sessionId: input.sessionId,
    tags: ['rag-agent'],
  });

  const callbacks = langfuseHandler ? [langfuseHandler] : [];

  logger.info(
    { userId: input.userId, threadId: input.threadId, query: input.query.slice(0, 50) },
    'Processing RAG query'
  );

  try {
    const result = await agent.invoke(
      {
        query: input.query,
        userId: input.userId,
        maxSources: input.maxSources || 5,
        requireCitations: input.requireCitations ?? true,
        messages: [],
        sources: [],
        response: '',
        hasRelevantSources: false,
      },
      {
        configurable: { thread_id: input.threadId },
        callbacks,
      }
    );

    // Flush Langfuse
    if (langfuseHandler) {
      await langfuseHandler.flushAsync();
    }

    return {
      response: result.response,
      sources: result.sources,
      traceId: langfuseHandler?.traceId,
      usedFallback: !result.hasRelevantSources,
    };
  } catch (error) {
    logger.error({ error, input }, 'RAG agent error');

    if (langfuseHandler) {
      await langfuseHandler.flushAsync();
    }

    throw error;
  }
}

// =============================================================================
// Streaming Query
// =============================================================================

/**
 * Stream RAG responses with source info
 */
export async function* ragQueryStream(input: RAGQueryInput): AsyncGenerator<{
  type: 'sources' | 'token' | 'done';
  content: string | RetrievedSource[];
  traceId: string | undefined;
}> {
  const agent = await getRAGAgent();

  const langfuseHandler = createLangfuseHandler({
    userId: input.userId,
    sessionId: input.sessionId,
    tags: ['rag-agent', 'streaming'],
  });

  const callbacks = langfuseHandler ? [langfuseHandler] : [];

  try {
    const stream = await agent.stream(
      {
        query: input.query,
        userId: input.userId,
        maxSources: input.maxSources || 5,
        requireCitations: input.requireCitations ?? true,
        messages: [],
        sources: [],
        response: '',
        hasRelevantSources: false,
      },
      {
        configurable: { thread_id: input.threadId },
        callbacks,
        streamMode: 'updates',
      }
    );

    let sourcesEmitted = false;

    for await (const chunk of stream) {
      // Emit sources after retrieval
      if ('retrieve' in chunk && !sourcesEmitted) {
        const retrieveState = chunk.retrieve as Partial<typeof RAGAgentState.State>;
        if (retrieveState.sources && retrieveState.sources.length > 0) {
          yield { type: 'sources', content: retrieveState.sources, traceId: undefined };
          sourcesEmitted = true;
        }
      }

      // Emit response tokens
      if ('generate' in chunk || 'fallback' in chunk) {
        const nodeKey = 'generate' in chunk ? 'generate' : 'fallback';
        const nodeState = chunk[nodeKey] as Partial<typeof RAGAgentState.State>;
        if (nodeState.response) {
          yield { type: 'token', content: nodeState.response, traceId: undefined };
        }
      }
    }

    yield {
      type: 'done',
      content: '',
      traceId: langfuseHandler?.traceId,
    };
  } finally {
    if (langfuseHandler) {
      await langfuseHandler.flushAsync();
    }
  }
}
