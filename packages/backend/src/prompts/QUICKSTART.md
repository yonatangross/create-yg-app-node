# Prompt Template System - Quick Start

Get started with the Nunjucks prompt template system in 5 minutes.

## 1. Run the Demo

```bash
cd packages/backend
pnpm exec tsx src/prompts/demo.ts
```

You'll see 4 rendered prompts:
- Chat agent (beginner level)
- Chat agent with tools + JSON output
- RAG agent with citations
- Relevance evaluator

## 2. Basic Usage

```typescript
import { renderChatAgent } from '@/prompts';

const systemPrompt = renderChatAgent({
  persona: 'helpful coding assistant',
});

// Use with LangChain
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';

const prompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  ['human', '{input}'],
]);

const model = new ChatOpenAI({ modelName: 'gpt-4-turbo' });
const chain = prompt.pipe(model);

const response = await chain.invoke({
  input: 'How do I use async/await?',
});
```

## 3. Common Patterns

### Pattern 1: Chat with Context

```typescript
import { renderChatAgent } from '@/prompts';

const prompt = renderChatAgent({
  persona: 'code reviewer',
  context: 'User submitted PR #123 for review',
  constraints: [
    'Focus on security issues',
    'Check for proper error handling',
    'Verify tests exist',
  ],
  skill_level: 'intermediate',
});
```

### Pattern 2: RAG with Citations

```typescript
import { renderRAGAgent } from '@/prompts';

// 1. Retrieve documents
const docs = await vectorStore.similaritySearch(query, 5);

// 2. Format for template
const sources = docs.map((doc, idx) => ({
  id: `${idx + 1}`,
  title: doc.metadata.title,
  content: doc.pageContent,
  score: doc.metadata.score,
}));

// 3. Render prompt
const prompt = renderRAGAgent({
  query: 'What is LangChain?',
  context: 'User is learning about AI frameworks',
  sources,
  require_citations: true,
});
```

### Pattern 3: LLM-as-Judge Evaluation

```typescript
import { renderRelevanceEvaluator } from '@/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';

const evaluatorPrompt = renderRelevanceEvaluator({
  query: 'What is TypeScript?',
  response: 'TypeScript is a typed superset of JavaScript.',
  threshold: 4, // Minimum score to pass
});

const prompt = ChatPromptTemplate.fromMessages([
  ['system', evaluatorPrompt],
]);

const chain = prompt
  .pipe(model)
  .pipe(new JsonOutputParser());

const evaluation = await chain.invoke({});

console.log(evaluation);
// {
//   score: 5,
//   justification: "Direct and accurate answer",
//   pass: true,
//   strengths: ["Clear definition", "Concise"],
//   weaknesses: []
// }
```

### Pattern 4: JSON Output

```typescript
import { renderChatAgent } from '@/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';

const prompt = renderChatAgent({
  persona: 'data extractor',
  output_format: 'json',
  constraints: [
    'Extract: title, priority, tags',
    'Priority: low | medium | high',
  ],
});

const chain = ChatPromptTemplate.fromMessages([
  ['system', prompt],
  ['human', '{input}'],
])
  .pipe(model)
  .pipe(new JsonOutputParser());

const result = await chain.invoke({
  input: 'Fix the critical login bug ASAP!',
});

console.log(result);
// {
//   title: "Login Bug",
//   priority: "high",
//   tags: ["bug", "login", "critical"]
// }
```

### Pattern 5: Streaming Responses

```typescript
import { renderChatAgent } from '@/prompts';

const systemPrompt = renderChatAgent({
  persona: 'helpful assistant',
});

const prompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  ['human', '{input}'],
]);

const chain = prompt.pipe(model);

// Stream tokens
const stream = await chain.stream({
  input: 'Explain promises in JavaScript',
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content as string);
}
```

## 4. Create Your Own Template

### Step 1: Create Template File

Create `templates/agents/my-agent.njk`:

```nunjucks
{% extends "_base.njk" %}

{% block system_intro %}
You are {{ role }}.
Your goal is to {{ goal }}.
{% endblock %}

{% block constraints %}
{{ constraints_block(constraints) }}
{% endblock %}

{% block final_instructions %}
Always {{ instruction }}.
{% endblock %}
```

### Step 2: Add Path Constant

In `paths.ts`:

```typescript
export const TemplatePaths = {
  // ... existing
  MY_AGENT: 'agents/my-agent.njk',
} as const;
```

### Step 3: Create Type-Safe Interface

In `loader.ts`:

```typescript
export interface MyAgentVariables extends Record<string, unknown> {
  role: string;
  goal: string;
  constraints?: string[];
  instruction: string;
}

export function renderMyAgent(variables: MyAgentVariables): string {
  validateVariables(['role', 'goal', 'instruction'], variables);
  return renderPrompt(TemplatePaths.MY_AGENT, variables);
}
```

### Step 4: Export

In `index.ts`:

```typescript
export { renderMyAgent } from './loader.js';
export type { MyAgentVariables } from './loader.js';
```

### Step 5: Use It

```typescript
import { renderMyAgent } from '@/prompts';

const prompt = renderMyAgent({
  role: 'task planner',
  goal: 'break down complex tasks',
  constraints: ['Use bullet points', 'Include time estimates'],
  instruction: 'be specific and actionable',
});
```

## 5. Run Tests

```bash
# Run all prompt tests
pnpm test src/prompts/__tests__/loader.test.ts

# Watch mode
pnpm test src/prompts/__tests__/loader.test.ts --watch

# Coverage
pnpm test:coverage src/prompts/__tests__/loader.test.ts
```

## 6. Debugging

### Enable Debug Logging

```typescript
// Set log level to debug
import pino from 'pino';

const logger = pino({
  level: 'debug', // Show template render details
});
```

### View Rendered Template

```typescript
import { renderChatAgent } from '@/prompts';

const prompt = renderChatAgent({
  persona: 'assistant',
});

console.log(prompt); // See exactly what's sent to LLM
```

### Check Template Syntax

```bash
# Render will throw on syntax errors
pnpm exec tsx -e "
  import { renderPrompt } from './src/prompts/index.js';
  console.log(renderPrompt('agents/chat.njk', { persona: 'test' }));
"
```

## 7. Production Checklist

- [ ] Set `NODE_ENV=production` for template caching
- [ ] Monitor template render times with Pino logs
- [ ] Track token usage per template with Langfuse
- [ ] Version control all template changes
- [ ] Test prompts with real LLM calls before deploying

## 8. Common Issues

### Issue: Template Not Found

```
Error: template not found: agents/my-agent.njk
```

**Solution**: Check file exists in `templates/` directory and path is correct.

### Issue: Undefined Variable

```
Error: attempted to output null or undefined value
```

**Solution**: Ensure all required variables are provided:

```typescript
// Bad
renderChatAgent({});

// Good
renderChatAgent({ persona: 'assistant' });
```

### Issue: TypeScript Error

```
Argument of type '{ persona: string }' is not assignable...
```

**Solution**: Install types and check interface:

```bash
pnpm add -D @types/nunjucks
```

## 9. Next Steps

- Read [README.md](./README.md) for full documentation
- Check [examples.ts](./examples.ts) for more patterns
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Browse [templates/](./templates/) for template examples

## 10. Resources

- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [LangChain.js Docs](https://js.langchain.com/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

---

**Ready to build?** Start with the demo, then copy a pattern from examples.ts!
