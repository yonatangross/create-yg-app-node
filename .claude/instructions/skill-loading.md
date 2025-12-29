# Skill Loading Strategy

## Progressive Loading Pattern

Skills are loaded in stages to minimize token usage while providing accurate guidance.

## Loading Stages

### Stage 1: Discovery (~100 tokens)
Load only `capabilities.json` to understand what a skill offers:

```javascript
Read(".claude/skills/hono-patterns/capabilities.json")
```

This reveals:
- Available capabilities
- Keywords for matching
- References to detailed docs

### Stage 2: Overview (~500 tokens)
Load the main skill file for patterns:

```javascript
Read(".claude/skills/hono-patterns/SKILL.md")
```

This provides:
- Core patterns and examples
- Best practices
- Common use cases

### Stage 3: Deep Dive (~1000+ tokens)
Load specific reference files when needed:

```javascript
Read(".claude/skills/hono-patterns/references/middleware.md")
Read(".claude/skills/hono-patterns/checklists/api-review.md")
```

## When to Load What

| Task | Load Stage |
|------|------------|
| Quick question | Stage 1 only |
| Implementation guidance | Stage 1 + 2 |
| Complex feature | Stage 1 + 2 + 3 |
| Code review | Stage 1 + checklists |

## Skill Discovery

### By Domain

| Domain | Skills to Consider |
|--------|-------------------|
| Backend API | `hono-patterns`, `api-design-framework` |
| Database | `drizzle-production` |
| Frontend | `react-19-patterns` |
| AI/LLM | `langchain-js-patterns`, `langfuse-observability` |
| Testing | `testing-strategy-builder` |
| Security | `security-checklist` |
| Streaming | `streaming-api-patterns` |
| Type Safety | `type-safety-validation` |

### By Keyword

Search for skills by keywords in capabilities.json:

```javascript
// Find skills for "validation"
Grep({
  pattern: "validation",
  path: ".claude/skills",
  glob: "**/capabilities.json"
})
```

## Loading Examples

### Simple API Endpoint

```javascript
// Stage 1: Check if skill has relevant capability
Read(".claude/skills/hono-patterns/capabilities.json")
// Found: routing, validation, middleware

// Stage 2: Get patterns (if needed)
Read(".claude/skills/hono-patterns/SKILL.md")
```

### Complex Feature with AI

```javascript
// Stage 1: Discover capabilities
Read(".claude/skills/langchain-js-patterns/capabilities.json")
Read(".claude/skills/hono-patterns/capabilities.json")

// Stage 2: Get core patterns
Read(".claude/skills/langchain-js-patterns/SKILL.md")

// Stage 3: Deep dive on specific topic
Read(".claude/skills/langchain-js-patterns/references/streaming.md")
```

## Anti-Patterns

```javascript
// ❌ WRONG: Load all skills upfront
Read(".claude/skills/hono-patterns/SKILL.md")
Read(".claude/skills/drizzle-production/SKILL.md")
Read(".claude/skills/react-19-patterns/SKILL.md")
Read(".claude/skills/langchain-js-patterns/SKILL.md")
// Wasteful - 4000+ tokens before starting

// ✅ CORRECT: Load progressively based on need
Read(".claude/skills/hono-patterns/capabilities.json")  // 100 tokens
// Determine if full skill needed...
Read(".claude/skills/hono-patterns/SKILL.md")  // 500 tokens
// Only load more if specific reference needed
```

## Available Skills

| Skill | Domain | Key Capabilities |
|-------|--------|------------------|
| `api-design-framework` | Backend | REST patterns, error handling |
| `drizzle-production` | Database | Schema, migrations, queries |
| `github-cli` | DevOps | Issues, PRs, releases |
| `hono-patterns` | Backend | Routing, middleware, validation |
| `langchain-js-patterns` | AI/ML | Agents, RAG, streaming |
| `langfuse-observability` | AI/ML | Tracing, cost tracking |
| `production-resilience` | Ops | Circuit breakers, health checks |
| `react-19-patterns` | Frontend | Forms, hooks, RSC |
| `security-checklist` | Security | OWASP, auth, input validation |
| `streaming-api-patterns` | Backend | SSE, WebSocket, backpressure |
| `testing-strategy-builder` | Testing | Vitest, Playwright, MSW |
| `type-safety-validation` | TypeScript | Zod, exhaustive types, branded |
