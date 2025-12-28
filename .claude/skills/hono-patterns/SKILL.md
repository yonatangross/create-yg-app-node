---
name: hono-patterns
description: Use this skill when building APIs with Hono 4.11. Provides Web Standards-first patterns, middleware composition, type-safe routing, and edge-ready architecture.
version: 1.0.0
author: YG Node Starter
tags: [hono, api, backend, typescript, web-standards]
---

# Hono 4.11 Patterns (December 2025)

> **Version**: hono 4.11.3 | Node.js 22

## Why Hono

- **Web Standards-first** - Uses Request/Response, works everywhere
- **TypeScript-native** - Full type inference for routes and handlers
- **Ultra-fast** - 7kb, faster than Express, Fastify
- **Edge-ready** - Runs on Node, Deno, Bun, Cloudflare Workers, Vercel

## Basic Setup

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/", (c) => c.text("Hello Hono!"));

serve({ fetch: app.fetch, port: 3000 });
```

## Type-Safe Routing with RPC

```typescript
import { Hono } from "hono";
import { hc } from "hono/client";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

// Backend route definition
const app = new Hono()
  .get("/users", async (c) => {
    const users = await db.select().from(usersTable);
    return c.json({ users });
  })
  .get("/users/:id", async (c) => {
    const id = c.req.param("id");
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return c.json({ user });
  })
  .post(
    "/users",
    zValidator("json", z.object({
      email: z.string().email(),
      name: z.string().min(1),
    })),
    async (c) => {
      const data = c.req.valid("json");
      const user = await db.insert(usersTable).values(data).returning();
      return c.json({ user }, 201);
    }
  );

export type AppType = typeof app;

// Frontend client (type-safe!)
import type { AppType } from "@backend/app";

const client = hc<AppType>("http://localhost:3000");

// Full autocomplete and type checking
const res = await client.users.$get();
const { users } = await res.json();
```

## Middleware Composition

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { compress } from "hono/compress";
import { rateLimiter } from "hono-rate-limiter";

const app = new Hono();

// Global middleware
app.use("*", timing());
app.use("*", secureHeaders());
app.use("*", compress());
app.use("*", cors({ origin: ["http://localhost:5173"] }));
app.use("*", logger());

// Route-specific middleware
app.use("/api/*", rateLimiter({
  windowMs: 60 * 1000,
  limit: 100,
  keyGenerator: (c) => c.req.header("x-forwarded-for") || "unknown",
}));
```

## Error Handling

```typescript
import { HTTPException } from "hono/http-exception";

// Custom error handler
app.onError((err, c) => {
  const requestId = c.get("requestId");

  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: {
        code: err.status.toString(),
        message: err.message,
      },
      meta: { requestId },
    }, err.status);
  }

  // Log unexpected errors
  logger.error({ err, requestId }, "Unhandled error");

  return c.json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
    meta: { requestId },
  }, 500);
});

// Throw in handlers
app.get("/users/:id", async (c) => {
  const user = await findUser(c.req.param("id"));
  if (!user) {
    throw new HTTPException(404, { message: "User not found" });
  }
  return c.json({ user });
});
```

## Context Variables (Type-Safe)

```typescript
import { Hono } from "hono";

// Define context types
type Variables = {
  requestId: string;
  userId: string | null;
  db: Database;
};

const app = new Hono<{ Variables: Variables }>();

// Set in middleware
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  c.set("db", database);
  await next();
});

// Access in handlers (fully typed)
app.get("/me", (c) => {
  const userId = c.get("userId"); // string | null
  const db = c.get("db"); // Database
  // ...
});
```

## OpenAPI with Zod

```typescript
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "zod";

const app = new OpenAPIHono();

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
}).openapi("User");

const route = createRoute({
  method: "get",
  path: "/users/{id}",
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ user: UserSchema }),
        },
      },
      description: "User found",
    },
    404: {
      description: "User not found",
    },
  },
});

app.openapi(route, async (c) => {
  const { id } = c.req.valid("param");
  const user = await findUser(id);
  return c.json({ user });
});

// Serve OpenAPI spec
app.doc("/doc", {
  openapi: "3.1.0",
  info: { title: "My API", version: "1.0.0" },
});
```

## Streaming with SSE

```typescript
import { streamSSE } from "hono/streaming";

app.get("/events", async (c) => {
  return streamSSE(c, async (stream) => {
    let id = 0;
    while (true) {
      await stream.writeSSE({
        id: String(id++),
        event: "message",
        data: JSON.stringify({ time: Date.now() }),
      });
      await stream.sleep(1000);
    }
  });
});
```

## File Uploads

```typescript
import { Hono } from "hono";

app.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    throw new HTTPException(400, { message: "No file provided" });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.writeFile(`./uploads/${file.name}`, buffer);

  return c.json({
    filename: file.name,
    size: file.size,
    type: file.type,
  });
});
```

## Best Practices

1. **Use zValidator** - Runtime validation with Zod
2. **Export types** - Enable RPC client with `export type AppType`
3. **Compose middleware** - Stack in logical order
4. **Context variables** - Type-safe shared state
5. **HTTPException** - Consistent error responses
6. **OpenAPI** - Auto-generate docs with @hono/zod-openapi
