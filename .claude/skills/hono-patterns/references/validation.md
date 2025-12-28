# Zod Validation

## Basic Validation

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const app = new Hono();

// JSON body validation
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).optional(),
});

app.post(
  "/users",
  zValidator("json", createUserSchema),
  async (c) => {
    const data = c.req.valid("json"); // Fully typed!
    // data: { email: string; name: string; age?: number }
    return c.json({ user: data }, 201);
  }
);
```

## Validation Targets

```typescript
// Query parameters
const searchSchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

app.get(
  "/search",
  zValidator("query", searchSchema),
  (c) => {
    const { q, page, limit } = c.req.valid("query");
    return c.json({ q, page, limit });
  }
);

// Path parameters
const userParamsSchema = z.object({
  id: z.string().uuid(),
});

app.get(
  "/users/:id",
  zValidator("param", userParamsSchema),
  (c) => {
    const { id } = c.req.valid("param");
    return c.json({ id });
  }
);

// Headers
const authHeaderSchema = z.object({
  authorization: z.string().regex(/^Bearer .+/),
});

app.get(
  "/protected",
  zValidator("header", authHeaderSchema),
  (c) => {
    const { authorization } = c.req.valid("header");
    return c.json({ token: authorization.replace("Bearer ", "") });
  }
);

// Form data
const uploadSchema = z.object({
  name: z.string(),
  file: z.instanceof(File),
});

app.post(
  "/upload",
  zValidator("form", uploadSchema),
  async (c) => {
    const { name, file } = c.req.valid("form");
    return c.json({ name, size: file.size });
  }
);
```

## Multiple Validators

```typescript
app.put(
  "/users/:id",
  zValidator("param", z.object({ id: z.string().uuid() })),
  zValidator("json", z.object({ name: z.string().min(1) })),
  async (c) => {
    const { id } = c.req.valid("param");
    const { name } = c.req.valid("json");
    return c.json({ id, name });
  }
);
```

## Custom Error Handling

```typescript
app.post(
  "/users",
  zValidator("json", createUserSchema, (result, c) => {
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return c.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: errors,
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const data = c.req.valid("json");
    return c.json({ user: data });
  }
);
```

## Reusable Schemas

```typescript
// schemas/user.ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
});

export const createUserSchema = userSchema.pick({
  email: true,
  name: true,
});

export const updateUserSchema = userSchema
  .pick({ name: true })
  .partial();

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
```

## Pagination Schema

```typescript
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type Pagination = z.infer<typeof paginationSchema>;

// Usage
app.get(
  "/users",
  zValidator("query", paginationSchema),
  async (c) => {
    const pagination = c.req.valid("query");
    const users = await db.findUsers(pagination);
    return c.json({ users, pagination });
  }
);
```

## Transform and Refine

```typescript
const loginSchema = z
  .object({
    email: z.string().email().toLowerCase(), // Transform
    password: z.string().min(8),
  })
  .refine(
    (data) => !data.password.toLowerCase().includes(data.email.split("@")[0]),
    {
      message: "Password cannot contain your email username",
      path: ["password"],
    }
  );

// Preprocessing
const searchSchema = z.object({
  tags: z.preprocess(
    (val) => (typeof val === "string" ? val.split(",") : val),
    z.array(z.string())
  ),
});
```

## Async Validation

```typescript
const uniqueEmailSchema = z.object({
  email: z
    .string()
    .email()
    .refine(
      async (email) => {
        const exists = await db.userExists(email);
        return !exists;
      },
      { message: "Email already registered" }
    ),
});

app.post(
  "/register",
  zValidator("json", uniqueEmailSchema),
  async (c) => {
    // Email is guaranteed unique here
    const { email } = c.req.valid("json");
    return c.json({ email });
  }
);
```

## Best Practices

1. **Use .coerce** for query/param numbers - They come as strings
2. **Set defaults** - Reduce null checks in handlers
3. **Export types** - `z.infer<typeof schema>` for type reuse
4. **Custom error handler** - Consistent error format
5. **Separate schema files** - Reusable across routes
6. **Validate everything** - Params, query, body, headers
