# YG App Node

Production-ready full-stack Node.js + React application starter with AI capabilities.

## Tech Stack

### Frontend
- **React 19** - Latest React with use hooks, useOptimistic, useFormStatus
- **Vite 6** - Fast development and optimized builds
- **TailwindCSS 4** - Utility-first CSS framework
- **TanStack Query** - Powerful async state management
- **React Router 7** - Declarative routing

### Backend
- **Hono** - Ultra-fast, edge-ready web framework
- **Drizzle ORM** - TypeScript-first SQL ORM
- **Zod** - Schema validation with TypeScript inference
- **Pino** - Fast JSON logger

### AI/LLM
- **LangChain.js** - LLM application framework
- **LangGraph** - Agent orchestration
- **pgvector** - Vector similarity search

### Infrastructure
- **PostgreSQL 16** - Primary database with pgvector
- **Redis** - Caching and queues
- **Langfuse** - LLM observability
- **Docker Compose** - Local development services

## Quick Start

```bash
# Clone and initialize with your project name
git clone https://github.com/yonatangross/create-yg-app-node.git my-app
cd my-app
./scripts/init.sh my-app

# Or use the Makefile for full setup
make setup    # Installs deps + starts Docker services
make dev      # Start development servers
```

## Available Ports

| Service  | Port | Description |
|----------|------|-------------|
| Frontend | 4173 | Vite dev server |
| Backend  | 4000 | Hono API server |
| Postgres | 5433 | Database |
| Redis    | 6380 | Cache |
| Langfuse | 3001 | LLM observability UI |

## Project Structure

```
.
├── packages/
│   ├── shared/           # Shared types, schemas, utilities
│   │   └── src/
│   │       ├── types/    # Zod schemas & TypeScript types
│   │       └── utils/    # Shared utilities
│   │
│   ├── backend/          # Hono API server
│   │   └── src/
│   │       ├── routes/   # API routes
│   │       ├── middleware/
│   │       ├── db/       # Drizzle schemas
│   │       ├── lib/      # Utilities
│   │       └── config/   # Environment config
│   │
│   └── frontend/         # React 19 + Vite
│       └── src/
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           └── lib/      # API client, utilities
│
├── .claude/              # Claude Code configuration
│   ├── agents/           # Specialized AI agents
│   ├── skills/           # Reusable skill templates
│   ├── instructions/     # AI instructions
│   └── context/          # Shared context files
│
├── docker-compose.yml    # Local dev services
├── Makefile              # Development commands
└── pnpm-workspace.yaml   # Monorepo config
```

## Development Commands

```bash
# Development
make dev              # Start all dev servers
make dev-backend      # Start only backend
make dev-frontend     # Start only frontend

# Code Quality
make check            # Run all checks
make lint             # Run ESLint
make format           # Format with Prettier
make typecheck        # TypeScript checks
make test             # Run tests

# Database
make db-studio        # Open Drizzle Studio
make db-push          # Push schema changes
make db-generate      # Generate migrations

# Docker
make docker-up        # Start services
make docker-down      # Stop services
make docker-logs      # View logs
make docker-reset     # Reset volumes (deletes data)
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - LLM API keys
- `LANGFUSE_*` - Observability configuration

## Claude Code Integration

This project includes comprehensive Claude Code configuration:

- **4 Specialized Agents**: Backend, Frontend, Code Quality, AI/ML
- **6 Skills**: API Design, Testing, LangChain patterns, Production Resilience, Security, GitHub CLI
- **MCP Servers**: Memory, Sequential Thinking, Context7, Playwright, Postgres, Langfuse

## Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run quality checks: `make check`
4. Run tests: `make test`
5. Commit with conventional commits: `git commit -m "feat: add feature"`
6. Push and create PR: `gh pr create --base dev`

## License

MIT
