# RPC Client (hc)

## Basic Setup

```typescript
// Backend - export the app type
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const app = new Hono()
  .get("/users", async (c) => {
    const users = await db.findUsers();
    return c.json({ users });
  })
  .get("/users/:id", async (c) => {
    const id = c.req.param("id");
    const user = await db.findUser(id);
    return c.json({ user });
  })
  .post(
    "/users",
    zValidator("json", z.object({
      email: z.string().email(),
      name: z.string(),
    })),
    async (c) => {
      const data = c.req.valid("json");
      const user = await db.createUser(data);
      return c.json({ user }, 201);
    }
  );

export type AppType = typeof app;
export default app;
```

```typescript
// Frontend - import type and create client
import { hc } from "hono/client";
import type { AppType } from "@backend/app";

const client = hc<AppType>("http://localhost:3000");

// Full autocomplete and type checking!
async function example() {
  // GET /users
  const res = await client.users.$get();
  const { users } = await res.json();

  // GET /users/:id
  const userRes = await client.users[":id"].$get({
    param: { id: "123" },
  });
  const { user } = await userRes.json();

  // POST /users
  const createRes = await client.users.$post({
    json: { email: "test@example.com", name: "Test" },
  });
  const { user: newUser } = await createRes.json();
}
```

## Query Parameters

```typescript
// Backend
app.get(
  "/search",
  zValidator("query", z.object({
    q: z.string(),
    page: z.coerce.number().default(1),
  })),
  async (c) => {
    const { q, page } = c.req.valid("query");
    return c.json({ results: [], page });
  }
);

// Frontend
const res = await client.search.$get({
  query: { q: "hello", page: "1" },
});
```

## Headers

```typescript
// Frontend - add headers
const client = hc<AppType>("http://localhost:3000", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Per-request headers
const res = await client.users.$get({
  headers: {
    "X-Custom-Header": "value",
  },
});
```

## Error Handling

```typescript
async function fetchUsers() {
  const res = await client.users.$get();

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message);
  }

  return res.json();
}

// With try-catch
try {
  const { users } = await fetchUsers();
} catch (error) {
  console.error("Failed to fetch users:", error);
}
```

## React Query Integration

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hc } from "hono/client";
import type { AppType } from "@backend/app";

const client = hc<AppType>("/api");

// Queries
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await client.users.$get();
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: async () => {
      const res = await client.users[":id"].$get({ param: { id } });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!id,
  });
}

// Mutations
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; name: string }) => {
      const res = await client.users.$post({ json: data });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
```

## Streaming with EventSource

```typescript
// Backend
import { streamSSE } from "hono/streaming";

app.get("/events", async (c) => {
  return streamSSE(c, async (stream) => {
    for (let i = 0; i < 10; i++) {
      await stream.writeSSE({
        event: "message",
        data: JSON.stringify({ count: i }),
      });
      await stream.sleep(1000);
    }
  });
});

// Frontend - use native EventSource
function subscribeToEvents() {
  const eventSource = new EventSource("/api/events");

  eventSource.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);
    console.log("Received:", data);
  });

  eventSource.onerror = () => {
    eventSource.close();
  };

  return () => eventSource.close();
}
```

## Custom Fetch

```typescript
// Custom fetch with interceptors
const customFetch: typeof fetch = async (input, init) => {
  // Add auth token
  const token = localStorage.getItem("token");
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  // Handle 401
  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return response;
};

const client = hc<AppType>("http://localhost:3000", {
  fetch: customFetch,
});
```

## Monorepo Setup

```typescript
// packages/shared/src/api-types.ts
export type { AppType } from "@backend/src/app";

// packages/frontend/src/api/client.ts
import { hc } from "hono/client";
import type { AppType } from "@shared/api-types";

export const api = hc<AppType>(import.meta.env.VITE_API_URL);
```

## Best Practices

1. **Chain routes** - Required for type inference
2. **Export AppType** - Single source of truth
3. **Use relative URL** - `/api` for same-origin
4. **React Query** - Combine for caching/revalidation
5. **Error handling** - Check `res.ok` before parsing
6. **Custom fetch** - Add auth, logging, retries
