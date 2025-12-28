/**
 * Nunjucks Template Loader for Prompt Management
 * Jinja2-compatible templates for LangChain.js
 */

import nunjucks from 'nunjucks';
import { join } from 'path';
import { existsSync } from 'fs';
import pino from 'pino';

const logger = pino({ name: 'prompt-loader' });

// =============================================================================
// Configuration
// =============================================================================

const TEMPLATES_DIR = join(__dirname, 'templates');

// Singleton environment
let env: nunjucks.Environment | null = null;

function getEnv(): nunjucks.Environment {
  if (!env) {
    env = nunjucks.configure(TEMPLATES_DIR, {
      autoescape: false, // Don't escape - prompts, not HTML
      trimBlocks: true, // Remove first newline after block tag
      lstripBlocks: true, // Strip leading whitespace from block tags
      noCache: process.env.NODE_ENV === 'development',
      throwOnUndefined: true, // Catch missing variables
    });

    // Add custom filters
    env.addFilter('dump', (obj) => JSON.stringify(obj, null, 2));
    env.addFilter('oneline', (str: string) => str.replace(/\n/g, ' ').trim());

    logger.info({ templatesDir: TEMPLATES_DIR }, 'Nunjucks environment initialized');
  }

  return env;
}

// =============================================================================
// Template Paths (Constants to avoid magic strings)
// =============================================================================

export const TemplatePaths = {
  // Base templates
  BASE: '_base.njk',
  MACROS: '_macros.njk',
  OUTPUT_SCHEMAS: '_output-schemas.njk',

  // Agent prompts
  AGENT_CHAT: 'agents/chat-agent.njk',
  AGENT_RAG: 'agents/rag-agent.njk',
  AGENT_CODE_REVIEW: 'agents/code-review.njk',
  AGENT_ANALYSIS: 'agents/analysis.njk',

  // Chain prompts
  CHAIN_SUMMARIZE: 'chains/summarize.njk',
  CHAIN_EXTRACT: 'chains/extract.njk',
  CHAIN_TRANSLATE: 'chains/translate.njk',

  // Evaluator prompts
  EVAL_RELEVANCE: 'evaluators/relevance.njk',
  EVAL_ACCURACY: 'evaluators/accuracy.njk',
  EVAL_COHERENCE: 'evaluators/coherence.njk',

  // System prompts
  SYSTEM_DEFAULT: 'system/default.njk',
  SYSTEM_TECHNICAL: 'system/technical.njk',
} as const;

export type TemplatePath = (typeof TemplatePaths)[keyof typeof TemplatePaths];

// =============================================================================
// Render Functions
// =============================================================================

/**
 * Render a Nunjucks template with variables.
 *
 * @param templatePath - Path relative to templates/ directory
 * @param variables - Variables to pass to template
 * @returns Rendered template string
 *
 * @example
 * const prompt = renderPrompt(TemplatePaths.AGENT_CHAT, {
 *   persona: 'code reviewer',
 *   context: 'User is reviewing a PR',
 *   constraints: ['Be specific', 'Cite line numbers'],
 * });
 */
export function renderPrompt<T extends Record<string, unknown>>(
  templatePath: TemplatePath | string,
  variables: T
): string {
  const env = getEnv();

  try {
    const rendered = env.render(templatePath, variables);

    logger.debug(
      {
        template: templatePath,
        variableCount: Object.keys(variables).length,
      },
      'Template rendered'
    );

    return rendered;
  } catch (error) {
    logger.error(
      {
        template: templatePath,
        error: error instanceof Error ? error.message : 'Unknown error',
        variables: Object.keys(variables),
      },
      'Template render failed'
    );
    throw error;
  }
}

/**
 * Get raw template content without rendering.
 * Useful for templates without variables.
 */
export function getTemplateRaw(templatePath: TemplatePath | string): string {
  const env = getEnv();
  const template = env.getTemplate(templatePath);
  return template.tmplStr || '';
}

/**
 * List all templates in a subdirectory.
 */
export function listTemplates(subdir = ''): string[] {
  const env = getEnv();
  const loader = env.loaders[0] as nunjucks.FileSystemLoader;

  // Get all template names
  const searchPath = join(TEMPLATES_DIR, subdir);
  if (!existsSync(searchPath)) {
    return [];
  }

  // Note: This is a simplified version. In production,
  // you'd use fs.readdirSync with recursion
  return [];
}

/**
 * Validate that all required variables are present.
 */
export function validateVariables<T extends Record<string, unknown>>(
  required: (keyof T)[],
  provided: T
): void {
  const missing = required.filter((key) => !(key in provided));

  if (missing.length > 0) {
    throw new Error(
      `Missing required template variables: ${missing.join(', ')}`
    );
  }
}

// =============================================================================
// Type-Safe Template Interfaces
// =============================================================================

export interface ChatAgentVariables {
  persona: string;
  context?: string;
  constraints: string[];
  skill_level?: 'beginner' | 'intermediate' | 'expert';
  output_format?: string;
}

export interface RAGAgentVariables {
  context: string;
  sources: Array<{ title: string; content: string }>;
  query: string;
  max_tokens?: number;
}

export interface CodeReviewVariables {
  code: string;
  language: string;
  focus_areas: string[];
  severity_levels: boolean;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Render chat agent prompt with type safety.
 */
export function renderChatAgent(variables: ChatAgentVariables): string {
  return renderPrompt(TemplatePaths.AGENT_CHAT, variables);
}

/**
 * Render RAG agent prompt with type safety.
 */
export function renderRAGAgent(variables: RAGAgentVariables): string {
  return renderPrompt(TemplatePaths.AGENT_RAG, variables);
}

// =============================================================================
// Usage Example
// =============================================================================

/*
import { renderPrompt, TemplatePaths, ChatAgentVariables } from '@/prompts';

const variables: ChatAgentVariables = {
  persona: 'senior TypeScript developer',
  context: 'User is building a REST API with Hono',
  constraints: [
    'Always use TypeScript',
    'Prefer functional patterns',
    'Include error handling',
  ],
  skill_level: 'intermediate',
};

const systemPrompt = renderPrompt(TemplatePaths.AGENT_CHAT, variables);

// Use with LangChain
const prompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  ['human', '{input}'],
]);

const chain = prompt.pipe(model);
*/
