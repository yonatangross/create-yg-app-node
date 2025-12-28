# Type-Safe Routing

## Basic Routes

```typescript
import { Hono } from "hono";

const app = new Hono();

// GET, POST, PUT, DELETE, PATCH
app.get("/users", (c) => c.json({ users: [] }));
app.post("/users", (c) => c.json({ created: true }, 201));
app.put("/users/:id", (c) => c.json({ updated: true }));
app.delete("/users/:id", (c) => c.body(null, 204));

// All methods
app.all("/webhook", (c) => c.json({ received: true }));
```

## Path Parameters

```typescript
// Single param
app.get("/users/:id", (c) => {
  const id = c.req.param("id"); // string
  return c.json({ id });
});

// Multiple params
app.get("/users/:userId/posts/:postId", (c) => {
  const { userId, postId } = c.req.param();
  return c.json({ userId, postId });
});

// Optional param
app.get("/posts/:id?", (c) => {
  const id = c.req.param("id"); // string | undefined
  if (!id) return c.json({ posts: [] });
  return c.json({ postId: id });
});

// Wildcard
app.get("/files/*", (c) => {
  const path = c.req.param("*"); // everything after /files/
  return c.json({ path });
});
```

## Query Parameters

```typescript
app.get("/search", (c) => {
  const query = c.req.query("q"); // string | undefined
  const page = c.req.query("page") || "1";

  // Multiple values
  const tags = c.req.queries("tag"); // string[] | undefined

  // All query params
  const all = c.req.query(); // Record<string, string>

  return c.json({ query, page, tags });
});
```

## Route Groups

```typescript
const app = new Hono();

// Group by path prefix
const api = new Hono();
api.get("/users", (c) => c.json({ users: [] }));
api.get("/posts", (c) => c.json({ posts: [] }));

app.route("/api/v1", api);
// Routes: /api/v1/users, /api/v1/posts
```

## Chained Routes

```typescript
const app = new Hono()
  .get("/users", (c) => c.json({ users: [] }))
  .post("/users", (c) => c.json({ created: true }))
  .get("/users/:id", (c) => c.json({ id: c.req.param("id") }));

// Export type for RPC client
export type AppType = typeof app;
```

## Type-Safe Routes with Generics

```typescript
type Env = {
  Variables: {
    user: { id: string; email: string };
  };
  Bindings: {
    DB: D1Database;
  };
};

const app = new Hono<Env>();

app.use("*", async (c, next) => {
  c.set("user", { id: "123", email: "user@example.com" });
  await next();
});

app.get("/me", (c) => {
  const user = c.get("user"); // Typed!
  return c.json(user);
});
```

## Request Body

```typescript
// JSON body
app.post("/users", async (c) => {
  const body = await c.req.json<{ email: string; name: string }>();
  return c.json({ email: body.email });
});

// Form data
app.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;
  const name = body.name as string;
  return c.json({ name, size: file?.size });
});

// Raw body
app.post("/webhook", async (c) => {
  const raw = await c.req.text();
  return c.json({ received: raw.length });
});
```

## Response Helpers

```typescript
app.get("/text", (c) => c.text("Hello"));
app.get("/json", (c) => c.json({ hello: "world" }));
app.get("/html", (c) => c.html("<h1>Hello</h1>"));
app.get("/redirect", (c) => c.redirect("/new-url"));
app.get("/notfound", (c) => c.notFound());
app.get("/empty", (c) => c.body(null, 204));

// With status
app.post("/users", (c) => c.json({ id: "1" }, 201));

// With headers
app.get("/custom", (c) => {
  return c.json({ data: "value" }, 200, {
    "X-Custom-Header": "value",
  });
});
```

## Regex Routes

```typescript
// Match UUIDs
app.get("/users/:id{[0-9a-f-]{36}}", (c) => {
  const id = c.req.param("id");
  return c.json({ uuid: id });
});

// Match numeric IDs
app.get("/posts/:id{[0-9]+}", (c) => {
  const id = parseInt(c.req.param("id"));
  return c.json({ numericId: id });
});
```

## Best Practices

1. **Chain routes** - Enables type inference for RPC client
2. **Export AppType** - Required for hc() client
3. **Use groups** - Organize by feature/version
4. **Validate params** - Use zValidator for runtime checks
5. **Type generics** - Define Env for variables/bindings
