---
description: Deep codebase exploration with parallel specialized agents
---

# Explore: $ARGUMENTS

Multi-angle codebase exploration using 3-5 parallel agents.

## Phase 1: Initial Search

```javascript
// PARALLEL - Quick searches in one message
Grep({ pattern: "$ARGUMENTS", output_mode: "files_with_matches" })
Glob({ pattern: "**/*$ARGUMENTS*" })
```

## Phase 2: Memory Check

```javascript
// Check if this was explored before
mcp__memory__search_nodes({ query: "$ARGUMENTS" })
mcp__memory__search_nodes({ query: "architecture" })
```

## Phase 3: Parallel Deep Exploration (4 Agents)

Launch FOUR specialized explorers - ALL in ONE message:

```javascript
// PARALLEL - All four in ONE message!

Task({
  subagent_type: "Explore",
  prompt: `CODE STRUCTURE EXPLORATION

  Find: $ARGUMENTS

  Search for:
  1. Files containing "$ARGUMENTS"
  2. Classes/functions related to "$ARGUMENTS"
  3. Import/usage patterns
  4. Directory structure

  Use:
  - Grep for code patterns
  - Glob for file patterns
  - Read for context

  Output: File locations with brief descriptions.`,
  run_in_background: true
})

Task({
  subagent_type: "Explore",
  prompt: `DATA FLOW EXPLORATION

  Topic: $ARGUMENTS

  Trace how data flows:
  1. Where does data enter? (API endpoints, user input)
  2. How is it processed? (services, transformations)
  3. Where is it stored? (database, cache)
  4. How is it retrieved? (queries, subscriptions)

  Output: Data flow diagram (ASCII) with file references.`,
  run_in_background: true
})

Task({
  subagent_type: "backend-developer",
  prompt: `ARCHITECTURE EXPLANATION

  Topic: $ARGUMENTS

  Explain the architecture:
  1. How does this feature/system work?
  2. What patterns are used? (repository, service layer, etc.)
  3. How does it integrate with other parts?
  4. What are the key dependencies?
  5. Where are the configuration points?

  Output: Architecture overview with diagram.`,
  run_in_background: true
})

Task({
  subagent_type: "frontend-developer",
  prompt: `FRONTEND EXPLORATION (if applicable)

  Topic: $ARGUMENTS

  If frontend related, explore:
  1. Component hierarchy
  2. State management approach
  3. API integration points
  4. Styling patterns
  5. Route structure

  Output: Frontend structure overview or "N/A - not frontend related".`,
  run_in_background: true
})
```

**Wait for all 4 to complete.**

## Phase 4: AI System Exploration (If AI-Related)

If $ARGUMENTS involves AI/ML:

```javascript
Task({
  subagent_type: "ai-agent-engineer",
  prompt: `AI SYSTEM EXPLORATION

  Topic: $ARGUMENTS

  If AI/ML related, explore:
  1. LangChain.js workflows
  2. Prompt templates
  3. Embedding/RAG pipeline
  4. Caching strategies
  5. Cost considerations

  Key directories:
  - packages/backend/src/agents/
  - packages/backend/src/prompts/

  Output: AI system overview or "N/A - not AI related".`
})
```

## Phase 5: Generate Exploration Report

```markdown
# Exploration Report: $ARGUMENTS

## Quick Answer
[1-2 sentence summary answering the exploration question]

## File Locations
| File | Purpose | Lines |
|------|---------|-------|
| `path/to/file.ts` | [description] | 50-100 |
| `path/to/component.tsx` | [description] | 20-80 |

## Architecture Overview
```
┌─────────────────┐
│   [Component]   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   [Service]     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   [Database]    │
└─────────────────┘
```

## How to Modify
If you want to change this:
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

## Phase 6: Save Exploration to Memory

```javascript
mcp__memory__create_entities({
  entities: [{
    name: `exploration-$ARGUMENTS-${Date.now()}`,
    entityType: "codebase-exploration",
    observations: [
      "Topic: $ARGUMENTS",
      "Key files: [list]",
      "Architecture: [summary]",
      "Entry points: [list]"
    ]
  }]
})
```

---

## Summary

**Total Parallel Agents: 4-5**
- 2 Explore agents (structure, data flow)
- 1 backend-developer
- 1 frontend-developer
- 1 ai-agent-engineer (conditional)

**MCPs Used:**
- memory (previous explorations)

**Key Project Directories:**
- `packages/backend/src/routes/` - Hono endpoints
- `packages/backend/src/agents/` - LangChain agents
- `packages/backend/src/db/` - Drizzle schema
- `packages/frontend/src/` - React components
