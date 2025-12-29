# Context Triggers

This document defines keywords that auto-invoke specific agents.

## Agent Trigger Keywords

### backend-system-architect
Trigger when user mentions:
- API, REST, GraphQL, endpoint, route
- database, schema, migration, Drizzle
- backend, server, Hono
- authentication, JWT, auth
- microservice, service

### frontend-ui-developer
Trigger when user mentions:
- component, UI, React, frontend
- form, input, button, modal
- style, CSS, Tailwind
- hook, state, context
- page, layout, navigation

### code-quality-reviewer
Trigger when user mentions:
- test, testing, coverage
- review, quality, bug
- lint, format, typecheck
- security, vulnerability
- performance, optimize

### ai-ml-engineer
Trigger when user mentions:
- AI, ML, LLM, model
- LangChain, agent, RAG
- embedding, vector, search
- prompt, chain, tool
- streaming, chat

## Usage

Agents should check this file and auto-invoke when:
1. User message contains trigger keywords
2. Task naturally aligns with agent expertise
3. Previous context suggests agent involvement

## Priority

When multiple agents match:
1. Check explicit user mention first
2. Use primary domain agent
3. Invoke code-quality-reviewer after implementation
