---
name: drizzle-production
description: Use this skill for database operations with Drizzle ORM 0.45. Provides type-safe SQL patterns, migrations, and production database architecture.
version: 1.0.0
author: YG Node Starter
tags: [drizzle, database, orm, postgresql, typescript]
---

# Drizzle ORM 0.45 Patterns (December 2025)

> **Version**: drizzle-orm 0.45.1 | drizzle-kit 0.30.x | PostgreSQL 16

## Why Drizzle

- **SQL-like syntax** - If you know SQL, you know Drizzle
- **Type-safe** - Full TypeScript inference from schema
- **7kb bundle** - Smallest ORM, no runtime overhead
- **Zero dependencies** - No hidden surprises
- **Serverless-ready** - Works with any driver

## Schema Definition

```typescript
// db/schema.ts
import { pgTable, uuid, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
}));

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  authorIdx: index("posts_author_idx").on(table.authorId),
}));

// Relations (for query builder)
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

## Database Connection

```typescript
// db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
```

## CRUD Operations

```typescript
import { eq, and, or, like, desc, asc, sql } from "drizzle-orm";
import { db } from "./db";
import { users, posts } from "./db/schema";

// Create
const newUser = await db.insert(users)
  .values({
    email: "user@example.com",
    name: "John Doe",
    passwordHash: await hash(password),
  })
  .returning();

// Read - single
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: true,
  },
});

// Read - multiple with filters
const activeUsers = await db.query.users.findMany({
  where: and(
    eq(users.isActive, true),
    like(users.email, "%@company.com")
  ),
  orderBy: [desc(users.createdAt)],
  limit: 10,
  offset: 0,
});

// Update
const updated = await db.update(users)
  .set({
    name: "Jane Doe",
    updatedAt: new Date(),
  })
  .where(eq(users.id, userId))
  .returning();

// Delete
await db.delete(users)
  .where(eq(users.id, userId));
```

## Advanced Queries

```typescript
// Select with joins (SQL-like)
const postsWithAuthors = await db
  .select({
    postId: posts.id,
    postTitle: posts.title,
    authorName: users.name,
    authorEmail: users.email,
  })
  .from(posts)
  .leftJoin(users, eq(posts.authorId, users.id))
  .where(sql`${posts.publishedAt} IS NOT NULL`)
  .orderBy(desc(posts.createdAt));

// Aggregations
const stats = await db
  .select({
    authorId: posts.authorId,
    postCount: sql<number>`count(*)::int`,
    totalViews: sql<number>`sum(${posts.viewCount})::int`,
  })
  .from(posts)
  .groupBy(posts.authorId)
  .having(sql`count(*) > 5`);

// Subqueries
const usersWithPostCount = await db
  .select({
    ...users,
    postCount: sql<number>`(
      SELECT count(*) FROM ${posts}
      WHERE ${posts.authorId} = ${users.id}
    )::int`,
  })
  .from(users);
```

## Transactions

```typescript
import { db } from "./db";

// Automatic rollback on error
const result = await db.transaction(async (tx) => {
  const user = await tx.insert(users)
    .values({ email, name, passwordHash })
    .returning();

  await tx.insert(posts)
    .values({
      authorId: user[0].id,
      title: "Welcome Post",
      content: "Hello world!",
    });

  return user[0];
});

// Nested transactions with savepoints
await db.transaction(async (tx) => {
  await tx.insert(users).values({ ... });

  try {
    await tx.transaction(async (tx2) => {
      await tx2.insert(posts).values({ ... });
      throw new Error("Rollback inner");
    });
  } catch {
    // Inner transaction rolled back, outer continues
  }
});
```

## Prepared Statements

```typescript
import { eq, placeholder } from "drizzle-orm";

// Prepare once, execute many times (performance optimization)
const getUserById = db.query.users.findFirst({
  where: eq(users.id, placeholder("id")),
}).prepare("get_user_by_id");

// Execute
const user = await getUserById.execute({ id: "uuid-here" });
```

## Migrations

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

```bash
# Generate migration
pnpm drizzle-kit generate

# Apply migration
pnpm drizzle-kit migrate

# Push schema directly (dev only)
pnpm drizzle-kit push

# Open Drizzle Studio
pnpm drizzle-kit studio
```

## Type Inference

```typescript
import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { users, posts } from "./schema";

// Infer types from schema
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Post = InferSelectModel<typeof posts>;
export type NewPost = InferInsertModel<typeof posts>;

// Use in functions
async function createUser(data: NewUser): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}
```

## Best Practices

1. **Use relations** - Enable `.with()` for eager loading
2. **Prepare statements** - For frequently-used queries
3. **Index strategically** - Define in schema, not afterthought
4. **Transaction for multi-ops** - Ensure data consistency
5. **Type inference** - Use `InferSelectModel` over manual types
6. **Soft deletes** - Add `deletedAt` column, filter in queries
