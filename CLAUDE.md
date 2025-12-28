---
name: yg-node-starter
description: Production-ready full-stack Node.js/TypeScript application starter
version: 1.0.0
---

# YG Node Starter

> AI-powered full-stack application with React 19, Hono, LangChain.js, and modern Node.js patterns.

## WHY

Production-ready starter template for full-stack Node.js applications with AI capabilities. Clone, customize with `./init.sh "Project Name"`, and start building.

## WHAT

**Stack**: React 19 + Hono + LangChain.js + PostgreSQL/pgvector + Langfuse

**Ports**: Frontend `5173` | Backend `3000` | Postgres `5432` | Redis `6379` | Langfuse `3010`

## HOW

```bash
make dev      # Start all services
make test     # Run tests
make lint     # Check code quality
make down     # Stop services
```

---

## IMPORTANT: Context Initialization

**YOU MUST** read these files at the start of every session:
1. `docs/CURRENT_STATUS.md` - Sprint progress, blockers
2. `docs/ARCHITECTURE.md` - System design, patterns

Then run: `git log --oneline -10 && git status`

---

## IMPORTANT: Code Quality

**YOU MUST** run these before committing:

**TypeScript**: `pnpm run check` (format + lint + typecheck)

**Tests**: `pnpm test:run`

---

## IMPORTANT: Git Workflow

- **NEVER** commit directly to `main` or `dev`
- Create feature branches: `feature/<name>` or `issue/<number>-<desc>`
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`

---

## Key Files

| Purpose | Location |
|---------|----------|
| Agent definitions | `.claude/agents/*.md` |
| Skills (6 total) | `.claude/skills/*/SKILL.md` |
| Parallel execution rules | `.claude/instructions/parallel-execution-rules.md` |
| Code quality rules | `.claude/instructions/code-quality-rules.md` |
| Context initialization | `.claude/instructions/context-initialization.md` |

---

## Agents (4 core)

- `backend-system-architect` - Hono APIs, Drizzle, Node.js patterns
- `frontend-ui-developer` - React 19, Vite, TailwindCSS
- `code-quality-reviewer` - ESLint, TypeScript, testing standards
- `ai-ml-engineer` - LangChain.js, RAG, agent orchestration

---

## Skills (6 total)

- `api-design-framework` - REST API patterns with Hono
- `testing-strategy-builder` - Vitest, Playwright, MSW
- `langchain-js-patterns` - LLM integration, agents, RAG
- `production-resilience` - Circuit breakers, health checks
- `security-checklist` - OWASP, auth, input validation
- `github-cli` - gh commands for workflow

---

## MCP Servers (6 configured)

Active: `memory`, `sequential-thinking`, `context7`, `playwright`, `postgres`, `langfuse`

Config: `.mcp.json` | Docs: `.claude/instructions/mcp-servers.md`

---

## Tech Stack

### Frontend
- React 19 with TypeScript
- Vite 6
- TailwindCSS 4
- TanStack Query
- React Router 7

### Backend
- Hono (edge-ready framework)
- Drizzle ORM (type-safe SQL)
- Zod (runtime validation)
- Pino (structured logging)
- opossum (circuit breaker)

### AI/LLM
- LangChain.js
- @langchain/langgraph
- pgvector (embeddings)
- Langfuse (observability)

### Infrastructure
- PostgreSQL 16
- Redis
- Docker Compose

---

## Project Structure

```
/
├── frontend/               # React 19 + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   └── package.json
│
├── backend/                # Hono + Node.js
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── agents/         # LangChain agents
│   │   ├── db/             # Drizzle schema
│   │   └── lib/
│   └── package.json
│
├── .claude/                # Claude Code config
│   ├── agents/             # 4 agents
│   ├── skills/             # 6 skills
│   ├── instructions/       # 8 instruction files
│   ├── hooks/              # Git protection
│   ├── context/            # Shared state
│   └── settings.json
│
├── docker-compose.yml
├── Makefile
├── pnpm-workspace.yaml
└── CLAUDE.md
```

---

## Commands

```bash
# Development
pnpm dev                  # Start with hot reload
pnpm build                # Build for production
pnpm start                # Run production build

# Quality
pnpm check                # Format + lint + typecheck
pnpm test                 # Watch mode
pnpm test:run             # Single run
pnpm test:coverage        # With coverage

# Database
pnpm drizzle-kit generate # Generate migration
pnpm drizzle-kit migrate  # Apply migration
```

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...
```
