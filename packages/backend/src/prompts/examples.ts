/**
 * Usage Examples for Prompt Template System
 * Demonstrates how to use templates with LangChain.js
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  renderChatAgent,
  renderRAGAgent,
  renderRelevanceEvaluator,
  type ChatAgentVariables,
  type RAGAgentVariables,
} from './index.js';
import { getLogger } from '../core/logger.js';

const logger = getLogger();

// =============================================================================
// Example 1: Chat Agent with LangChain
// =============================================================================

export async function chatAgentExample() {
  // Render system prompt with template
  const variables: ChatAgentVariables = {
    persona: 'senior TypeScript developer',
    context: 'User is building a REST API with Hono',
    constraints: [
      'Always use TypeScript',
      'Prefer functional patterns',
      'Include error handling',
      'Follow Node.js best practices',
    ],
    skill_level: 'intermediate',
    tools: ['web_search', 'code_interpreter'],
  };

  const systemPrompt = renderChatAgent(variables);

  // Create LangChain prompt template
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', '{input}'],
  ]);

  // Create model
  const model = new ChatOpenAI({
    modelName: 'gpt-4-turbo',
    temperature: 0,
  });

  // Create chain
  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  // Invoke
  const result = await chain.invoke({
    input: 'How do I implement rate limiting in Hono?',
  });

  logger.info({ result }, 'Chat agent example result');
}

// =============================================================================
// Example 2: RAG Agent with Source Documents
// =============================================================================

export async function ragAgentExample() {
  // Mock retrieval results
  const retrievedDocs = [
    {
      id: '1',
      title: 'LangChain Documentation - RAG',
      content:
        'Retrieval-Augmented Generation (RAG) combines information retrieval with text generation. It retrieves relevant documents and uses them to ground the LLM response.',
      score: 0.95,
    },
    {
      id: '2',
      title: 'LangChain Tutorial - Vector Stores',
      content:
        'Vector stores enable semantic search by converting documents to embeddings. Common options include Pinecone, Weaviate, and pgvector.',
      score: 0.87,
    },
    {
      id: '3',
      title: 'Best Practices - RAG Systems',
      content:
        'Always cite sources in RAG responses. Use confidence scoring to indicate uncertainty. Implement fallback responses when sources are insufficient.',
      score: 0.82,
    },
  ];

  // Render RAG prompt
  const variables: RAGAgentVariables = {
    query: 'What is RAG and how do I implement it?',
    context: 'User is learning about LangChain.js',
    sources: retrievedDocs,
    max_sources: 3,
    require_citations: true,
  };

  const systemPrompt = renderRAGAgent(variables);

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', 'Please answer the query using the provided sources.'],
  ]);

  const model = new ChatOpenAI({
    modelName: 'gpt-4-turbo',
    temperature: 0,
  });

  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  const result = await chain.invoke({});

  logger.info({ result }, 'RAG agent example result');
}

// =============================================================================
// Example 3: LLM-as-Judge Evaluation
// =============================================================================

export async function evaluatorExample() {
  const query = 'What is TypeScript?';
  const response =
    'TypeScript is a strongly typed superset of JavaScript that compiles to plain JavaScript. It adds optional static typing and other features.';

  const systemPrompt = renderRelevanceEvaluator({
    query,
    response,
    threshold: 4, // Pass/fail threshold
  });

  const prompt = ChatPromptTemplate.fromMessages([['system', systemPrompt]]);

  const model = new ChatOpenAI({
    modelName: 'gpt-4-turbo',
    temperature: 0,
  });

  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  const result = await chain.invoke({});

  // Parse JSON response
  const evaluation = JSON.parse(result);
  logger.info({ evaluation }, 'Evaluator example result');
  /*
  {
    score: 5,
    justification: "Response directly answers what TypeScript is with accurate, relevant information.",
    pass: true,
    strengths: ["Clear definition", "Mentions key features"],
    weaknesses: []
  }
  */
}

// =============================================================================
// Example 4: Dynamic Skill Level Adaptation
// =============================================================================

export async function skillAdaptationExample(
  userSkillLevel: 'beginner' | 'intermediate' | 'expert'
) {
  const variables: ChatAgentVariables = {
    persona: 'coding instructor',
    context: 'Teaching async/await in TypeScript',
    skill_level: userSkillLevel,
  };

  const systemPrompt = renderChatAgent(variables);

  // The prompt will automatically include appropriate guidance
  // for the user's skill level
  logger.info(
    { systemPrompt, userSkillLevel },
    'Skill adaptation example result'
  );
}

// =============================================================================
// Example 5: JSON Output Mode
// =============================================================================

export async function jsonOutputExample() {
  const variables: ChatAgentVariables = {
    persona: 'data extractor',
    context: 'Extract structured information from user message',
    output_format: 'json',
    constraints: [
      'Extract: title, description, tags, priority',
      'Use enums for priority: low/medium/high',
    ],
  };

  const systemPrompt = renderChatAgent(variables);

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', '{input}'],
  ]);

  const model = new ChatOpenAI({
    modelName: 'gpt-4-turbo',
    temperature: 0,
  });

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const result = await chain.invoke({
    input: 'Fix the login bug ASAP - users cannot authenticate',
  });

  const parsed = JSON.parse(result);
  logger.info({ parsed }, 'JSON output example result');
  /*
  {
    title: "Login Authentication Bug",
    description: "Users unable to authenticate during login",
    tags: ["bug", "authentication", "urgent"],
    priority: "high"
  }
  */
}

// =============================================================================
// Example 6: Streaming Responses
// =============================================================================

export async function streamingExample() {
  const systemPrompt = renderChatAgent({
    persona: 'helpful assistant',
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', '{input}'],
  ]);

  const model = new ChatOpenAI({
    modelName: 'gpt-4-turbo',
    temperature: 0,
  });

  const chain = prompt.pipe(model);

  // Stream response
  const stream = await chain.stream({
    input: 'Explain how promises work in JavaScript',
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.content as string);
  }
}
