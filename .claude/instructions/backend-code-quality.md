# Backend Code Quality Rules (Node.js/TypeScript)

## Pre-Commit Checklist

Before any commit, ensure ALL checks pass:

```bash
# Run all checks
pnpm run check

# Individual checks
pnpm run format:check   # Prettier formatting
pnpm run lint           # ESLint
pnpm run typecheck      # TypeScript (tsc --noEmit)
pnpm run test:run       # Vitest
```

---

## TypeScript Standards

### Strict Mode Required
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Type Annotations
```typescript
// ✅ Good - Explicit return types for public functions
export function createUser(data: CreateUserInput): Promise<User> {
  // ...
}

// ❌ Bad - Implicit any
function process(data) {
  // ...
}

// ✅ Good - Type imports
import type { User } from './types';

// ✅ Good - Zod inference
const schema = z.object({ name: z.string() });
type Input = z.infer<typeof schema>;
```

### No `any` Types
```typescript
// ❌ Bad
function handleError(error: any) {}

// ✅ Good
function handleError(error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

---

## Hono Patterns

### Route Organization
```typescript
// routes/users.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

const users = new Hono();

users.get('/', async (c) => {
  const users = await userService.findAll();
  return c.json({ data: users });
});

users.post('/', zValidator('json', createUserSchema), async (c) => {
  const data = c.req.valid('json');
  const user = await userService.create(data);
  return c.json({ data: user }, 201);
});

export { users };
```

### Error Handling
```typescript
import { HTTPException } from 'hono/http-exception';

// Throw typed errors
if (!user) {
  throw new HTTPException(404, { message: 'User not found' });
}

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: { message: err.message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { message: 'Internal server error' } }, 500);
});
```

### Middleware
```typescript
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

app.use('*', logger());
app.use('/api/*', cors({ origin: ['http://localhost:4173'] }));
```

---

## Drizzle Patterns

### Schema Definition
```typescript
// db/schema/users.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### Queries
```typescript
// ✅ Good - Type-safe queries
const user = await db.query.users.findFirst({
  where: eq(users.id, id),
});

// ✅ Good - Transactions
await db.transaction(async (tx) => {
  await tx.insert(users).values(userData);
  await tx.insert(profiles).values(profileData);
});
```

---

## Error Handling

### Custom Error Classes
```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}
```

### Service Layer
```typescript
// services/userService.ts
export async function findById(id: string): Promise<User> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!user) {
    throw new NotFoundError('User');
  }

  return user;
}
```

---

## Logging

### Structured Logging with Pino
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});

// Usage
logger.info({ userId: user.id }, 'User created');
logger.error({ err, requestId }, 'Failed to process request');
```

### Request Logging
```typescript
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  });
});
```

---

## Testing Standards

### Test File Location
```
src/
├── routes/
│   ├── users.ts
│   └── users.test.ts    # Co-located tests
├── services/
│   ├── userService.ts
│   └── userService.test.ts
```

### Test Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const user = await userService.findById('123');
      expect(user).toBeDefined();
      expect(user.id).toBe('123');
    });

    it('throws NotFoundError when user does not exist', async () => {
      await expect(userService.findById('999'))
        .rejects
        .toThrow(NotFoundError);
    });
  });
});
```

### Mocking
```typescript
import { vi } from 'vitest';

// Mock module
vi.mock('./db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));
```

---

## Security Rules

1. **Never log sensitive data** (passwords, tokens, PII)
2. **Validate all inputs** with Zod before processing
3. **Use parameterized queries** (Drizzle handles this)
4. **Set secure headers** (use Hono's `secureHeaders` middleware)
5. **Rate limit public endpoints**
6. **Sanitize error messages** in production

---

## Performance Guidelines

1. **Connection pooling**: Configure postgres.js pool size
2. **Avoid N+1**: Use Drizzle's `with` for relations
3. **Index queries**: Add indexes for frequently filtered columns
4. **Stream responses**: Use SSE for AI/LLM output
5. **Cache appropriately**: Redis for session, frequent data

---

**Last Updated**: December 2025
