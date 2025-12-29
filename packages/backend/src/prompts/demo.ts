/**
 * Simple Demo Script
 * Run with: tsx src/prompts/demo.ts
 */

import {
  renderChatAgent,
  renderRAGAgent,
  renderRelevanceEvaluator,
  type ChatAgentVariables,
  type RAGAgentVariables,
} from './index.js';
import { getLogger } from '../core/logger.js';

const logger = getLogger();

logger.info('='.repeat(80));
logger.info('PROMPT TEMPLATE SYSTEM DEMO');
logger.info('='.repeat(80));

// Demo 1: Basic Chat Agent
logger.info('Demo 1: Chat Agent (Beginner Level)');
const chatVariables: ChatAgentVariables = {
  persona: 'friendly coding mentor',
  context: 'User is learning TypeScript for the first time',
  constraints: [
    'Use simple language',
    'Provide step-by-step examples',
    'Encourage practice',
  ],
  skill_level: 'beginner',
};

const chatPrompt = renderChatAgent(chatVariables);
logger.info({ chatPrompt }, 'Demo 1 result');

// Demo 2: Chat Agent with Tools
logger.info('='.repeat(80));
logger.info('Demo 2: Chat Agent with Tools');
const chatWithToolsVariables: ChatAgentVariables = {
  persona: 'technical assistant',
  tools: ['web_search', 'code_interpreter', 'file_reader'],
  output_format: 'json',
};

const chatWithToolsPrompt = renderChatAgent(chatWithToolsVariables);
logger.info({ chatWithToolsPrompt }, 'Demo 2 result');

// Demo 3: RAG Agent
logger.info('='.repeat(80));
logger.info('Demo 3: RAG Agent with Citations');
const ragVariables: RAGAgentVariables = {
  query: 'What is the difference between LangChain and LlamaIndex?',
  context: 'User is choosing between RAG frameworks',
  sources: [
    {
      id: '1',
      title: 'LangChain Documentation',
      content:
        'LangChain is a framework for developing applications powered by language models. It provides modular components for chains, agents, and retrieval.',
      score: 0.95,
    },
    {
      id: '2',
      title: 'LlamaIndex Guide',
      content:
        'LlamaIndex (formerly GPT Index) is a data framework for LLM applications. It specializes in ingestion, indexing, and querying of private data.',
      score: 0.89,
    },
    {
      id: '3',
      title: 'Framework Comparison',
      content:
        'LangChain focuses on agent workflows and chains. LlamaIndex excels at data indexing and retrieval. Many projects use both frameworks together.',
      score: 0.87,
    },
  ],
  max_sources: 3,
  require_citations: true,
};

const ragPrompt = renderRAGAgent(ragVariables);
logger.info({ ragPrompt }, 'Demo 3 result');

// Demo 4: Evaluator
logger.info('='.repeat(80));
logger.info('Demo 4: Relevance Evaluator');
const evaluatorPrompt = renderRelevanceEvaluator({
  query: 'How do I install TypeScript?',
  response: 'You can install TypeScript using npm: npm install -g typescript',
  threshold: 4,
});

logger.info({ evaluatorPrompt }, 'Demo 4 result');

logger.info('='.repeat(80));
logger.info('Demo Complete!');
logger.info('='.repeat(80));
