/**
 * Prompt Template Loader Tests
 * Verify template rendering and type safety
 */

import { describe, it, expect } from 'vitest';
import {
  renderPrompt,
  renderChatAgent,
  renderRAGAgent,
  renderRelevanceEvaluator,
  validateVariables,
  TemplatePaths,
  type ChatAgentVariables,
  type RAGAgentVariables,
} from '../index.js';

describe('Prompt Template Loader', () => {
  describe('renderChatAgent', () => {
    it('should render basic chat agent prompt', () => {
      const variables: ChatAgentVariables = {
        persona: 'helpful assistant',
      };

      const result = renderChatAgent(variables);

      expect(result).toContain('You are helpful assistant');
      expect(result).toContain('RESPONSE GUIDELINES');
    });

    it('should include context when provided', () => {
      const variables: ChatAgentVariables = {
        persona: 'code reviewer',
        context: 'User is reviewing a TypeScript PR',
      };

      const result = renderChatAgent(variables);

      expect(result).toContain('CURRENT CONTEXT');
      expect(result).toContain('User is reviewing a TypeScript PR');
    });

    it('should include constraints', () => {
      const variables: ChatAgentVariables = {
        persona: 'technical writer',
        constraints: ['Be concise', 'Use examples', 'Avoid jargon'],
      };

      const result = renderChatAgent(variables);

      expect(result).toContain('CONSTRAINTS');
      expect(result).toContain('Be concise');
      expect(result).toContain('Use examples');
      expect(result).toContain('Avoid jargon');
    });

    it('should adapt to skill level', () => {
      const variables: ChatAgentVariables = {
        persona: 'educator',
        skill_level: 'beginner',
      };

      const result = renderChatAgent(variables);

      expect(result).toContain('ADAPTATION FOR BEGINNER');
      expect(result).toContain('Use simple language');
    });

    it('should include JSON output instructions', () => {
      const variables: ChatAgentVariables = {
        persona: 'data extractor',
        output_format: 'json',
      };

      const result = renderChatAgent(variables);

      expect(result).toContain('ONLY valid JSON');
      expect(result).toContain('exactly ONE structured response');
    });

    it('should list available tools', () => {
      const variables: ChatAgentVariables = {
        persona: 'assistant',
        tools: ['web_search', 'calculator', 'code_interpreter'],
      };

      const result = renderChatAgent(variables);

      expect(result).toContain('AVAILABLE TOOLS');
      expect(result).toContain('web_search');
      expect(result).toContain('calculator');
      expect(result).toContain('TOOL USAGE');
    });
  });

  describe('renderRAGAgent', () => {
    it('should render RAG agent prompt with sources', () => {
      const variables: RAGAgentVariables = {
        query: 'What is LangChain?',
        context: '',
        sources: [
          {
            id: '1',
            title: 'LangChain Documentation',
            content:
              'LangChain is a framework for developing applications powered by language models.',
            score: 0.95,
          },
          {
            id: '2',
            title: 'LangChain GitHub',
            content: 'LangChain provides components for working with LLMs.',
            score: 0.87,
          },
        ],
      };

      const result = renderRAGAgent(variables);

      expect(result).toContain('USER QUERY');
      expect(result).toContain('What is LangChain?');
      expect(result).toContain('SOURCE DOCUMENTS');
      expect(result).toContain('[1] LangChain Documentation');
      expect(result).toContain('[2] LangChain GitHub');
      expect(result).toContain('(Relevance: 95%)');
    });

    it('should enforce evidence-based extraction', () => {
      const variables: RAGAgentVariables = {
        query: 'Test query',
        context: '',
        sources: [
          {
            id: '1',
            title: 'Test Doc',
            content: 'Test content',
          },
        ],
      };

      const result = renderRAGAgent(variables);

      expect(result).toContain('EVIDENCE-BASED EXTRACTION');
      expect(result).toContain('Quote specific statements');
      expect(result).toContain('Never hallucinate');
    });

    it('should require citations', () => {
      const variables: RAGAgentVariables = {
        query: 'Test',
        context: '',
        sources: [{ id: '1', title: 'Doc', content: 'Content' }],
        require_citations: true,
      };

      const result = renderRAGAgent(variables);

      expect(result).toContain('SOURCE CITATION REQUIREMENTS');
      expect(result).toContain('Every claim must reference a source');
      expect(result).toContain('**Citations**: Full list');
    });

    it('should limit number of sources', () => {
      const variables: RAGAgentVariables = {
        query: 'Test',
        context: '',
        sources: [
          { id: '1', title: 'Doc 1', content: 'Content 1' },
          { id: '2', title: 'Doc 2', content: 'Content 2' },
          { id: '3', title: 'Doc 3', content: 'Content 3' },
          { id: '4', title: 'Doc 4', content: 'Content 4' },
        ],
        max_sources: 2,
      };

      const result = renderRAGAgent(variables);

      expect(result).toContain('[1] Doc 1');
      expect(result).toContain('[2] Doc 2');
      expect(result).not.toContain('[3] Doc 3');
      expect(result).not.toContain('[4] Doc 4');
    });
  });

  describe('renderRelevanceEvaluator', () => {
    it('should render evaluator prompt with scoring criteria', () => {
      const variables = {
        query: 'What is TypeScript?',
        response: 'TypeScript is a typed superset of JavaScript.',
      };

      const result = renderRelevanceEvaluator(variables);

      expect(result).toContain('USER QUERY');
      expect(result).toContain('What is TypeScript?');
      expect(result).toContain('AI RESPONSE');
      expect(result).toContain('TypeScript is a typed superset');
      expect(result).toContain('EVALUATION CRITERIA');
      expect(result).toContain('1-5 scale');
    });

    it('should require JSON output format', () => {
      const variables = {
        query: 'Test query',
        response: 'Test response',
      };

      const result = renderRelevanceEvaluator(variables);

      expect(result).toContain('REQUIRED OUTPUT FORMAT (JSON only)');
      expect(result).toContain('"score"');
      expect(result).toContain('"justification"');
      expect(result).toContain('"pass"');
      expect(result).toContain('"strengths"');
      expect(result).toContain('"weaknesses"');
    });

    it('should use custom threshold', () => {
      const variables = {
        query: 'Test',
        response: 'Response',
        threshold: 4,
      };

      const result = renderRelevanceEvaluator(variables);

      expect(result).toContain('score >= 4');
    });
  });

  describe('validateVariables', () => {
    it('should pass when all required variables are present', () => {
      const required = ['name', 'age'] as const;
      const provided = { name: 'John', age: 30 };

      expect(() => validateVariables(required, provided)).not.toThrow();
    });

    it('should throw when required variables are missing', () => {
      const required: ('name' | 'age')[] = ['name', 'age'];
      const provided = { name: 'John' };

      expect(() =>
        validateVariables(required, provided as Record<string, unknown>)
      ).toThrow('Missing required template variables: age');
    });

    it('should list all missing variables', () => {
      const required: ('name' | 'age' | 'email')[] = ['name', 'age', 'email'];
      const provided = { name: 'John' };

      expect(() =>
        validateVariables(required, provided as Record<string, unknown>)
      ).toThrow('Missing required template variables: age, email');
    });
  });

  describe('renderPrompt', () => {
    it('should render template with variables', () => {
      const result = renderPrompt(TemplatePaths.CHAT_AGENT, {
        persona: 'test assistant',
      });

      expect(result).toContain('You are test assistant');
    });

    it('should throw on missing template', () => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderPrompt('nonexistent/template.njk' as any, {})
      ).toThrow();
    });

    it('should throw on undefined variables with throwOnUndefined', () => {
      expect(() =>
        renderPrompt(TemplatePaths.CHAT_AGENT, {
          // Missing required 'persona'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      ).toThrow();
    });
  });
});
