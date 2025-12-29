/**
 * Prompt Template System
 * Re-exports for convenient imports
 */

export { TemplatePaths } from './paths.js';
export type { TemplatePath } from './paths.js';

export {
  renderPrompt,
  getTemplateRaw,
  validateVariables,
  renderChatAgent,
  renderRAGAgent,
  renderRelevanceEvaluator,
} from './loader.js';

export type {
  ChatAgentVariables,
  RAGAgentVariables,
  RelevanceEvaluatorVariables,
} from './loader.js';
