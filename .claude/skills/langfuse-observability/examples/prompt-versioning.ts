/**
 * Prompt Versioning Integration with Langfuse
 *
 * Demonstrates fetching versioned prompts and linking to traces.
 */

import { Langfuse } from 'langfuse';
import { CallbackHandler } from '@langfuse/langchain';
import { ChatOpenAI } from '@langchain/openai';
import {
  PromptTemplate,
  ChatPromptTemplate,
  type BaseMessagePromptTemplateLike,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// ============================================================================
// Langfuse Client Setup
// ============================================================================

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_BASEURL,
});

const model = new ChatOpenAI({
  modelName: 'gpt-4-turbo',
  temperature: 0,
});

// ============================================================================
// Text Prompt Fetching
// ============================================================================

/**
 * Fetch and use a text prompt from Langfuse
 */
export async function getTextPrompt(
  promptName: string,
  options?: {
    version?: number;
    label?: string;
    cacheTtlSeconds?: number;
  }
) {
  const langfusePrompt = await langfuse.getPrompt(
    promptName,
    options?.version,
    {
      label: options?.label,
      cacheTtlSeconds: options?.cacheTtlSeconds ?? 300, // 5 min default cache
    }
  );

  // getLangchainPrompt() converts {{var}} to {var}
  const template = langfusePrompt.getLangchainPrompt();

  // Create LangChain prompt with metadata for trace linking
  const prompt = PromptTemplate.fromTemplate(template).withConfig({
    metadata: { langfusePrompt }, // Auto-links to prompt version in traces
  });

  return { prompt, langfusePrompt };
}

// ============================================================================
// Chat Prompt Fetching
// ============================================================================

/**
 * Fetch and use a chat prompt from Langfuse
 */
export async function getChatPrompt(
  promptName: string,
  options?: {
    version?: number;
    label?: string;
    cacheTtlSeconds?: number;
  }
) {
  const langfusePrompt = await langfuse.getPrompt(
    promptName,
    options?.version,
    {
      type: 'chat', // Specify chat type
      label: options?.label,
      cacheTtlSeconds: options?.cacheTtlSeconds ?? 300,
    }
  );

  // Returns array of { role, content } messages
  const messages = langfusePrompt.getLangchainPrompt() as Array<{
    role: string;
    content: string;
  }>;

  // Convert to LangChain format
  const formattedMessages: BaseMessagePromptTemplateLike[] = messages.map(
    (m) => [m.role as 'system' | 'human' | 'assistant', m.content]
  );

  const prompt = ChatPromptTemplate.fromMessages(formattedMessages).withConfig({
    metadata: { langfusePrompt },
  });

  return { prompt, langfusePrompt };
}

// ============================================================================
// Production vs Development Pattern
// ============================================================================

type Environment = 'development' | 'staging' | 'production';

/**
 * Get prompt with environment-appropriate versioning
 */
export async function getEnvironmentPrompt(
  promptName: string,
  env: Environment = (process.env.NODE_ENV as Environment) || 'development'
) {
  const labelMap: Record<Environment, string | undefined> = {
    development: undefined, // Use latest in dev
    staging: 'staging',
    production: 'production',
  };

  const label = labelMap[env];

  return getTextPrompt(promptName, {
    label,
    cacheTtlSeconds: env === 'production' ? 600 : 60, // Longer cache in prod
  });
}

// ============================================================================
// Complete Chain with Versioned Prompt
// ============================================================================

/**
 * Create a chain using a Langfuse-managed prompt
 */
export async function createSummarizerChain() {
  const { prompt, langfusePrompt } = await getEnvironmentPrompt('summarizer');

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  // Return chain with metadata for logging
  return {
    chain,
    promptVersion: langfusePrompt.version,
    promptName: langfusePrompt.name,
  };
}

/**
 * Invoke chain with full tracing and prompt linking
 */
export async function summarizeWithVersionedPrompt(
  document: string,
  userId?: string
): Promise<{ result: string; promptVersion: number; traceId: string }> {
  const { chain, promptVersion, promptName } = await createSummarizerChain();

  const handler = new CallbackHandler({
    userId,
    metadata: {
      promptName,
      promptVersion,
    },
    tags: ['summarization', `prompt-v${promptVersion}`],
  });

  try {
    const result = await chain.invoke(
      { document },
      { callbacks: [handler] }
    );

    return {
      result,
      promptVersion,
      traceId: handler.traceId,
    };
  } finally {
    await handler.flushAsync();
  }
}

// ============================================================================
// A/B Testing Pattern
// ============================================================================

/**
 * Run A/B test between prompt versions
 */
export async function abTestPrompts(
  input: string,
  userId: string
): Promise<{
  version: 'A' | 'B';
  result: string;
  traceId: string;
}> {
  // Simple random assignment (use proper experimentation framework in production)
  const useVersionA = Math.random() < 0.5;

  const langfusePrompt = await langfuse.getPrompt(
    'summarizer',
    undefined,
    { label: useVersionA ? 'variant-a' : 'variant-b' }
  );

  const prompt = PromptTemplate.fromTemplate(
    langfusePrompt.getLangchainPrompt()
  ).withConfig({
    metadata: { langfusePrompt },
  });

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const handler = new CallbackHandler({
    userId,
    metadata: {
      abTest: 'summarizer-v2-experiment',
      variant: useVersionA ? 'A' : 'B',
    },
    tags: ['ab-test', useVersionA ? 'variant-a' : 'variant-b'],
  });

  try {
    const result = await chain.invoke({ input }, { callbacks: [handler] });

    return {
      version: useVersionA ? 'A' : 'B',
      result,
      traceId: handler.traceId,
    };
  } finally {
    await handler.flushAsync();
  }
}

// ============================================================================
// Prompt with Fallback
// ============================================================================

/**
 * Fetch prompt with fallback to local template
 */
export async function getPromptWithFallback(
  promptName: string,
  fallbackTemplate: string
): Promise<PromptTemplate> {
  try {
    const { prompt } = await getEnvironmentPrompt(promptName);
    return prompt;
  } catch (error) {
    console.warn(
      `Failed to fetch prompt "${promptName}" from Langfuse, using fallback:`,
      error
    );

    // Return local fallback
    return PromptTemplate.fromTemplate(fallbackTemplate).withConfig({
      metadata: { source: 'fallback', promptName },
    });
  }
}

// ============================================================================
// Usage Example
// ============================================================================

async function main() {
  // Basic versioned prompt usage
  const { result, promptVersion, traceId } = await summarizeWithVersionedPrompt(
    'Langfuse is an open-source LLM engineering platform...',
    'user-123'
  );

  console.log('Summary:', result);
  console.log('Prompt version:', promptVersion);
  console.log('Trace ID:', traceId);

  // A/B testing
  const abResult = await abTestPrompts(
    'Some text to summarize...',
    'user-456'
  );

  console.log('A/B variant:', abResult.version);
  console.log('Result:', abResult.result);

  // With fallback
  const promptWithFallback = await getPromptWithFallback(
    'maybe-nonexistent-prompt',
    'Summarize this: {input}'
  );

  console.log('Got prompt:', promptWithFallback);

  // Cleanup
  await langfuse.shutdownAsync();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
