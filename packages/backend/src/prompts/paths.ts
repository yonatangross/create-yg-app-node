/**
 * Template path constants
 * Avoid magic strings and enable type-safe template references
 */

export const TemplatePaths = {
  // Base templates
  BASE: '_base.njk',

  // Agent prompts
  CHAT_AGENT: 'agents/chat.njk',
  RAG_AGENT: 'agents/rag.njk',

  // Evaluator prompts
  EVALUATOR_RELEVANCE: 'evaluators/relevance.njk',
} as const;

export type TemplatePath = (typeof TemplatePaths)[keyof typeof TemplatePaths];
