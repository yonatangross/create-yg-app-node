# Architecture Overview

> YG Node Starter - Full-stack AI Application Template

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                               │
│                    (React 19 + Vite)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Pages     │  │ Components  │  │   TanStack Query    │  │
│  │  - Home     │  │  - Layout   │  │  (Data Fetching)    │  │
│  │  - Users    │  │  - UI       │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/SSE
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                    (Hono on Node.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ CORS     │  │ Logging  │  │ Rate     │  │ Error      │  │
│  │          │  │          │  │ Limit    │  │ Handler    │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Health Routes  │ │   REST API      │ │   AI/LLM API    │
│  - /health      │ │  - /api/users   │ │  - /api/chat    │
│  - /health/live │ │                 │ │  - /api/rag     │
│  - /health/ready│ │                 │ │  (SSE streaming)│
└─────────────────┘ └────────┬────────┘ └────────┬────────┘
                             │                    │
                             ▼                    ▼
                    ┌─────────────────┐  ┌─────────────────┐
                    │   Repository    │  │   LangGraph     │
                    │   Layer         │  │   Agents        │
                    │  (Drizzle ORM)  │  │  - Chat Agent   │
                    │                 │  │  - RAG Agent    │
                    └────────┬────────┘  └────────┬────────┘
                             │                    │
          ┌──────────────────┼──────────────────┬─┘
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │     Redis       │ │    LLM APIs     │
│   + pgvector    │ │  (Cache/Rate)   │ │  (OpenAI, etc)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Directory Structure

```
/
├── packages/
│   ├── frontend/           # React 19 + Vite
│   │   ├── src/
│   │   │   ├── components/ # Shared UI components
│   │   │   ├── pages/      # Route pages
│   │   │   ├── hooks/      # Custom React hooks
│   │   │   └── lib/        # Utilities
│   │   └── package.json
│   │
│   ├── backend/            # Hono + Node.js
│   │   ├── src/
│   │   │   ├── routes/     # HTTP route handlers
│   │   │   ├── agents/     # LangGraph AI agents
│   │   │   ├── services/   # Business logic
│   │   │   ├── db/         # Drizzle schema + repos
│   │   │   ├── shared/     # Shared utilities
│   │   │   ├── middleware/ # Hono middleware
│   │   │   ├── prompts/    # LLM prompt templates
│   │   │   ├── core/       # Core config, logger
│   │   │   └── lib/        # Helpers
│   │   └── package.json
│   │
│   └── shared/             # Shared types
│       └── src/
│           └── types/
│
├── .claude/                # Claude Code config
│   ├── agents/             # 11 specialized agents
│   ├── skills/             # 13 production skills
│   ├── commands/           # 9 workflow commands
│   └── instructions/       # Configuration docs
│
├── docker-compose.yml
├── Makefile
└── pnpm-workspace.yaml
```

## Key Patterns

### 1. Lazy Configuration

```typescript
// core/config.ts
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const result = envSchema.safeParse(process.env);
  if (!result.success) throw new Error('Invalid config');

  cachedConfig = result.data;
  return cachedConfig;
}
```

**Why**: Deferred validation allows tests to mock config before initialization.

### 2. Repository Pattern (Drizzle)

```typescript
// db/repositories/user.repository.ts
export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const db = await getDb();
    return db.query.users.findFirst({
      where: eq(users.id, id),
    }) ?? null;
  }
}
```

**Why**: Abstracts database access for testability and clean separation.

### 3. LangGraph Agent Structure

```typescript
// agents/chat-agent.ts
const workflow = new StateGraph<ChatState>()
  .addNode('agent', callModel)
  .addNode('tools', callTool)
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('tools', 'agent');

const agent = workflow.compile({ checkpointer });
```

**Why**: Stateful, tool-calling agents with persistence via PostgresSaver.

### 4. Circuit Breaker (Resilience)

```typescript
// core/resilience.ts
const breaker = createCircuitBreaker<[string], unknown>(
  'external',
  'openai',
  { timeout: 10000, errorThreshold: 50 }
);
```

**Why**: Protects against cascading failures from external services.

### 5. Redis Embeddings Cache

```typescript
// shared/embeddings.ts
async embedQuery(text: string): Promise<number[]> {
  const key = this.getCacheKey(text);
  const cached = await this.redis.get(key);
  if (cached) return JSON.parse(cached);

  const embedding = await this.embeddings.embedQuery(text);
  await this.redis.setex(key, this.ttl, JSON.stringify(embedding));
  return embedding;
}
```

**Why**: Reduces LLM API costs by ~80% through caching.

## Data Flow

### REST API Request

```
Request → CORS → Logger → Rate Limit → Route Handler
                                            │
                                            ▼
                                     Repository/Service
                                            │
                                            ▼
                                     Drizzle ORM → PostgreSQL
                                            │
                                            ▼
                                     Response ← Error Handler
```

### AI Chat Request (SSE)

```
Request → Validation → Chat Agent
                          │
                    ┌─────┴─────┐
                    ▼           ▼
               LLM API     Tool Calls
                    │           │
                    └─────┬─────┘
                          ▼
                    SSE Stream → Client
                          │
                          ▼
                    Langfuse (Trace)
```

## Technology Choices

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend Framework | React 19 | Latest features, wide adoption |
| Build Tool | Vite 6 | Fast HMR, ESBuild |
| Styling | TailwindCSS 4 | Utility-first, zero runtime |
| Backend | Hono | Edge-ready, Web Standards |
| ORM | Drizzle 0.45 | Type-safe SQL, lightweight |
| Vector DB | pgvector | PostgreSQL extension, no extra service |
| AI/LLM | LangChain.js | Agent orchestration, ecosystem |
| Observability | Langfuse | LLM-specific tracing |
| Cache | Redis | Proven, ioredis reliability |

## Configuration

Environment variables are validated via Zod schemas in `core/config.ts`:

```
NODE_ENV              development|production|test
PORT                  4000
DATABASE_URL          postgresql://...
REDIS_URL             redis://...
OPENAI_API_KEY        sk-...
LANGFUSE_PUBLIC_KEY   pk-...
LANGFUSE_SECRET_KEY   sk-...
```

## Testing Strategy

- **Unit Tests**: Vitest + vi.mock for isolated testing
- **Integration Tests**: Hono's `app.request()` for route testing
- **E2E Tests**: Playwright MCP for browser automation
- **AI Agent Tests**: Mock LLM responses, test graph structure
