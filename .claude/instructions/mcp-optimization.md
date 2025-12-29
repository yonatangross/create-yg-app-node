# MCP Token Optimization Guide

## Overview

MCP servers provide powerful capabilities but consume tokens. This guide helps optimize usage.

## Token Budgets

### Per Operation

| Operation | Approx Tokens | When to Use |
|-----------|---------------|-------------|
| `mcp__memory__search_nodes` | 100-500 | Check for existing context |
| `mcp__memory__create_entities` | 200-800 | Save important decisions |
| `mcp__context7__resolve-library-id` | 100-300 | Find library ID first |
| `mcp__context7__query-docs` | 500-2000 | Get specific documentation |
| `mcp__sequential-thinking__*` | 300-1000 | Complex reasoning |

### Budget Guidelines

- **Quick Tasks**: < 1000 tokens on MCP
- **Medium Tasks**: 1000-3000 tokens
- **Complex Tasks**: 3000-5000 tokens

## Optimization Strategies

### 1. Context7: Resolve Then Query

```javascript
// ✅ CORRECT: Resolve first, then query specific topic
const library = await mcp__context7__resolve_library_id({
  libraryName: "react",
  query: "hooks best practices"
})

await mcp__context7__query_docs({
  libraryId: library.id,
  query: "useEffect cleanup"
})

// ❌ WRONG: Multiple queries without resolving
await mcp__context7__query_docs({ query: "react hooks" })
await mcp__context7__query_docs({ query: "react useEffect" })
await mcp__context7__query_docs({ query: "react cleanup" })
```

### 2. Memory: Batch Operations

```javascript
// ✅ CORRECT: Create entities in batch
mcp__memory__create_entities({
  entities: [
    { name: "decision-1", entityType: "decision", observations: [...] },
    { name: "decision-2", entityType: "decision", observations: [...] }
  ]
})

// ❌ WRONG: Multiple single creates
mcp__memory__create_entities({ entities: [{ name: "decision-1", ... }] })
mcp__memory__create_entities({ entities: [{ name: "decision-2", ... }] })
```

### 3. Sequential Thinking: Right-Size Thoughts

```javascript
// ✅ CORRECT: Start with estimate, adjust as needed
mcp__sequential_thinking({
  thought: "Initial analysis...",
  thoughtNumber: 1,
  totalThoughts: 5,  // Start conservative
  nextThoughtNeeded: true
})

// ❌ WRONG: Always use maximum thoughts
mcp__sequential_thinking({
  thoughtNumber: 1,
  totalThoughts: 20,  // Wasteful for simple problems
})
```

## When to Use Each MCP

### Memory MCP
- ✅ Save architectural decisions
- ✅ Track exploration results
- ✅ Persist brainstorm outcomes
- ❌ Don't save transient data
- ❌ Don't duplicate file contents

### Context7 MCP
- ✅ Look up current best practices
- ✅ Check library-specific patterns
- ✅ Verify API usage
- ❌ Don't use for basic language features
- ❌ Don't query same topic multiple times

### Sequential Thinking MCP
- ✅ Complex multi-step reasoning
- ✅ Architectural decisions
- ✅ Problem decomposition
- ❌ Don't use for simple tasks
- ❌ Don't use for direct implementation

### Playwright MCP
- ✅ E2E testing verification
- ✅ Visual regression checks
- ✅ Screenshot evidence
- ❌ Don't use for unit tests
- ❌ Don't use without dev server running

## Cost Tracking

Log MCP usage for optimization:

```javascript
// Check logs for patterns
// .claude/logs/context7-usage.log
// .claude/logs/memory-usage.log
```

Review weekly to identify:
- Duplicate queries
- Unused memory entities
- Excessive thinking chains
