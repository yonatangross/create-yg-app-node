---
name: api-design-framework
description: Use this skill when designing REST APIs with Hono. Provides comprehensive API design patterns, error handling conventions, authentication approaches, and OpenAPI templates for Node.js/TypeScript backends.
version: 1.0.0
author: YG Node Starter
tags: [api, rest, hono, backend, typescript]
---

# API Design Framework (Node.js/Hono)

## Overview

This skill provides comprehensive guidance for designing robust, scalable REST APIs using Hono and TypeScript.

**When to use this skill:**
- Designing new API endpoints
- Establishing API conventions
- Reviewing API designs for consistency
- Creating API documentation

## Hono Route Patterns

### Basic Route Structure
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const users = new Hono();

// GET - List resources
users.get('/', async (c) => {
  const { limit, offset } = c.req.query();
  const users = await userService.findAll({ limit, offset });
  return c.json({ data: users, meta: { total: users.length } });
});

// GET - Single resource
users.get('/:id', async (c) => {
  const user = await userService.findById(c.req.param('id'));
  if (!user) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }
  return c.json({ data: user });
});

// POST - Create resource
const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
});

users.post('/', zValidator('json', createSchema), async (c) => {
  const data = c.req.valid('json');
  const user = await userService.create(data);
  return c.json({ data: user }, 201);
});

// PUT - Update resource
users.put('/:id', zValidator('json', updateSchema), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json');
  const user = await userService.update(id, data);
  return c.json({ data: user });
});

// DELETE - Remove resource
users.delete('/:id', async (c) => {
  await userService.delete(c.req.param('id'));
  return c.json({ success: true });
});

export { users };
```

## Response Format Standards

### Success Response
```typescript
// Single resource
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}

// Collection
{
  "data": [...],
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

### Error Response
```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## Zod Validation Patterns

### Request Schemas
```typescript
// Create schema
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['user', 'admin']).default('user'),
});

// Update schema (all optional)
export const updateUserSchema = createUserSchema.partial();

// Query params schema
export const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  sort: z.enum(['createdAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Path params schema
export const idParamSchema = z.object({
  id: z.string().uuid(),
});
```

## Error Handling

### Custom Error Classes
```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
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
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}
```

### Global Error Handler
```typescript
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    }, err.statusCode as StatusCode);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
      },
    }, 400);
  }

  // Unknown errors
  console.error(err);
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }, 500);
});
```

## Authentication Middleware

### JWT Authentication
```typescript
import { jwt } from 'hono/jwt';

// Protect routes
app.use('/api/*', jwt({ secret: process.env.JWT_SECRET }));

// Access payload
app.get('/api/me', (c) => {
  const payload = c.get('jwtPayload');
  return c.json({ userId: payload.sub });
});
```

### Custom Auth Middleware
```typescript
export const requireAuth = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new UnauthorizedError('Missing token');
  }

  try {
    const payload = await verifyToken(token);
    c.set('user', payload);
    await next();
  } catch {
    throw new UnauthorizedError('Invalid token');
  }
});
```

## Rate Limiting

```typescript
import { rateLimiter } from 'hono-rate-limiter';

app.use('/api/*', rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: true,
  keyGenerator: (c) => {
    return c.req.header('x-forwarded-for') || 'unknown';
  },
  handler: (c) => {
    return c.json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
      },
    }, 429);
  },
}));
```

## OpenAPI Documentation

```typescript
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const app = new OpenAPIHono();

const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
    }),
  },
  responses: {
    200: {
      description: 'User found',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
  },
});

app.openapi(route, (c) => {
  const { id } = c.req.valid('param');
  // ...
});

app.doc('/doc', { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' } });
app.get('/ui', swaggerUI({ url: '/doc' }));
```

## Hono RPC (End-to-End Type Safety)

### Server Setup
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

/**
 * Export route types for RPC client
 * The 'as const' chain ensures proper type inference
 */
const users = new Hono()
  .get('/', async (c) => {
    const users = await userService.findAll();
    return c.json({ data: users });
  })
  .get('/:id', async (c) => {
    const user = await userService.findById(c.req.param('id'));
    return c.json({ data: user });
  })
  .post(
    '/',
    zValidator('json', z.object({
      email: z.string().email(),
      name: z.string().min(2),
    })),
    async (c) => {
      const data = c.req.valid('json');
      const user = await userService.create(data);
      return c.json({ data: user }, 201);
    }
  );

// Mount and export type
const app = new Hono().route('/api/users', users);

export type AppType = typeof app;
export { app };
```

### Client Setup (Frontend)
```typescript
import { hc } from 'hono/client';
import type { AppType } from '@backend/index';

/**
 * Create type-safe API client
 * All methods are fully typed from server definitions
 */
const client = hc<AppType>('http://localhost:3000');

// Fully typed API calls
const response = await client.api.users.$get();
const { data } = await response.json();
// data is typed as User[]

// POST with typed body
const createResponse = await client.api.users.$post({
  json: { email: 'user@example.com', name: 'John' },
});
// TypeScript error if body doesn't match schema
```

### Type Export Pattern
```typescript
// backend/src/index.ts
import { Hono } from 'hono';
import { users } from './routes/users.js';
import { chat } from './routes/chat.js';

const app = new Hono()
  .route('/api/users', users)
  .route('/api/chat', chat);

// Export both app and type
export type AppType = typeof app;
export default app;

// frontend/src/lib/api.ts
import { hc } from 'hono/client';
import type { AppType } from '../../backend/src/index.js';

export const api = hc<AppType>(import.meta.env.VITE_API_URL);
```

### With TanStack Query
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Typed queries
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.api.users.$get();
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });
}

// Typed mutations
export function useCreateUser() {
  return useMutation({
    mutationFn: async (data: { email: string; name: string }) => {
      const res = await api.api.users.$post({ json: data });
      if (!res.ok) throw new Error('Failed to create user');
      return res.json();
    },
  });
}
```

### Streaming with RPC
```typescript
// Server
const chat = new Hono()
  .get('/stream', async (c) => {
    return streamSSE(c, async (stream) => {
      for await (const chunk of llmStream) {
        await stream.writeSSE({ data: JSON.stringify(chunk) });
      }
    });
  });

// Client
const response = await api.api.chat.stream.$get();
const reader = response.body?.getReader();
// Process SSE stream...
```

## Best Practices

1. **Use Zod for all input validation** - Never trust client data
2. **Consistent error format** - Always return `{ error: { code, message } }`
3. **HTTP status codes** - Use appropriate codes (200, 201, 400, 401, 404, 500)
4. **Pagination** - Always paginate list endpoints
5. **Versioning** - Use URL versioning (`/api/v1/...`)
6. **Rate limiting** - Protect all public endpoints
7. **Request IDs** - Add correlation IDs for debugging
8. **Hono RPC** - Export types for end-to-end type safety with frontend
9. **Method chaining** - Chain route definitions for proper type inference
