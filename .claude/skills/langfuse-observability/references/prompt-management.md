# Prompt Management with Langfuse

## Overview

Langfuse Prompt Management provides:
- **Version Control**: Track prompt changes over time
- **Labels**: Tag versions (e.g., `production`, `staging`)
- **Variables**: Template syntax compatible with LangChain
- **Analytics**: Link prompts to traces for A/B testing

## Fetching Prompts

### Basic Fetch
```typescript
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse();

// Get latest version
const prompt = await langfuse.getPrompt('assistant-prompt');
```

### Version Pinning
```typescript
// By version number (immutable)
const promptV3 = await langfuse.getPrompt('assistant-prompt', 3);

// By label (can be moved between versions)
const prodPrompt = await langfuse.getPrompt('assistant-prompt', undefined, {
  label: 'production',
});
```

### Caching
```typescript
// Enable caching (TTL in seconds)
const prompt = await langfuse.getPrompt('assistant-prompt', undefined, {
  cacheTtlSeconds: 300,  // 5 minute cache
});
```

## LangChain Integration

### Text Prompts
```typescript
import { PromptTemplate } from '@langchain/core/prompts';

const langfusePrompt = await langfuse.getPrompt('summarizer');

// getLangchainPrompt() converts {{variable}} to {variable}
const template = langfusePrompt.getLangchainPrompt();
const prompt = PromptTemplate.fromTemplate(template);

// Use with chain
const chain = prompt.pipe(model).pipe(parser);
```

### Chat Prompts
```typescript
import { ChatPromptTemplate } from '@langchain/core/prompts';

const langfusePrompt = await langfuse.getPrompt('chat-assistant', undefined, {
  type: 'chat',
});

// Returns array of { role, content } messages
const messages = langfusePrompt.getLangchainPrompt();
const chatPrompt = ChatPromptTemplate.fromMessages(
  messages.map(m => [m.role, m.content])
);
```

## Linking Prompts to Traces

### Automatic Linking
```typescript
const langfusePrompt = await langfuse.getPrompt('rag-assistant');

// Add to config metadata - automatically links to traces
const prompt = PromptTemplate.fromTemplate(
  langfusePrompt.getLangchainPrompt()
).withConfig({
  metadata: { langfusePrompt },  // Key must be "langfusePrompt"
});

// Now all traces using this prompt link back to prompt version
const chain = prompt.pipe(model).pipe(parser);
await chain.invoke({ input }, { callbacks: [handler] });
```

### Benefits of Linking
1. **Trace Filtering**: Filter traces by prompt name/version
2. **A/B Testing**: Compare metrics across prompt versions
3. **Rollback Analysis**: See how performance changed after updates
4. **Cost Attribution**: Track costs per prompt version

## Prompt Structure in Langfuse

### Text Prompt
```
Name: summarizer
Version: 3
Label: production

Content:
Summarize the following document in {{style}} style.
Focus on {{focus_areas}}.

Document:
{{document}}

Summary:
```

### Chat Prompt
```
Name: assistant
Version: 5
Label: production

Messages:
[
  { "role": "system", "content": "You are {{persona}}. {{constraints}}" },
  { "role": "user", "content": "{{user_input}}" }
]
```

## Development Workflow

### 1. Create in Langfuse UI
- New prompt → Add name, content, variables
- Test with sample inputs

### 2. Development
```typescript
// Use latest version in dev
const devPrompt = await langfuse.getPrompt('my-prompt');
```

### 3. Promote to Production
- In Langfuse UI: Add `production` label to tested version

### 4. Production Code
```typescript
// Always use labeled version
const prodPrompt = await langfuse.getPrompt('my-prompt', undefined, {
  label: 'production',
});
```

### 5. Update Process
1. Create new version in Langfuse
2. Test with label `staging`
3. Move `production` label to new version
4. Rollback: Move label back if issues

## Syncing with Local Templates

If using Nunjucks templates locally (see `prompt-engineering` skill):

```typescript
import { renderPrompt } from '@/prompts/loader';
import { Langfuse } from 'langfuse';

// Option 1: Use local templates in dev, Langfuse in prod
const getPrompt = async (name: string, variables: Record<string, unknown>) => {
  if (process.env.NODE_ENV === 'development') {
    return renderPrompt(`agents/${name}.njk`, variables);
  }

  const langfusePrompt = await langfuse.getPrompt(name, undefined, {
    label: 'production',
  });

  // Nunjucks-style variables in Langfuse
  return langfusePrompt.compile(variables);
};
```

## Best Practices

1. **Always use labels in production** - Never fetch latest
2. **Cache prompts** - Reduce latency with `cacheTtlSeconds`
3. **Link to traces** - Enable prompt analytics
4. **Document variables** - Use clear naming and descriptions
5. **Test before promoting** - Use staging label first
6. **Track in git** - Export prompts for version control backup
