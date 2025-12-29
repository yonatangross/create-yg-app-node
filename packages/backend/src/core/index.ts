/**
 * Core infrastructure - Configuration, logging, and resilience
 *
 * Usage:
 * ```typescript
 * import { getConfig, getLogger, withContext, getResilienceManager } from '@/core';
 *
 * const config = getConfig();
 * const logger = getLogger();
 *
 * await withContext({ requestId: 'abc123' }, async () => {
 *   const logger = getLogger();
 *   logger.info('This log includes requestId');
 * });
 *
 * const manager = getResilienceManager('external-api');
 * const result = await manager.execute(() => apiCall());
 * ```
 */

// Configuration
export {
  getConfig,
  isTest,
  isProduction,
  isDevelopment,
  resetConfig,
  type Config,
} from './config.js';

// Logging
export {
  getLogger,
  withContext,
  getContext,
  createChildLogger,
  logger,
  type Logger,
  type LogContext,
} from './logger.js';

// Resilience
export * from './resilience/index.js';

// AI/LLM - Langfuse
export {
  createLangfuseHandler,
  scoreTrace,
  shutdownLangfuse,
  getLangfuse,
  isLangfuseEnabled,
} from './langfuse.js';

// AI/LLM - Models
export {
  getModel,
  getEmbeddings,
  getModelConfig,
  setModelConfig,
  clearModelCache,
  type ModelTask,
} from './models.js';
