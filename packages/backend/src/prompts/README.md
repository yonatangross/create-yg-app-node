# Prompt Template System

Production-ready prompt management using Nunjucks templates for LangChain.js applications.

## Why Templates?

1. **Separation of Concerns** - Prompts live separately from code
2. **Version Control Friendly** - Clean diffs when prompts change
3. **Template Inheritance** - DRY prompt engineering with base templates
4. **Non-Developer Friendly** - Easier editing by prompt engineers
5. **Testability** - Test prompts independently from application logic

## Directory Structure

```
prompts/
├── templates/
│   ├── _base.njk              # Base template with shared macros
│   ├── agents/
│   │   ├── chat.njk           # Chat agent prompt
│   │   └── rag.njk            # RAG agent prompt
│   └── evaluators/
│       └── relevance.njk      # LLM-as-judge evaluator
├── loader.ts                  # Template loader with type safety
├── paths.ts                   # Template path constants
├── examples.ts                # Usage examples
├── index.ts                   # Re-exports
└── __tests__/
    └── loader.test.ts         # Unit tests
```

## Quick Start

```typescript
import { renderChatAgent } from '@/prompts';

const systemPrompt = renderChatAgent({
  persona: 'helpful assistant',
  context: 'User is learning TypeScript',
  constraints: ['Be concise', 'Use examples'],
  skill_level: 'beginner',
});
```

## Template Reference

### Chat Agent (`agents/chat.njk`)

**Variables:**
- `persona` (required): Role description (e.g., "senior developer")
- `context` (optional): Current context or situation
- `constraints` (optional): Array of constraints/guidelines
- `skill_level` (optional): `'beginner' | 'intermediate' | 'expert'`
- `output_format` (optional): `'text' | 'json'`
- `tools` (optional): Array of available tool names

**Example:**
```typescript
const prompt = renderChatAgent({
  persona: 'code reviewer',
  context: 'Reviewing a TypeScript PR',
  constraints: [
    'Focus on type safety',
    'Check error handling',
    'Verify tests exist',
  ],
  skill_level: 'intermediate',
  tools: ['code_search', 'git_diff'],
});
```

### RAG Agent (`agents/rag.njk`)

**Variables:**
- `query` (required): User's question
- `context` (required): Additional context
- `sources` (required): Array of retrieved documents
  - `id`: Source identifier
  - `title`: Document title
  - `content`: Document content
  - `score` (optional): Relevance score (0-1)
- `max_sources` (optional): Maximum sources to include (default: 5)
- `require_citations` (optional): Show citation instructions

**Example:**
```typescript
const prompt = renderRAGAgent({
  query: 'How do I use pgvector with Drizzle?',
  context: 'User is building a RAG application',
  sources: [
    {
      id: '1',
      title: 'Drizzle pgvector Guide',
      content: 'To use pgvector with Drizzle...',
      score: 0.95,
    },
  ],
  max_sources: 3,
  require_citations: true,
});
```

### Relevance Evaluator (`evaluators/relevance.njk`)

**Variables:**
- `query` (required): Original user query
- `response` (required): AI-generated response to evaluate
- `context` (optional): Additional context
- `threshold` (optional): Pass/fail threshold (default: 3)

**Output Format:**
```json
{
  "score": 4,
  "justification": "Response directly answers the query...",
  "pass": true,
  "strengths": ["Clear explanation", "Good examples"],
  "weaknesses": ["Could include more details"]
}
```

**Example:**
```typescript
const prompt = renderRelevanceEvaluator({
  query: 'What is TypeScript?',
  response: 'TypeScript is a typed superset of JavaScript.',
  threshold: 4,
});
```

## Base Template Macros

Available in `_base.njk` and can be used in child templates:

### `output_schema(schema, requirements)`
Documents required output structure with JSON schema.

### `constraints_block(constraints)`
Renders a list of constraints.

### `few_shot_examples(examples)`
Renders few-shot learning examples.

### `skill_adaptation(level)`
Adapts instructions based on user skill level.

### `context_block(context, label)`
Renders context section with custom label.

### `evidence_based()`
Adds evidence-based extraction instructions.

### `json_only()`
Enforces JSON-only output format.

### `single_response()`
Instructs LLM to return exactly one response.

## LangChain Integration

### Basic Chain

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { renderChatAgent } from '@/prompts';

const systemPrompt = renderChatAgent({
  persona: 'assistant',
});

const prompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  ['human', '{input}'],
]);

const model = new ChatOpenAI({ modelName: 'gpt-4-turbo' });
const chain = prompt.pipe(model);

const result = await chain.invoke({ input: 'Hello!' });
```

### With Output Parser

```typescript
import { StringOutputParser } from '@langchain/core/output_parsers';

const chain = prompt
  .pipe(model)
  .pipe(new StringOutputParser());

const result = await chain.invoke({ input: 'Hello!' });
// result is string
```

### With JSON Output

```typescript
import { JsonOutputParser } from '@langchain/core/output_parsers';

const systemPrompt = renderChatAgent({
  persona: 'data extractor',
  output_format: 'json',
});

const chain = prompt
  .pipe(model)
  .pipe(new JsonOutputParser());

const result = await chain.invoke({ input: 'Extract data...' });
// result is object
```

### Streaming

```typescript
const stream = await chain.stream({ input: 'Explain...' });

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

## Testing

Run the test suite:

```bash
pnpm test src/prompts/__tests__/loader.test.ts
```

Test coverage includes:
- Template rendering with various combinations
- Variable validation
- Error handling
- Macro functionality
- Type safety

## Production Considerations

### 1. Template Caching

Templates are cached in production (`NODE_ENV=production`) for performance:

```typescript
// In loader.ts
noCache: process.env.NODE_ENV === 'development'
```

### 2. Error Handling

All rendering errors are caught and logged:

```typescript
try {
  const prompt = renderChatAgent(variables);
} catch (error) {
  logger.error({ error }, 'Template render failed');
  // Fallback or retry logic
}
```

### 3. Monitoring

Template usage is logged with structured logging:

```json
{
  "level": 30,
  "template": "agents/chat.njk",
  "variableCount": 4,
  "renderedLength": 1250,
  "msg": "Template rendered successfully"
}
```

### 4. Variable Validation

Use `validateVariables` to ensure type safety at runtime:

```typescript
import { validateVariables } from '@/prompts';

validateVariables(['persona', 'context'], variables);
// Throws if required variables are missing
```

## Extending Templates

### Create New Template

1. Create template file in `templates/` directory:

```nunjucks
{% extends "_base.njk" %}

{% block system_intro %}
You are {{ role }}.
{% endblock %}

{% block constraints %}
{{ constraints_block(constraints) }}
{% endblock %}
```

2. Add path constant in `paths.ts`:

```typescript
export const TemplatePaths = {
  // ... existing
  MY_NEW_TEMPLATE: 'my-template.njk',
} as const;
```

3. Add type-safe interface in `loader.ts`:

```typescript
export interface MyTemplateVariables {
  role: string;
  constraints: string[];
}

export function renderMyTemplate(variables: MyTemplateVariables): string {
  validateVariables(['role'], variables);
  return renderPrompt(TemplatePaths.MY_NEW_TEMPLATE, variables);
}
```

4. Export from `index.ts`:

```typescript
export { renderMyTemplate } from './loader.js';
export type { MyTemplateVariables } from './loader.js';
```

### Custom Macros

Add macros to `_base.njk`:

```nunjucks
{% macro my_custom_macro(param) %}
CUSTOM SECTION:
- {{ param }}
{% endmacro %}
```

Use in child templates:

```nunjucks
{{ my_custom_macro('value') }}
```

## Best Practices

1. **Version Control**: Commit template changes with descriptive messages
2. **Testing**: Test prompts with real LLM calls, not just rendering
3. **Monitoring**: Track token usage and costs per template
4. **Iteration**: Use A/B testing for prompt improvements
5. **Documentation**: Keep template comments up to date

## Troubleshooting

### Template Not Found

```
Error: template not found: agents/my-template.njk
```

**Solution**: Ensure file exists in `templates/` directory and path is correct.

### Undefined Variable

```
Error: attempted to output null or undefined value
```

**Solution**: Check that all required variables are provided and spelled correctly.

### Syntax Error

```
Error: [Line 10, Column 5] unexpected token: :
```

**Solution**: Check Nunjucks syntax. Common issues:
- Use `{% if %}` not `{% if: %}`
- Use `loop.index0` not array slicing `arr[:5]`
- Ensure all blocks are closed

## References

- [Nunjucks Documentation](https://mozilla.github.io/nunjucks/)
- [LangChain.js Prompts](https://js.langchain.com/docs/modules/prompts/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
