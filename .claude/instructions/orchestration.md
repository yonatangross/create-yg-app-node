# Agent Orchestration Guide

## Dynamic Agent Routing

This document describes how to select and route tasks to specialized agents.

## Agent Selection Process

### 1. Semantic Matching

Match user intent to agent capabilities:

```
User Request → Extract Keywords → Match to Agent Capabilities → Select Agent
```

### 2. Agent Confidence Scoring

Score each agent (0-1) based on:
- **Keyword Match**: Does the request match agent keywords?
- **Domain Expertise**: Is this the agent's primary domain?
- **Capability Fit**: Does the agent have the required capabilities?

### 3. Selection Rules

1. **Single Agent**: Confidence > 0.8 → Direct routing
2. **Multiple Agents**: Confidence 0.5-0.8 → Launch in parallel
3. **No Match**: Confidence < 0.5 → Use general-purpose agent

## Agent Types and Keywords

| Agent | Primary Keywords | Domain |
|-------|------------------|--------|
| `frontend-developer` | react, component, hook, ui, tsx | Frontend |
| `backend-developer` | hono, api, route, service | Backend |
| `database-architect` | drizzle, schema, migration, query | Database |
| `ai-agent-engineer` | langchain, llm, rag, agent | AI/ML |
| `test-engineer` | test, vitest, playwright, coverage | Testing |
| `security-auditor` | security, owasp, audit | Security |
| `code-reviewer` | review, quality, lint | Quality |

## Parallel Agent Patterns

### Small Tasks (1-2 agents)
```javascript
Task({ subagent_type: "frontend-developer", prompt: "..." })
```

### Medium Tasks (3-5 agents)
```javascript
// PARALLEL - All in ONE message
Task({ subagent_type: "backend-developer", prompt: "...", run_in_background: true })
Task({ subagent_type: "frontend-developer", prompt: "...", run_in_background: true })
Task({ subagent_type: "test-engineer", prompt: "...", run_in_background: true })
```

### Large Tasks (6+ agents)
```javascript
// Phase 1: Analysis (parallel)
Task({ subagent_type: "Explore", prompt: "...", run_in_background: true })
Task({ subagent_type: "Explore", prompt: "...", run_in_background: true })

// Phase 2: Implementation (parallel)
Task({ subagent_type: "backend-developer", prompt: "...", run_in_background: true })
Task({ subagent_type: "frontend-developer", prompt: "...", run_in_background: true })

// Phase 3: Validation (parallel)
Task({ subagent_type: "code-reviewer", prompt: "...", run_in_background: true })
Task({ subagent_type: "test-engineer", prompt: "...", run_in_background: true })
```

## Maximum Agents Per Task

- **Standard**: 3 agents max (focused, efficient)
- **Complex Features**: 5-8 agents (comprehensive)
- **Full Implementation**: 10-15 agents (maximum parallelization)

## Handoff Protocol

When agents complete work that requires another agent:

1. Write summary to `role-comm-*.md`
2. Include file paths and decisions
3. Specify what the next agent needs to do
4. Tag the next agent explicitly

Example:
```markdown
[2025-12-29 15:30] [backend-developer] [HANDOFF]
Completed API endpoints for user management.
Files: packages/backend/src/routes/users.ts
Next: frontend-developer needs to implement UI forms
```
