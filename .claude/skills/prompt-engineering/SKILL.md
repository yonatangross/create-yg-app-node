# Prompt Engineering Skill

Production prompt management using Nunjucks (Jinja2-compatible) templates for LangChain.js applications.

## Why Templates?

1. **Separation of concerns** - Prompts vs code
2. **Version control friendly** - Clean diffs on prompt changes
3. **Template inheritance** - DRY prompt engineering
4. **Non-developer friendly** - Easier editing by prompt engineers
5. **Testability** - Test prompts independently

## Stack

- **Nunjucks** - Jinja2-compatible template engine for Node.js
- **LangChain.js** - LLM orchestration
- **Zod** - Output schema validation

## Directory Structure

```
backend/src/prompts/
├── templates/
│   ├── _base.njk           # Shared macros
│   ├── _output-schemas.njk # Common JSON schemas
│   ├── agents/
│   │   ├── chat-agent.njk
│   │   └── rag-agent.njk
│   ├── chains/
│   │   ├── summarize.njk
│   │   └── extract.njk
│   └── evaluators/
│       └── relevance.njk
├── loader.ts               # Template loader utility
├── paths.ts                # Template path constants
└── index.ts                # Exports
```

## Quick Start

```typescript
import { renderPrompt, TemplatePaths } from '@/prompts';

const systemPrompt = renderPrompt(TemplatePaths.AGENT_CHAT, {
  persona: 'helpful assistant',
  context: userContext,
  constraints: ['Be concise', 'Use examples'],
});
```

## Features

- **Template inheritance** - Extend base templates
- **Macros** - Reusable prompt components
- **Filters** - Transform variables
- **Conditionals** - Dynamic prompt sections
- **Loops** - Iterate over examples/constraints

## References

- `references/nunjucks-patterns.md` - Nunjucks syntax for prompts
- `references/langchain-integration.md` - Using with LangChain.js
- `templates/template-loader.ts` - Copy-paste loader implementation
- `templates/base-template.njk` - Base template with macros
- `examples/agent-prompt.njk` - Example agent template
