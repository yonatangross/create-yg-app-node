# Performance Optimization

## Prepared Statements

```typescript
import { eq, placeholder } from "drizzle-orm";

// Prepare once
const getUserById = db.query.users
  .findFirst({
    where: eq(users.id, placeholder("id")),
    with: {
      posts: true,
    },
  })
  .prepare("get_user_by_id");

const getUserByEmail = db
  .select()
  .from(users)
  .where(eq(users.email, placeholder("email")))
  .prepare("get_user_by_email");

// Execute many times (faster!)
const user1 = await getUserById.execute({ id: "uuid-1" });
const user2 = await getUserById.execute({ id: "uuid-2" });
const user3 = await getUserByEmail.execute({ email: "test@example.com" });
```

## Connection Pooling

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if can't connect
});

// Monitor pool
pool.on("error", (err) => {
  console.error("Pool error:", err);
});

pool.on("connect", () => {
  console.log("New connection established");
});

export const db = drizzle(pool, { schema });
```

## Indexing Strategy

```typescript
import { pgTable, uuid, text, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Unique index for lookups
    emailIdx: uniqueIndex("users_email_idx").on(table.email),

    // Composite index for common query patterns
    statusCreatedIdx: index("users_status_created_idx").on(
      table.status,
      table.createdAt
    ),

    // Partial index (only active users)
    activeUsersIdx: index("users_active_idx")
      .on(table.email)
      .where(sql`status = 'active'`),
  })
);

// Check index usage
const explain = await db.execute(sql`
  EXPLAIN ANALYZE
  SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC
`);
```

## Query Optimization

```typescript
// BAD: N+1 queries
const users = await db.select().from(users);
for (const user of users) {
  const posts = await db.select().from(posts).where(eq(posts.authorId, user.id));
  user.posts = posts; // N+1 problem!
}

// GOOD: Single query with join
const usersWithPosts = await db.query.users.findMany({
  with: {
    posts: true,
  },
});

// GOOD: Select only needed columns
const userEmails = await db
  .select({ id: users.id, email: users.email })
  .from(users);

// NOT: select() which gets all columns

// BAD: Loading all data
const allUsers = await db.select().from(users);

// GOOD: Pagination
const pagedUsers = await db
  .select()
  .from(users)
  .limit(20)
  .offset(0);
```

## Batch Operations

```typescript
// BAD: Individual inserts
for (const user of usersToCreate) {
  await db.insert(users).values(user);
}

// GOOD: Batch insert
await db.insert(users).values(usersToCreate);

// With chunking for large batches
async function batchInsert<T>(
  table: any,
  data: T[],
  chunkSize = 1000
) {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await db.insert(table).values(chunk);
  }
}
```

## Caching Layer

```typescript
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

async function getCachedUser(id: string): Promise<User | null> {
  const cacheKey = `user:${id}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss - query database
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (user) {
    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(user));
  }

  return user;
}

// Invalidate on update
async function updateUser(id: string, data: UpdateUser) {
  const [user] = await db
    .update(users)
    .set(data)
    .where(eq(users.id, id))
    .returning();

  // Invalidate cache
  await redis.del(`user:${id}`);

  return user;
}
```

## Query Analysis

```typescript
// Analyze query performance
const result = await db.execute(sql`
  EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
  SELECT * FROM users
  WHERE email LIKE '%@company.com'
  ORDER BY created_at DESC
  LIMIT 100
`);

console.log(JSON.stringify(result.rows[0], null, 2));

// Common issues to look for:
// - Seq Scan on large tables (needs index)
// - High "Rows Removed by Filter" (index not selective enough)
// - Sort operations (add ORDER BY column to index)
```

## Monitoring Queries

```typescript
import { Logger } from "drizzle-orm";

const queryLogger: Logger = {
  logQuery(query: string, params: unknown[]) {
    const start = performance.now();
    console.log({
      query,
      params,
      timestamp: new Date().toISOString(),
    });
  },
};

export const db = drizzle(pool, {
  schema,
  logger: queryLogger,
});
```

## Best Practices

1. **Prepared statements** - Use for frequently-run queries
2. **Connection pooling** - Configure max connections appropriately
3. **Strategic indexes** - Index WHERE and ORDER BY columns
4. **Avoid N+1** - Use `with` for relations
5. **Select specific columns** - Don't fetch unused data
6. **Batch operations** - Insert/update in batches
7. **Cache hot data** - Redis for frequently accessed records
8. **Monitor slow queries** - Set up query logging
