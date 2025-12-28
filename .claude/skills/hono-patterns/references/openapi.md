# OpenAPI Integration

## Basic Setup

```typescript
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const app = new OpenAPIHono();

// Define schema with OpenAPI metadata
const UserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi("User");

const CreateUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1),
  })
  .openapi("CreateUser");
```

## Define Routes

```typescript
const getUserRoute = createRoute({
  method: "get",
  path: "/users/{id}",
  tags: ["Users"],
  summary: "Get user by ID",
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: "User ID" }),
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
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              code: z.string(),
              message: z.string(),
            }),
          }),
        },
      },
      description: "User not found",
    },
  },
});

const createUserRoute = createRoute({
  method: "post",
  path: "/users",
  tags: ["Users"],
  summary: "Create a new user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateUserSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ user: UserSchema }),
        },
      },
      description: "User created",
    },
    400: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              code: z.string(),
              message: z.string(),
              details: z.record(z.array(z.string())).optional(),
            }),
          }),
        },
      },
      description: "Validation error",
    },
  },
});
```

## Register Routes

```typescript
app.openapi(getUserRoute, async (c) => {
  const { id } = c.req.valid("param");
  const user = await db.findUser(id);

  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404
    );
  }

  return c.json({ user }, 200);
});

app.openapi(createUserRoute, async (c) => {
  const data = c.req.valid("json");
  const user = await db.createUser(data);
  return c.json({ user }, 201);
});
```

## Serve OpenAPI Spec

```typescript
// JSON spec
app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "My API",
    version: "1.0.0",
    description: "API documentation",
  },
  servers: [
    { url: "http://localhost:3000", description: "Development" },
    { url: "https://api.example.com", description: "Production" },
  ],
});

// YAML spec
app.doc("/doc.yaml", {
  openapi: "3.1.0",
  info: { title: "My API", version: "1.0.0" },
});
```

## Swagger UI

```typescript
import { swaggerUI } from "@hono/swagger-ui";

app.get("/docs", swaggerUI({ url: "/doc" }));
```

## Security Schemes

```typescript
const app = new OpenAPIHono();

// Register security scheme
app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

// Protected route
const protectedRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["Auth"],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ user: UserSchema }),
        },
      },
      description: "Current user",
    },
    401: {
      description: "Unauthorized",
    },
  },
});
```

## Pagination Pattern

```typescript
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

const listUsersRoute = createRoute({
  method: "get",
  path: "/users",
  tags: ["Users"],
  request: {
    query: PaginationSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PaginatedResponseSchema(UserSchema),
        },
      },
      description: "List of users",
    },
  },
});
```

## Error Responses

```typescript
const ErrorSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    }),
  })
  .openapi("Error");

// Reusable error responses
const errorResponses = {
  400: {
    content: { "application/json": { schema: ErrorSchema } },
    description: "Bad Request",
  },
  401: {
    content: { "application/json": { schema: ErrorSchema } },
    description: "Unauthorized",
  },
  404: {
    content: { "application/json": { schema: ErrorSchema } },
    description: "Not Found",
  },
  500: {
    content: { "application/json": { schema: ErrorSchema } },
    description: "Internal Server Error",
  },
};

// Use in routes
const route = createRoute({
  method: "get",
  path: "/resource",
  responses: {
    200: { ... },
    ...errorResponses,
  },
});
```

## Best Practices

1. **Use .openapi()** - Add OpenAPI metadata to schemas
2. **Tags** - Group related endpoints
3. **Examples** - Add example values to schemas
4. **Error schemas** - Consistent error response format
5. **Security** - Document auth requirements
6. **Versioning** - Use path prefix `/v1/`
