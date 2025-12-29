---
description: Full feature implementation with parallel agents
---

# Implement: $ARGUMENTS

Maximum parallelization for complex features using 10-15 agents.

## Phase 1: Discovery & Planning

### 1a. Structured Thinking

```javascript
mcp__sequential-thinking__sequentialthinking({
  thought: `Analyzing implementation requirements for: $ARGUMENTS`,
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
})
```

### 1b. Create Todo List

```javascript
TodoWrite({
  todos: [
    { content: "Research existing patterns", status: "in_progress", activeForm: "Researching patterns" },
    { content: "Design architecture", status: "pending", activeForm: "Designing architecture" },
    { content: "Implement backend", status: "pending", activeForm: "Implementing backend" },
    { content: "Implement frontend", status: "pending", activeForm: "Implementing frontend" },
    { content: "Write tests", status: "pending", activeForm: "Writing tests" },
    { content: "Validate and document", status: "pending", activeForm: "Validating implementation" }
  ]
})
```

## Phase 2: Research Best Practices

```javascript
// PARALLEL - All searches in ONE message
WebSearch(`$ARGUMENTS best practices 2025`)
WebSearch(`$ARGUMENTS TypeScript patterns 2025`)

// Context7 for library docs
mcp__context7__resolve_library_id({ libraryName: "react", query: "$ARGUMENTS" })
mcp__context7__resolve_library_id({ libraryName: "hono", query: "$ARGUMENTS" })
```

## Phase 3: Architecture Design (5 Parallel Agents)

```javascript
// PARALLEL - All five in ONE message!

Task({
  subagent_type: "backend-developer",
  prompt: `BACKEND ARCHITECTURE for $ARGUMENTS

  Design:
  1. API endpoints needed (Hono routes)
  2. Service layer structure
  3. Database schema (Drizzle)
  4. Error handling approach
  5. Validation with Zod

  Output: Backend implementation spec with file locations.`,
  run_in_background: true
})

Task({
  subagent_type: "frontend-developer",
  prompt: `FRONTEND ARCHITECTURE for $ARGUMENTS

  Design:
  1. Component hierarchy
  2. State management (React 19 patterns)
  3. API integration (TanStack Query)
  4. Form handling (useActionState)
  5. Error boundaries

  Output: Frontend implementation spec with file locations.`,
  run_in_background: true
})

Task({
  subagent_type: "database-architect",
  prompt: `DATABASE DESIGN for $ARGUMENTS

  Design:
  1. Schema design (Drizzle ORM)
  2. Relationships and constraints
  3. Indexes for performance
  4. Migration strategy

  Output: Schema definition with migration.`,
  run_in_background: true
})

Task({
  subagent_type: "ai-agent-engineer",
  prompt: `AI INTEGRATION OPPORTUNITIES for $ARGUMENTS

  If AI can add value:
  1. LangChain.js patterns to use
  2. Prompt templates needed
  3. RAG opportunities
  4. Caching strategy

  Output: AI integration spec or "N/A - no AI needed".`,
  run_in_background: true
})

Task({
  subagent_type: "test-engineer",
  prompt: `TESTING STRATEGY for $ARGUMENTS

  Plan:
  1. Unit tests needed
  2. Integration tests
  3. E2E tests (Playwright)
  4. MSW mocks for API

  Output: Test specification with examples.`,
  run_in_background: true
})
```

**Wait for all 5 to complete.**

## Phase 4: Implementation (6-8 Parallel Agents)

```javascript
// PARALLEL - All in ONE message!

Task({
  subagent_type: "database-architect",
  prompt: `IMPLEMENT DATABASE SCHEMA

  Based on design:
  - Create Drizzle schema in packages/backend/src/db/schema/
  - Generate migration
  - Add seed data if needed

  Use:
  Read(".claude/skills/drizzle-production/SKILL.md")`,
  run_in_background: true
})

Task({
  subagent_type: "backend-developer",
  prompt: `IMPLEMENT BACKEND

  Based on design:
  - Create Hono routes in packages/backend/src/routes/
  - Implement services
  - Add Zod validation
  - Error handling

  Use:
  Read(".claude/skills/hono-patterns/SKILL.md")`,
  run_in_background: true
})

Task({
  subagent_type: "frontend-developer",
  prompt: `IMPLEMENT FRONTEND

  Based on design:
  - Create React components
  - Implement hooks with useActionState
  - Add TanStack Query integration
  - Style with Tailwind

  Use:
  Read(".claude/skills/react-19-patterns/SKILL.md")`,
  run_in_background: true
})

Task({
  subagent_type: "test-engineer",
  prompt: `IMPLEMENT TESTS

  Based on test strategy:
  - Unit tests with Vitest
  - API mocks with MSW
  - E2E tests with Playwright

  Use:
  Read(".claude/skills/testing-strategy-builder/SKILL.md")`,
  run_in_background: true
})
```

**Wait for implementation to complete.**

## Phase 5: Integration & Validation (3 Agents)

```javascript
// PARALLEL - All three in ONE message!

Task({
  subagent_type: "code-reviewer",
  prompt: `CODE QUALITY CHECK

  Review all new code:
  1. TypeScript strictness
  2. Error handling
  3. Code duplication
  4. Naming conventions

  Run: pnpm run check

  Output: Issues to fix before commit.`,
  run_in_background: true
})

Task({
  subagent_type: "security-auditor",
  prompt: `SECURITY CHECK

  Review for security:
  1. Input validation
  2. Authentication/authorization
  3. No exposed secrets
  4. Dependency vulnerabilities

  Run: pnpm audit

  Output: Security findings.`,
  run_in_background: true
})

Task({
  subagent_type: "test-engineer",
  prompt: `RUN ALL TESTS

  Execute and verify:
  1. All unit tests pass
  2. Coverage meets threshold
  3. No regressions

  Run: pnpm test:run --coverage

  Output: Test report.`,
  run_in_background: true
})
```

## Phase 6: Final Validation

```bash
# Run all quality checks
pnpm run check
pnpm test:run --coverage

# Capture evidence
pnpm run check 2>&1 | tee /tmp/implement_check.log
pnpm test:run --coverage 2>&1 | tee /tmp/implement_tests.log
```

## Phase 7: Save to Memory

```javascript
mcp__memory__create_entities({
  entities: [{
    name: `implementation-$ARGUMENTS-${Date.now()}`,
    entityType: "feature-implementation",
    observations: [
      "Feature: $ARGUMENTS",
      "Files created: [list]",
      "Patterns used: [list]",
      "Tests: [count]"
    ]
  }]
})
```

---

## Summary

**Total Parallel Agents: 12-15**
- Phase 3 (Design): 5 agents
- Phase 4 (Implementation): 4 agents
- Phase 5 (Validation): 3 agents

**Skills Used:**
- hono-patterns
- react-19-patterns
- drizzle-production
- testing-strategy-builder
- langchain-js-patterns

**MCPs Used:**
- sequential-thinking
- context7
- memory
- WebSearch

**Output:**
- Database schema + migration
- Backend routes + services
- Frontend components + hooks
- Full test suite
- Quality validation
