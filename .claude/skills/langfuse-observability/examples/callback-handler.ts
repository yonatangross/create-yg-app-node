/**
 * Basic CallbackHandler Setup for LangChain.js
 *
 * Demonstrates automatic tracing for chains, agents, and retrievers.
 */

import { CallbackHandler } from '@langfuse/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// ============================================================================
// Basic Setup
// ============================================================================

/**
 * Create a Langfuse callback handler for tracing
 */
export function createLangfuseHandler(options?: {
  userId?: string;
  sessionId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}) {
  return new CallbackHandler({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
    baseUrl: process.env.LANGFUSE_BASEURL,
    userId: options?.userId,
    sessionId: options?.sessionId,
    tags: options?.tags,
    metadata: options?.metadata,
  });
}

// ============================================================================
// Simple Chain with Tracing
// ============================================================================

const model = new ChatOpenAI({
  modelName: 'gpt-4-turbo',
  temperature: 0,
});

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant that {task}.'],
  ['human', '{input}'],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

/**
 * Invoke chain with automatic Langfuse tracing
 */
export async function summarizeText(
  text: string,
  userId?: string
): Promise<string> {
  const handler = createLangfuseHandler({
    userId,
    tags: ['summarization'],
    metadata: { inputLength: text.length },
  });

  try {
    const result = await chain.invoke(
      {
        task: 'summarizes text concisely',
        input: text,
      },
      { callbacks: [handler] }
    );

    // Optional: Add success score
    handler.langfuse.score({
      traceId: handler.traceId,
      name: 'completed',
      value: 1,
      dataType: 'BOOLEAN',
    });

    return result;
  } catch (error) {
    // Capture error in trace
    handler.langfuse.score({
      traceId: handler.traceId,
      name: 'error',
      value: 0,
      dataType: 'BOOLEAN',
      comment: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    // CRITICAL: Always flush to ensure data is sent
    await handler.flushAsync();
  }
}

// ============================================================================
// Streaming with Tracing
// ============================================================================

/**
 * Stream chain output with Langfuse tracing
 */
export async function* streamSummary(
  text: string,
  userId?: string
): AsyncGenerator<string> {
  const handler = createLangfuseHandler({
    userId,
    tags: ['summarization', 'streaming'],
  });

  try {
    const stream = await chain.stream(
      {
        task: 'summarizes text concisely',
        input: text,
      },
      { callbacks: [handler] }
    );

    for await (const chunk of stream) {
      yield chunk;
    }
  } finally {
    await handler.flushAsync();
  }
}

// ============================================================================
// Multiple Chains in One Trace
// ============================================================================

/**
 * Run multiple chains under a single trace
 */
export async function analyzeAndSummarize(
  text: string,
  userId?: string
): Promise<{ summary: string; analysis: string }> {
  // Single handler for entire operation
  const handler = createLangfuseHandler({
    userId,
    tags: ['multi-step'],
    metadata: { operation: 'analyze-and-summarize' },
  });

  try {
    // First chain: summarize
    const summary = await chain.invoke(
      { task: 'summarizes text', input: text },
      { callbacks: [handler] }
    );

    // Second chain: analyze (same trace)
    const analysis = await chain.invoke(
      { task: 'analyzes the sentiment of', input: summary },
      { callbacks: [handler] }
    );

    return { summary, analysis };
  } finally {
    await handler.flushAsync();
  }
}

// ============================================================================
// With Custom Spans
// ============================================================================

/**
 * Add custom spans within a trace
 */
export async function processWithValidation(
  text: string,
  userId?: string
): Promise<string> {
  const handler = createLangfuseHandler({
    userId,
    tags: ['with-validation'],
  });

  try {
    // Custom span for validation
    const validationSpan = handler.langfuse.span({
      traceId: handler.traceId,
      name: 'input-validation',
      input: { textLength: text.length },
    });

    // Validation logic
    if (text.length < 10) {
      validationSpan.end({
        output: { valid: false, reason: 'too-short' },
        level: 'WARNING',
      });
      throw new Error('Text too short');
    }

    validationSpan.end({ output: { valid: true } });

    // Main chain execution
    const result = await chain.invoke(
      { task: 'summarizes text', input: text },
      { callbacks: [handler] }
    );

    return result;
  } finally {
    await handler.flushAsync();
  }
}

// ============================================================================
// Usage Example
// ============================================================================

async function main() {
  const text = `
    Langfuse is an open-source LLM engineering platform that helps teams
    collaboratively debug, analyze, and iterate on their LLM applications.
    It provides tracing, prompt management, and evaluation capabilities.
  `;

  // Basic usage
  const summary = await summarizeText(text, 'user-123');
  console.log('Summary:', summary);

  // Streaming
  console.log('Streaming:');
  for await (const chunk of streamSummary(text, 'user-123')) {
    process.stdout.write(chunk);
  }
  console.log();

  // Multi-step
  const result = await analyzeAndSummarize(text, 'user-123');
  console.log('Multi-step result:', result);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
