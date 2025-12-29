# Architecture Decisions - Node.js Stack

## Overview

This document captures the key architectural decisions for the YG Node Starter template.

---

## Technology Choices

### Backend Framework: Hono

**Decision**: Use Hono over Express/Fastify

**Rationale**:
- Ultra-fast (built on Web Standards)
- Edge-ready (works on Cloudflare Workers, Vercel Edge, Deno)
- TypeScript-first with excellent type inference
- Minimal bundle size (~14kb)
- Middleware ecosystem compatible with Web APIs

**Patterns**:
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// Typed routes with Zod validation
app.post('/api/users', zValidator('json', createUserSchema), async (c) => {
  const data = c.req.valid('json');
  // data is fully typed
});
```

### ORM: Drizzle

**Decision**: Use Drizzle over Prisma

**Rationale**:
- SQL-like syntax (no abstraction overhead)
- Excellent TypeScript inference
- Smaller bundle size
- Better performance (no query engine)
- Full control over generated SQL

**Patterns**:
```typescript
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Validation: Zod

**Decision**: Use Zod for runtime validation

**Rationale**:
- TypeScript-first schema validation
- Infers types automatically
- Works with Hono middleware
- Excellent error messages
- Composable schemas

**Patterns**:
```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

### AI/LLM: LangChain.js

**Decision**: Use LangChain.js for AI orchestration

**Rationale**:
- Comprehensive agent framework
- Supports multiple LLM providers
- Built-in RAG patterns
- LangGraph for complex workflows
- TypeScript support

**Patterns**:
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const model = new ChatOpenAI({ modelName: 'gpt-4' });
const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  ['human', '{input}'],
]);

const chain = prompt.pipe(model);
```

### Testing: Vitest

**Decision**: Use Vitest over Jest

**Rationale**:
- Native ESM support
- Faster execution
- Compatible with Vite
- Jest-compatible API
- Built-in TypeScript support

### Logging: Pino

**Decision**: Use Pino for structured logging

**Rationale**:
- Fastest Node.js logger
- JSON output (machine-readable)
- Low overhead
- Transport plugins available

---

## Project Structure

```
/
├── frontend/                 # React 19 + Vite
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Route pages
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilities
│   │   └── main.tsx
│   └── package.json
│
├── backend/                  # Hono + Node.js
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Business logic
│   │   ├── agents/           # LangChain agents
│   │   ├── db/               # Drizzle schema
│   │   ├── lib/              # Utilities
│   │   └── index.ts
│   └── package.json
│
├── .claude/                  # Claude Code config
├── docker-compose.yml        # PostgreSQL, Redis, Langfuse
└── pnpm-workspace.yaml       # Monorepo config
```

---

## API Design Principles

### RESTful Conventions
- Use plural nouns: `/api/users`, `/api/posts`
- HTTP methods: GET (read), POST (create), PUT (update), DELETE (remove)
- Status codes: 200 (OK), 201 (Created), 400 (Bad Request), 404 (Not Found), 500 (Server Error)

### Response Format
```typescript
// Success
{
  "data": { ... },
  "meta": { "total": 100, "page": 1 }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [...]
  }
}
```

### Streaming (for AI responses)
```typescript
app.get('/api/chat/stream', async (c) => {
  return streamSSE(c, async (stream) => {
    for await (const chunk of llmStream) {
      await stream.writeSSE({ data: chunk });
    }
  });
});
```

---

## Database Patterns

### Migrations with Drizzle
```bash
pnpm drizzle-kit generate  # Generate migration
pnpm drizzle-kit migrate   # Apply migration
```

### Connection Pooling
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL, {
  max: 20,              // Max connections
  idle_timeout: 30,     // Close idle connections after 30s
  connect_timeout: 10,  // Connection timeout
});

export const db = drizzle(client);
```

### Vector Search (pgvector)
```typescript
import { vector } from 'drizzle-orm/pg-core';

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
});
```

---

## Resilience Patterns

### Circuit Breaker (opossum)
```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(externalServiceCall, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});
```

### Graceful Shutdown
```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await server.close();
  await db.end();
  process.exit(0);
});
```

### Health Checks
```typescript
app.get('/health', (c) => c.json({ status: 'ok' }));
app.get('/ready', async (c) => {
  const dbOk = await checkDatabase();
  const redisOk = await checkRedis();
  return c.json({ database: dbOk, redis: redisOk });
});
```

---

## Security Considerations

1. **Input Validation**: Always validate with Zod before processing
2. **SQL Injection**: Use Drizzle ORM (parameterized queries)
3. **XSS**: React handles by default, sanitize markdown
4. **CORS**: Configure allowlist in production
5. **Rate Limiting**: Use `rate-limiter-flexible`
6. **Authentication**: JWT with refresh tokens
7. **Secrets**: Never commit, use environment variables

---

## Performance Guidelines

1. **Database**: Use indexes, avoid N+1 queries
2. **Caching**: Redis for frequently accessed data
3. **Streaming**: Use SSE for long-running AI responses
4. **Bundle Size**: Code-split frontend, tree-shake backend
5. **Connection Pooling**: Configure for your workload

---

**Last Updated**: December 2025
