---
name: full-stack-feature
description: End-to-end feature implementation workflow
skills: [api-design-framework, drizzle-production, hono-patterns, react-19-patterns, testing-strategy-builder]
agents: [backend-system-architect, frontend-ui-developer, code-quality-reviewer]
---

# Full-Stack Feature Workflow

## Overview
Orchestrates complete feature implementation from database to UI.

## Workflow Steps

```
┌─────────────────────────────────────────────────────────────┐
│                    Feature Request                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. DESIGN PHASE                                            │
│     ├─ Define API contract (OpenAPI spec)                   │
│     ├─ Design database schema (Drizzle)                     │
│     └─ Plan component structure                             │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  2a. BACKEND             │   │  2b. FRONTEND (parallel)     │
│      (backend-architect) │   │      (frontend-ui-developer) │
│                          │   │                              │
│  ├─ Schema migration     │   │  ├─ Type definitions         │
│  ├─ API endpoints        │   │  ├─ API client               │
│  ├─ Service layer        │   │  ├─ Components               │
│  └─ Integration tests    │   │  └─ Unit tests               │
└──────────────────────────┘   └──────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. INTEGRATION PHASE                                       │
│     ├─ Connect frontend to backend                          │
│     ├─ E2E tests (Playwright)                               │
│     └─ Performance validation                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. QUALITY PHASE (code-quality-reviewer)                   │
│     ├─ Type checking                                        │
│     ├─ Lint validation                                      │
│     ├─ Security audit                                       │
│     └─ Test coverage check                                  │
└─────────────────────────────────────────────────────────────┘
```

## Skill Loading by Phase

### Phase 1: Design
- Load: `api-design-framework/capabilities.json`
- Load: `drizzle-production/capabilities.json`

### Phase 2a: Backend Implementation
- Load: `drizzle-production/references/schema.md`
- Load: `hono-patterns/references/routing.md`
- Load: `hono-patterns/references/validation.md`
- Load: `production-resilience/references/circuit-breakers.md`

### Phase 2b: Frontend Implementation
- Load: `react-19-patterns/references/forms.md`
- Load: `react-19-patterns/references/optimistic.md`

### Phase 3: Integration
- Load: `testing-strategy-builder/references/e2e.md`
- Load: `hono-patterns/references/rpc-client.md`

### Phase 4: Quality
- Load: `security-checklist/checklists/owasp-top-10.md`

## Example Usage

```bash
# Trigger workflow
/workflow full-stack-feature "Add user profile editing"
```

## Artifacts Produced

1. **Database Migration**: `drizzle/XXXX_feature_name.sql`
2. **API Endpoints**: `backend/src/routes/feature.ts`
3. **Service Layer**: `backend/src/services/feature.ts`
4. **React Components**: `frontend/src/features/Feature/`
5. **Tests**: `*.test.ts` files alongside implementation
6. **E2E Tests**: `e2e/feature.spec.ts`
