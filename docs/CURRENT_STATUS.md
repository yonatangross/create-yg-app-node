# Current Project Status

> Last updated: December 29, 2025

## Overview

YG Node Starter is a production-ready full-stack starter template with AI capabilities.

## Completed Features

### Core Stack
- [x] **Frontend**: React 19 with Vite 6, TailwindCSS 4, TanStack Query
- [x] **Backend**: Hono 4.11 with TypeScript
- [x] **Database**: PostgreSQL 16 + Drizzle ORM 0.45 + pgvector
- [x] **Cache**: Redis for embeddings cache and rate limiting
- [x] **AI/LLM**: LangChain.js + LangGraph 1.0 with Langfuse observability

### Backend Services
- [x] Health check routes (`/health`, `/health/live`, `/health/ready`)
- [x] Users CRUD API (`/api/users`)
- [x] Chat agent with tool calling (`/api/chat`)
- [x] RAG agent with vector retrieval (`/api/rag/query`)
- [x] Streaming responses via SSE

### Infrastructure
- [x] Docker Compose for local development
- [x] Drizzle migrations setup
- [x] Redis-backed embeddings cache
- [x] Rate limiting middleware
- [x] Circuit breaker for resilience
- [x] Graceful shutdown handling

### Claude Code Integration
- [x] 11 specialized agents defined
- [x] 13 production skills with comprehensive documentation
- [x] 9 workflow commands
- [x] MCP servers configured (memory, sequential-thinking, context7, playwright, postgres, langfuse)

## Code Quality Status

```
Format:    ✅ PASSING
Lint:      ✅ PASSING
TypeCheck: ✅ PASSING
Tests:     🔶 NEEDS VERIFICATION
```

## Known Technical Debt

### High Priority

1. **Duplicate Configuration Files**
   - `src/config/env.ts` - older, simpler config
   - `src/core/config.ts` - newer, comprehensive config
   - **Action**: Migrate all imports to `core/config.ts`, delete `config/env.ts`

2. **Duplicate Logger Implementations**
   - `src/lib/logger.ts` - used by 6 files (repositories, middleware)
   - `src/core/logger.ts` - used by 11 files (agents, shared modules)
   - **Action**: Consolidate to `core/logger.ts`

### Medium Priority

3. **Missing Tests**
   - No frontend tests (React Testing Library needed)
   - Shared package tests need vitest config
   - Integration tests for agent flows

4. **Database**
   - Using in-memory Map for users route (demo only)
   - Need to wire up Drizzle repositories to routes

### Low Priority

5. **Documentation**
   - API documentation (OpenAPI/Swagger)
   - Component storybook for frontend

## Next Steps

1. Run `pnpm test:run` to verify all tests pass
2. Consolidate duplicate config/logger files
3. Add frontend tests
4. Wire up database to routes
5. Create init.sh customization script

## Quick Start

```bash
# Install dependencies
pnpm install

# Start services
make dev

# Run checks
pnpm run check

# Run tests
pnpm test:run
```

## Port Reference

| Service   | Port | Notes |
|-----------|------|-------|
| Frontend  | 4173 | Vite dev server |
| Backend   | 4000 | Hono API |
| Postgres  | 5433 | Non-standard to avoid conflicts |
| Redis     | 6380 | Non-standard to avoid conflicts |
| Langfuse  | 3001 | Observability UI |
