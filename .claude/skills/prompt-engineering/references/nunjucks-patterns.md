# Nunjucks Patterns for Prompts

Nunjucks is a Jinja2-compatible template engine for Node.js.

## Installation

```bash
pnpm add nunjucks
pnpm add -D @types/nunjucks
```

## Basic Syntax

### Variables
```njk
You are a {{ persona }} assistant.

User query: {{ query }}
```

### Conditionals
```njk
{% if context %}
Context information:
{{ context }}
{% endif %}

{% if skill_level == 'beginner' %}
Explain concepts simply and avoid jargon.
{% elif skill_level == 'expert' %}
Provide detailed technical responses.
{% endif %}
```

### Loops
```njk
CONSTRAINTS:
{% for constraint in constraints %}
- {{ constraint }}
{% endfor %}

EXAMPLES:
{% for example in examples %}
Input: {{ example.input }}
Output: {{ example.output }}

{% endfor %}
```

### Filters
```njk
{# Uppercase #}
{{ name | upper }}

{# Default value #}
{{ context | default('No context provided') }}

{# JSON stringify #}
{{ data | dump }}

{# Trim whitespace #}
{{ text | trim }}

{# Truncate #}
{{ long_text | truncate(100) }}

{# Join array #}
{{ items | join(', ') }}
```

## Template Inheritance

### Base Template (_base.njk)
```njk
{# Base template with reusable blocks #}

{% block system_intro %}
You are a helpful AI assistant.
{% endblock %}

{% block constraints %}
{% endblock %}

{% block output_format %}
{% endblock %}

{% block examples %}
{% endblock %}
```

### Child Template
```njk
{% extends "_base.njk" %}

{% block system_intro %}
You are a {{ persona }} specializing in {{ domain }}.
{% endblock %}

{% block constraints %}
CONSTRAINTS:
{% for constraint in constraints %}
- {{ constraint }}
{% endfor %}
{% endblock %}

{% block output_format %}
Respond in JSON format:
{{ schema | dump }}
{% endblock %}
```

## Macros (Reusable Components)

### Define Macro
```njk
{# In _macros.njk #}

{% macro output_schema(schema, requirements) %}
REQUIRED OUTPUT STRUCTURE:
{{ schema | dump }}

Field Requirements:
{% for field, desc in requirements %}
- **{{ field }}**: {{ desc }}
{% endfor %}
{% endmacro %}

{% macro forbidden_patterns(patterns) %}
FORBIDDEN PATTERNS - Never use:
{% for pattern in patterns %}
- {{ pattern }}
{% endfor %}
{% endmacro %}

{% macro example_pair(good, bad) %}
GOOD EXAMPLE:
{{ good }}

BAD EXAMPLE (DO NOT USE):
{{ bad }}
{% endmacro %}
```

### Use Macro
```njk
{% from "_macros.njk" import output_schema, forbidden_patterns %}

{{ output_schema(
  schema={
    "answer": "string",
    "confidence": "number 0-1"
  },
  requirements={
    "answer": "Clear, actionable response",
    "confidence": "Float between 0.0 and 1.0"
  }
) }}

{{ forbidden_patterns([
  "I think maybe...",
  "It depends...",
  "Generally speaking..."
]) }}
```

## Whitespace Control

```njk
{# Trim whitespace before/after #}
{%- if condition -%}
  content
{%- endif -%}

{# Preserve newlines for readability #}
{% set content %}
This is a
multiline
string
{% endset %}
```

## Best Practices

### 1. Use Constants for Paths
```typescript
// paths.ts
export const TemplatePaths = {
  AGENT_CHAT: 'agents/chat-agent.njk',
  AGENT_RAG: 'agents/rag-agent.njk',
  CHAIN_SUMMARIZE: 'chains/summarize.njk',
} as const;
```

### 2. Type Your Variables
```typescript
interface ChatAgentVars {
  persona: string;
  context?: string;
  constraints: string[];
  skill_level: 'beginner' | 'intermediate' | 'expert';
}

const prompt = renderPrompt<ChatAgentVars>(TemplatePaths.AGENT_CHAT, {
  persona: 'code reviewer',
  constraints: ['Be specific', 'Cite line numbers'],
  skill_level: 'expert',
});
```

### 3. Validate Output with Zod
```typescript
const OutputSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
});

// Include schema in template
const prompt = renderPrompt(TemplatePaths.AGENT_CHAT, {
  output_schema: zodToJsonSchema(OutputSchema),
});
```

### 4. Environment Configuration
```typescript
const env = nunjucks.configure(TEMPLATES_DIR, {
  autoescape: false,      // Don't escape (prompts, not HTML)
  trimBlocks: true,       // Remove first newline after block
  lstripBlocks: true,     // Remove leading whitespace from block
  noCache: isDev,         // Cache in production
});
```

## Security

> **Warning**: Never use user input directly in templates without validation.

```typescript
// ❌ BAD - User input in template
const prompt = `Tell me about {{ userInput }}`;

// ✅ GOOD - Sanitize first
const sanitized = userInput.replace(/[{}%]/g, '');
const prompt = renderPrompt(template, { topic: sanitized });
```
