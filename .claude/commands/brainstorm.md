---
description: Multi-perspective idea exploration with parallel agents and Socratic method
---

# Brainstorm: $ARGUMENTS

Deep exploration using 10-12 parallel agents for diverse perspectives.

## Phase 1: Initial Exploration (Sequential-Thinking MCP)

Use sequential-thinking for structured decomposition:

```javascript
mcp__sequential-thinking__sequentialthinking({
  thought: "Exploring the problem space for: $ARGUMENTS",
  thoughtNumber: 1,
  totalThoughts: 7,
  nextThoughtNeeded: true
})
```

Key questions to answer:
- What problem are we solving?
- Who are the users?
- What constraints exist?
- What's already been tried?

## Phase 2: Research & Context

### Web Search for Industry Solutions

```javascript
// PARALLEL - All searches in one message!
WebSearch("$ARGUMENTS best practices December 2025")
WebSearch("$ARGUMENTS industry solutions 2025")
WebSearch("$ARGUMENTS common pitfalls 2025")
```

### Memory MCP - Previous Brainstorms

```javascript
mcp__memory__search_nodes({ query: "brainstorm" })
mcp__memory__search_nodes({ query: "design decisions" })
mcp__memory__search_nodes({ query: "$ARGUMENTS" })
```

### Context7 for Technical Possibilities

```javascript
// Look up relevant technologies
mcp__context7__query_docs({ libraryId: "/facebook/react", query: "patterns" })
mcp__context7__query_docs({ libraryId: "/honojs/hono", query: "middleware" })
```

## Phase 3: Multi-Perspective Analysis (8-10 Parallel Agents)

Launch EIGHT+ agents for diverse perspectives - ALL in ONE message:

```javascript
// PARALLEL - All in ONE message!

Task({
  subagent_type: "backend-developer",
  prompt: `BACKEND ARCHITECTURE PERSPECTIVE

  Topic: $ARGUMENTS

  Analyze from Hono backend perspective:
  1. API design (REST patterns)
  2. Service layer structure
  3. Database considerations (Drizzle ORM)
  4. Authentication/authorization
  5. Error handling patterns

  Output: Backend architecture recommendations.`,
  run_in_background: true
})

Task({
  subagent_type: "frontend-developer",
  prompt: `FRONTEND IMPLEMENTATION PERSPECTIVE

  Topic: $ARGUMENTS

  Analyze React 19 approach:
  1. Component architecture options
  2. State management (useActionState, useOptimistic)
  3. Data fetching patterns
  4. Performance optimization
  5. Testing strategy

  Output: Frontend implementation options.`,
  run_in_background: true
})

Task({
  subagent_type: "database-architect",
  prompt: `DATA & STORAGE PERSPECTIVE

  Topic: $ARGUMENTS

  Analyze data needs:
  1. Schema design (Drizzle)
  2. Query patterns
  3. Relationships & constraints
  4. Migration strategy
  5. Performance considerations

  Output: Database design recommendations.`,
  run_in_background: true
})

Task({
  subagent_type: "ai-agent-engineer",
  prompt: `AI/LLM OPPORTUNITIES

  Topic: $ARGUMENTS

  Evaluate AI integration:
  1. Where can AI add value?
  2. LLM use cases (generation, analysis, search)
  3. RAG opportunities (pgvector)
  4. LangChain.js patterns
  5. Cost-benefit analysis

  Output: AI opportunity assessment.`,
  run_in_background: true
})

Task({
  subagent_type: "security-auditor",
  prompt: `SECURITY PERSPECTIVE

  Topic: $ARGUMENTS

  Review security implications:
  1. Authentication needs
  2. Authorization patterns
  3. Input validation (Zod)
  4. Data protection
  5. OWASP considerations

  Output: Security requirements.`,
  run_in_background: true
})

Task({
  subagent_type: "test-engineer",
  prompt: `TESTING STRATEGY PERSPECTIVE

  Topic: $ARGUMENTS

  Plan testing approach:
  1. Unit test strategy (Vitest)
  2. Integration testing
  3. E2E testing (Playwright)
  4. API testing with MSW
  5. CI/CD integration

  Output: Testing strategy.`,
  run_in_background: true
})

Task({
  subagent_type: "ui-designer",
  prompt: `USER EXPERIENCE PERSPECTIVE

  Topic: $ARGUMENTS

  Analyze UX needs:
  1. User personas
  2. User journey mapping
  3. Component design
  4. Accessibility (WCAG)
  5. Responsive patterns

  Output: UX design recommendations.`,
  run_in_background: true
})

Task({
  subagent_type: "Plan",
  prompt: `IMPLEMENTATION PLANNING

  Topic: $ARGUMENTS

  Plan implementation:
  1. MVP scope (minimum viable)
  2. Phase breakdown (iterations)
  3. Risk assessment
  4. Resource requirements
  5. Dependencies

  Output: Implementation roadmap.`,
  run_in_background: true
})
```

**Wait for all agents to complete.**

## Phase 4: Synthesis

Combine all perspectives into unified analysis:
1. Common themes across perspectives
2. Conflicting viewpoints and resolution
3. Critical decisions needed
4. Recommended approach
5. Open questions

## Phase 5: Interactive Refinement

```javascript
AskUserQuestion({
  questions: [
    {
      header: "Approach",
      question: "Which implementation approach resonates most?",
      options: [
        { label: "MVP First", description: "Ship minimal version quickly, iterate" },
        { label: "Full Build", description: "Complete implementation upfront" },
        { label: "Spike First", description: "Technical proof-of-concept first" }
      ],
      multiSelect: false
    }
  ]
})
```

## Phase 6: Save to Memory

```javascript
mcp__memory__create_entities({
  entities: [{
    name: `brainstorm-$ARGUMENTS-${Date.now()}`,
    entityType: "brainstorm-session",
    observations: [
      "Topic: $ARGUMENTS",
      "Key decision: ...",
      "Chosen approach: ...",
      "Next steps: ..."
    ]
  }]
})
```

---

## Summary

**Total Parallel Agents: 8-10**

**Perspectives Covered:**
- Backend (Hono, services)
- Frontend (React 19)
- Database (Drizzle)
- AI/ML (LangChain.js)
- Security
- Testing
- UX Design
- Planning

**MCPs Used:**
- sequential-thinking
- context7
- memory
- WebSearch
