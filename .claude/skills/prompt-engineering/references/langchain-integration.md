# LangChain.js Integration

Using Nunjucks templates with LangChain.js for production prompt management.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Prompt Pipeline                           │
├─────────────────────────────────────────────────────────────┤
│  .njk Template  →  Nunjucks Render  →  LangChain Prompt     │
│      ↓                   ↓                    ↓              │
│  File on disk     String with vars      ChatPromptTemplate  │
└─────────────────────────────────────────────────────────────┘
```

## Basic Integration

```typescript
import nunjucks from 'nunjucks';
import { ChatPromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { renderPrompt } from '@/prompts';

// 1. Render Nunjucks template to string
const systemContent = renderPrompt('agents/chat-agent.njk', {
  persona: 'code reviewer',
  context: previousConversation,
});

// 2. Create LangChain prompt
const prompt = ChatPromptTemplate.fromMessages([
  ['system', systemContent],
  ['human', '{input}'],  // LangChain variable
]);

// 3. Use in chain
const chain = prompt.pipe(model).pipe(outputParser);
const result = await chain.invoke({ input: userMessage });
```

## Hybrid Templates

Combine Nunjucks (static parts) with LangChain (runtime parts):

```njk
{# agents/hybrid-agent.njk #}
You are a {{ persona }}.

{% if context %}
CONTEXT:
{{ context }}
{% endif %}

{# This will be a LangChain variable at runtime #}
User query: {input}

{# Use double braces to escape for LangChain #}
Previous messages: {chat_history}
```

```typescript
// Render static parts with Nunjucks
const staticPrompt = renderPrompt('agents/hybrid-agent.njk', {
  persona: 'helpful assistant',
  context: ragContext,
});

// Pass to LangChain with runtime variables
const prompt = ChatPromptTemplate.fromMessages([
  ['system', staticPrompt],
  ['placeholder', '{chat_history}'],
  ['human', '{input}'],
]);
```

## With LangGraph Agents

```typescript
import { Annotation, StateGraph } from '@langchain/langgraph';
import { renderPrompt, TemplatePaths } from '@/prompts';

// Define state
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  context: Annotation<string>({ default: () => '' }),
});

// Agent node with templated prompt
async function agentNode(state: typeof AgentState.State) {
  // Render prompt with current context
  const systemPrompt = renderPrompt(TemplatePaths.AGENT_RAG, {
    context: state.context,
    memory_summary: await getMemorySummary(),
  });

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ]);

  return { messages: [response] };
}
```

## Structured Output with Zod

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { renderPrompt } from '@/prompts';

// Define output schema
const AnalysisSchema = z.object({
  insights: z.array(z.object({
    title: z.string(),
    description: z.string(),
    importance: z.enum(['high', 'medium', 'low']),
  })),
  confidence: z.number().min(0).max(1),
});

// Convert to JSON schema for template
const jsonSchema = zodToJsonSchema(AnalysisSchema);

// Render with schema
const prompt = renderPrompt('agents/analysis-agent.njk', {
  output_schema: JSON.stringify(jsonSchema, null, 2),
  content: documentContent,
});

// Parse response
const result = AnalysisSchema.parse(JSON.parse(response));
```

## Template for Structured Output

```njk
{# agents/analysis-agent.njk #}
You are an Analysis Specialist.

CONTENT TO ANALYZE:
{{ content }}

REQUIRED OUTPUT FORMAT:
Return a valid JSON object matching this schema:

{{ output_schema }}

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanation
2. ALL fields are required
3. Use exact field names from schema
4. Confidence must be between 0.0 and 1.0
```

## Caching Rendered Prompts

```typescript
import { LRUCache } from 'lru-cache';

const promptCache = new LRUCache<string, string>({
  max: 100,
  ttl: 1000 * 60 * 60, // 1 hour
});

function renderPromptCached(
  templatePath: string,
  variables: Record<string, unknown>
): string {
  const cacheKey = `${templatePath}:${JSON.stringify(variables)}`;

  const cached = promptCache.get(cacheKey);
  if (cached) return cached;

  const rendered = renderPrompt(templatePath, variables);
  promptCache.set(cacheKey, rendered);

  return rendered;
}
```

## Testing Prompts

```typescript
import { describe, it, expect } from 'vitest';
import { renderPrompt } from '@/prompts';

describe('Chat Agent Prompt', () => {
  it('includes persona in system prompt', () => {
    const prompt = renderPrompt('agents/chat-agent.njk', {
      persona: 'code reviewer',
      constraints: [],
    });

    expect(prompt).toContain('code reviewer');
  });

  it('includes all constraints', () => {
    const constraints = ['Be concise', 'Use examples'];
    const prompt = renderPrompt('agents/chat-agent.njk', {
      persona: 'assistant',
      constraints,
    });

    constraints.forEach(c => {
      expect(prompt).toContain(c);
    });
  });

  it('handles missing optional context', () => {
    const prompt = renderPrompt('agents/chat-agent.njk', {
      persona: 'assistant',
      constraints: [],
      // context is optional
    });

    expect(prompt).not.toContain('undefined');
  });
});
```

## Best Practices

1. **Separate static and dynamic** - Use Nunjucks for build-time, LangChain for runtime
2. **Type your variables** - Create interfaces for template variables
3. **Validate output** - Always use Zod to parse LLM responses
4. **Cache when possible** - Same variables = same prompt
5. **Test prompts** - Unit test rendered output
6. **Version prompts** - Track changes in git
