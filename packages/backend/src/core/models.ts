/**
 * Multi-Provider LLM Registry
 *
 * Task-based model routing for cost optimization:
 * - supervisor: Fast, cheap models for orchestration
 * - agent: High-quality models for reasoning
 * - embedding: Specialized embedding models
 *
 * Lazy initialization with caching.
 * Production-ready with circuit breaker and timeout protection.
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { OpenAIEmbeddings } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Embeddings } from '@langchain/core/embeddings';
import { getConfig } from './config.js';
import { getLogger } from './logger.js';
import { withCircuitBreaker } from './resilience.js';
import { withTimeout, getTimeout } from './timeout.js';

const logger = getLogger();

/**
 * Task types for model selection
 */
export type ModelTask = 'supervisor' | 'agent' | 'embedding';

/**
 * Model configuration
 */
interface ModelConfig {
  provider: 'openai' | 'anthropic';
  modelName: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Model registry mapping tasks to configs
 */
const MODEL_REGISTRY: Record<ModelTask, ModelConfig> = {
  // Fast model for supervisor/orchestration
  supervisor: {
    provider: 'openai',
    modelName: 'gpt-4o-mini', // Fast & cheap
    temperature: 0,
    maxTokens: 4096,
  },

  // Quality model for agent reasoning
  agent: {
    provider: 'anthropic',
    modelName: 'claude-3-5-sonnet-20241022', // High quality
    temperature: 0,
    maxTokens: 4096,
  },

  // Embedding model
  embedding: {
    provider: 'openai',
    modelName: 'text-embedding-3-small', // Cost-effective
  },
};

/**
 * Model cache to avoid recreating instances
 */
const modelCache = new Map<ModelTask, BaseChatModel | Embeddings>();

/**
 * Get LLM model for a task
 *
 * @param task - Task type (supervisor, agent, embedding)
 * @param overrides - Optional config overrides
 * @returns Chat model instance
 */
export function getModel(
  task: Exclude<ModelTask, 'embedding'>,
  overrides?: Partial<ModelConfig>
): BaseChatModel {
  const cacheKey = task;

  // Return cached instance if no overrides
  if (!overrides && modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey) as BaseChatModel;
  }

  const modelConfig = { ...MODEL_REGISTRY[task], ...overrides };
  const config = getConfig();

  // Create model based on provider
  let model: BaseChatModel;

  if (modelConfig.provider === 'openai') {
    if (!config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    model = new ChatOpenAI({
      modelName: modelConfig.modelName,
      temperature: modelConfig.temperature ?? 0,
      ...(modelConfig.maxTokens && { maxTokens: modelConfig.maxTokens }),
      apiKey: config.OPENAI_API_KEY,
    });
  } else if (modelConfig.provider === 'anthropic') {
    if (!config.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    model = new ChatAnthropic({
      modelName: modelConfig.modelName,
      temperature: modelConfig.temperature ?? 0,
      ...(modelConfig.maxTokens && { maxTokens: modelConfig.maxTokens }),
      apiKey: config.ANTHROPIC_API_KEY,
    });
  } else {
    throw new Error(`Unsupported provider: ${modelConfig.provider}`);
  }

  // Cache only if no overrides
  if (!overrides) {
    modelCache.set(cacheKey, model);
    logger.info(
      {
        task,
        provider: modelConfig.provider,
        model: modelConfig.modelName,
      },
      'Model initialized'
    );
  }

  return model;
}

/**
 * Get embeddings model
 *
 * @param overrides - Optional config overrides
 * @returns Embeddings instance
 */
export function getEmbeddings(
  overrides?: Partial<ModelConfig>
): OpenAIEmbeddings {
  const cacheKey: ModelTask = 'embedding';

  // Return cached instance if no overrides
  if (!overrides && modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey) as OpenAIEmbeddings;
  }

  const modelConfig = { ...MODEL_REGISTRY.embedding, ...overrides };
  const config = getConfig();

  if (!config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const embeddings = new OpenAIEmbeddings({
    modelName: modelConfig.modelName,
    apiKey: config.OPENAI_API_KEY,
  });

  // Cache only if no overrides
  if (!overrides) {
    modelCache.set(cacheKey, embeddings);
    logger.info(
      { model: modelConfig.modelName },
      'Embeddings model initialized'
    );
  }

  return embeddings;
}

/**
 * Get model configuration for a task
 *
 * @param task - Task type
 * @returns Model config
 */
export function getModelConfig(task: ModelTask): ModelConfig {
  return { ...MODEL_REGISTRY[task] };
}

/**
 * Update model registry (useful for testing or dynamic config)
 *
 * @param task - Task type
 * @param config - New model config
 */
export function setModelConfig(task: ModelTask, config: ModelConfig): void {
  MODEL_REGISTRY[task] = config;
  modelCache.delete(task); // Invalidate cache
  logger.info({ task, config }, 'Model config updated');
}

/**
 * Clear model cache (useful for testing)
 */
export function clearModelCache(): void {
  modelCache.clear();
  logger.info('Model cache cleared');
}

// =============================================================================
// Resilient Model Wrapper
// =============================================================================

/**
 * Wrap model invoke with circuit breaker and timeout protection
 *
 * This is applied internally by the agent nodes - models themselves
 * don't need to be aware of resilience patterns.
 *
 * @param model - Chat model to wrap
 * @param serviceName - Unique service identifier
 * @returns Protected invoke function
 */
export function wrapModelInvoke(model: BaseChatModel, serviceName: string) {
  const originalInvoke = model.invoke.bind(model);

  return async function invoke(
    ...args: Parameters<BaseChatModel['invoke']>
  ): ReturnType<BaseChatModel['invoke']> {
    const operation = `llm-invoke-${serviceName}`;

    // First apply circuit breaker
    const protectedCall = withCircuitBreaker(
      async () => {
        // Then apply timeout
        return withTimeout(
          originalInvoke(...args),
          getTimeout('LLM_INVOKE'),
          operation
        );
      },
      'llm',
      serviceName
    );

    return protectedCall();
  };
}

/**
 * Get a resilient model (same as getModel but with built-in resilience)
 *
 * NOTE: For LangGraph agents, resilience is better applied at the node level
 * rather than wrapping the model directly, as it preserves all model methods.
 *
 * This function returns the base model - apply resilience in agent nodes.
 *
 * @param task - Task type
 * @param overrides - Optional config overrides
 * @returns Chat model (apply resilience in usage)
 */
export function getResilientModel(
  task: Exclude<ModelTask, 'embedding'>,
  overrides?: Partial<ModelConfig>
): BaseChatModel {
  // Just return the base model - resilience is applied in agent nodes
  return getModel(task, overrides);
}
