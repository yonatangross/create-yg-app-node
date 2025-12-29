/**
 * Nunjucks Template Loader for Prompt Management
 * Type-safe template rendering with caching and error handling
 */

import * as nunjucks from 'nunjucks';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import type { TemplatePath } from './paths.js';

const logger = pino({ name: 'prompt-loader' });

// =============================================================================
// Configuration
// =============================================================================

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = join(__dirname, 'templates');

// Singleton environment
let env: nunjucks.Environment | null = null;

/**
 * Initialize and configure Nunjucks environment
 * Creates singleton instance with production-optimized settings
 */
function getEnv(): nunjucks.Environment {
  if (!env) {
    env = nunjucks.configure(TEMPLATES_DIR, {
      autoescape: false, // Don't escape - prompts, not HTML
      trimBlocks: true, // Remove first newline after block tag
      lstripBlocks: true, // Strip leading whitespace from block tags
      noCache: process.env.NODE_ENV === 'development', // Cache in production
      throwOnUndefined: true, // Catch missing variables early
    });

    // Add custom filters for prompt engineering
    env.addFilter('dump', (obj) => JSON.stringify(obj, null, 2));
    env.addFilter('oneline', (str: string) => str.replace(/\n/g, ' ').trim());
    env.addFilter('quote', (str: string) => `"${str}"`);

    logger.info({ templatesDir: TEMPLATES_DIR }, 'Nunjucks environment initialized');
  }

  return env;
}

// =============================================================================
// Core Render Functions
// =============================================================================

/**
 * Render a Nunjucks template with type-safe variables
 *
 * @param templatePath - Path relative to templates/ directory
 * @param variables - Variables to pass to template
 * @returns Rendered template string
 *
 * @example
 * ```typescript
 * const prompt = renderPrompt(TemplatePaths.CHAT_AGENT, {
 *   persona: 'helpful assistant',
 *   context: userContext,
 *   constraints: ['Be concise', 'Use examples'],
 * });
 * ```
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
        renderedLength: rendered.length,
      },
      'Template rendered successfully'
    );

    return rendered.trim(); // Remove trailing whitespace
  } catch (error) {
    logger.error(
      {
        template: templatePath,
        error: error instanceof Error ? error.message : 'Unknown error',
        variables: Object.keys(variables),
      },
      'Template render failed'
    );

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Failed to render template ${templatePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get raw template content without rendering
 * Useful for templates without variables or inspection
 */
export function getTemplateRaw(templatePath: TemplatePath | string): string {
  const env = getEnv();

  try {
    const template = env.getTemplate(templatePath);
    // Access internal template source (not in types but exists at runtime)
    return (template as unknown as { tmplStr?: string }).tmplStr || '';
  } catch (error) {
    logger.error({ template: templatePath, error }, 'Failed to get raw template');
    throw error;
  }
}

/**
 * Validate that all required variables are present
 * Call before rendering to ensure type safety at runtime
 */
export function validateVariables<T extends Record<string, unknown>>(
  required: readonly (keyof T)[] | (keyof T)[],
  provided: T
): void {
  const missing = required.filter((key) => !(key in provided));

  if (missing.length > 0) {
    throw new Error(`Missing required template variables: ${missing.join(', ')}`);
  }
}

// =============================================================================
// Type-Safe Variable Interfaces
// =============================================================================

export interface ChatAgentVariables extends Record<string, unknown> {
  persona: string;
  context?: string;
  constraints?: string[];
  skill_level?: 'beginner' | 'intermediate' | 'expert';
  output_format?: 'text' | 'json';
  tools?: string[];
}

export interface RAGAgentVariables extends Record<string, unknown> {
  query: string;
  context: string;
  sources: Array<{ id: string; title: string; content: string; score?: number }>;
  max_sources?: number;
  require_citations?: boolean;
}

export interface RelevanceEvaluatorVariables extends Record<string, unknown> {
  query: string;
  response: string;
  context?: string;
  threshold?: number;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Render chat agent prompt with type safety
 */
export function renderChatAgent(variables: ChatAgentVariables): string {
  validateVariables(['persona'], variables);
  return renderPrompt('agents/chat.njk', variables);
}

/**
 * Render RAG agent prompt with type safety
 */
export function renderRAGAgent(variables: RAGAgentVariables): string {
  validateVariables(['query', 'context', 'sources'], variables);
  return renderPrompt('agents/rag.njk', variables);
}

/**
 * Render relevance evaluator prompt with type safety
 */
export function renderRelevanceEvaluator(variables: RelevanceEvaluatorVariables): string {
  validateVariables(['query', 'response'], variables);
  return renderPrompt('evaluators/relevance.njk', variables);
}
