# Middleware Composition

## Middleware Basics

```typescript
import { Hono } from "hono";

const app = new Hono();

// Simple middleware
app.use("*", async (c, next) => {
  console.log("Before");
  await next();
  console.log("After");
});

// Path-specific middleware
app.use("/api/*", async (c, next) => {
  // Only runs for /api/* routes
  await next();
});
```

## Built-in Middleware

```typescript
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { compress } from "hono/compress";
import { etag } from "hono/etag";
import { csrf } from "hono/csrf";
import { prettyJSON } from "hono/pretty-json";

const app = new Hono();

// Order matters! Apply in logical sequence
app.use("*", timing()); // Add Server-Timing header
app.use("*", secureHeaders()); // Security headers
app.use("*", compress()); // Gzip/deflate responses
app.use("*", etag()); // Add ETag for caching
app.use("*", logger()); // Request logging

// CORS configuration
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "https://myapp.com"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["X-Request-Id"],
    credentials: true,
    maxAge: 86400,
  })
);

// CSRF protection
app.use(
  "/api/*",
  csrf({
    origin: ["http://localhost:5173"],
  })
);

// Pretty JSON in development
if (process.env.NODE_ENV === "development") {
  app.use("*", prettyJSON());
}
```

## Rate Limiting

```typescript
import { rateLimiter } from "hono-rate-limiter";

// Basic rate limiting
app.use(
  "/api/*",
  rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    limit: 100, // 100 requests per window
    keyGenerator: (c) => {
      return (
        c.req.header("x-forwarded-for") ||
        c.req.header("x-real-ip") ||
        "unknown"
      );
    },
    handler: (c) => {
      return c.json({ error: "Too many requests" }, 429);
    },
  })
);

// Stricter limit for auth endpoints
app.use(
  "/api/auth/*",
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5,
    keyGenerator: (c) => c.req.header("x-forwarded-for") || "unknown",
  })
);
```

## Authentication Middleware

```typescript
import { jwt } from "hono/jwt";
import { bearerAuth } from "hono/bearer-auth";

// JWT authentication
app.use(
  "/api/*",
  jwt({
    secret: process.env.JWT_SECRET!,
  })
);

// Access JWT payload
app.get("/api/me", (c) => {
  const payload = c.get("jwtPayload");
  return c.json({ userId: payload.sub });
});

// Simple bearer token
app.use(
  "/admin/*",
  bearerAuth({
    token: process.env.ADMIN_TOKEN!,
  })
);
```

## Custom Authentication

```typescript
import { createMiddleware } from "hono/factory";

type AuthEnv = {
  Variables: {
    user: { id: string; email: string; role: string };
  };
};

const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const user = await verifyToken(token);
    c.set("user", user);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Role-based access
const requireRole = (role: string) => {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get("user");
    if (user.role !== role) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
};

// Usage
app.use("/api/*", authMiddleware);
app.use("/admin/*", requireRole("admin"));
```

## Request ID Middleware

```typescript
const requestIdMiddleware = createMiddleware(async (c, next) => {
  const requestId =
    c.req.header("x-request-id") || crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
});

app.use("*", requestIdMiddleware);
```

## Error Handling Middleware

```typescript
import { HTTPException } from "hono/http-exception";

// Must be registered AFTER routes
app.onError((err, c) => {
  const requestId = c.get("requestId");

  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: { code: String(err.status), message: err.message },
        meta: { requestId },
      },
      err.status
    );
  }

  // Log unexpected errors
  console.error({ err, requestId }, "Unhandled error");

  return c.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
      meta: { requestId },
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: "Resource not found" },
    },
    404
  );
});
```

## Middleware Order

```typescript
// Recommended order:
app.use("*", timing()); // 1. Timing (outermost)
app.use("*", requestIdMiddleware); // 2. Request ID
app.use("*", secureHeaders()); // 3. Security headers
app.use("*", compress()); // 4. Compression
app.use("*", cors()); // 5. CORS
app.use("*", logger()); // 6. Logging
app.use("/api/*", rateLimiter()); // 7. Rate limiting
app.use("/api/*", authMiddleware); // 8. Authentication

// Then routes...
app.get("/api/users", handler);
```

## Best Practices

1. **Order matters** - Security before logging before auth
2. **Path specificity** - Use `/api/*` not `*` for API middleware
3. **Type generics** - Define `Env` for typed variables
4. **Factory function** - Use `createMiddleware` for typed middleware
5. **Error boundaries** - `onError` catches all unhandled errors
