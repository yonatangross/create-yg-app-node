# Transactions

## Basic Transaction

```typescript
import { db } from "./db";

const result = await db.transaction(async (tx) => {
  // All operations use the transaction connection
  const [user] = await tx
    .insert(users)
    .values({ email: "test@example.com", name: "Test" })
    .returning();

  await tx.insert(profiles).values({
    userId: user.id,
    bio: "Hello!",
  });

  return user;
});
// Automatically commits if no error
// Automatically rolls back if any error is thrown
```

## Transaction with Rollback

```typescript
try {
  const result = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ ... }).returning();

    // Check some business logic
    if (await isDuplicateEmail(tx, user.email)) {
      throw new Error("Email already exists");
    }

    await tx.insert(audit).values({
      action: "user_created",
      userId: user.id,
    });

    return user;
  });
} catch (error) {
  // Transaction was rolled back
  console.error("Transaction failed:", error);
}
```

## Nested Transactions (Savepoints)

```typescript
await db.transaction(async (tx) => {
  // Outer transaction
  await tx.insert(users).values({ ... });

  try {
    await tx.transaction(async (tx2) => {
      // Inner transaction (savepoint)
      await tx2.insert(posts).values({ ... });

      if (someCondition) {
        throw new Error("Rollback inner only");
      }
    });
  } catch (error) {
    // Inner transaction rolled back to savepoint
    // Outer transaction continues
    console.log("Inner rolled back, continuing outer");
  }

  // This still commits
  await tx.insert(audit).values({ action: "partial_success" });
});
```

## Read-Only Transaction

```typescript
// For consistent reads across multiple queries
const { user, posts, comments } = await db.transaction(async (tx) => {
  const user = await tx.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const posts = await tx.query.posts.findMany({
    where: eq(posts.authorId, userId),
  });

  const comments = await tx.query.comments.findMany({
    where: eq(comments.authorId, userId),
  });

  return { user, posts, comments };
});
```

## Transaction Isolation Levels

```typescript
// Serializable (strongest)
await db.transaction(
  async (tx) => {
    // Critical financial operations
  },
  { isolationLevel: "serializable" }
);

// Repeatable Read
await db.transaction(
  async (tx) => {
    // Consistent snapshot
  },
  { isolationLevel: "repeatable read" }
);

// Read Committed (default)
await db.transaction(
  async (tx) => {
    // Standard operations
  },
  { isolationLevel: "read committed" }
);
```

## Service Layer Pattern

```typescript
class UserService {
  constructor(private db: Database) {}

  async createWithProfile(data: CreateUserData) {
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values(data.user)
        .returning();

      const [profile] = await tx
        .insert(profiles)
        .values({ userId: user.id, ...data.profile })
        .returning();

      await tx.insert(audit).values({
        action: "user_created",
        entityId: user.id,
        entityType: "user",
      });

      return { user, profile };
    });
  }

  async transferCredits(fromId: string, toId: string, amount: number) {
    return this.db.transaction(async (tx) => {
      // Lock rows for update
      const [from] = await tx
        .select()
        .from(users)
        .where(eq(users.id, fromId))
        .for("update");

      if (from.credits < amount) {
        throw new Error("Insufficient credits");
      }

      await tx
        .update(users)
        .set({ credits: sql`${users.credits} - ${amount}` })
        .where(eq(users.id, fromId));

      await tx
        .update(users)
        .set({ credits: sql`${users.credits} + ${amount}` })
        .where(eq(users.id, toId));

      await tx.insert(transactions).values({
        fromUserId: fromId,
        toUserId: toId,
        amount,
      });

      return { success: true };
    });
  }
}
```

## Retry on Conflict

```typescript
async function transactionWithRetry<T>(
  fn: (tx: Transaction) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.transaction(fn);
    } catch (error) {
      lastError = error as Error;

      // Only retry on serialization failures
      if (
        error instanceof Error &&
        error.message.includes("could not serialize")
      ) {
        console.log(`Retry attempt ${attempt}/${maxRetries}`);
        await new Promise((r) => setTimeout(r, 100 * attempt));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
```

## Best Practices

1. **Keep transactions short** - Long transactions block other queries
2. **Don't do I/O in transactions** - No HTTP calls, file operations
3. **Handle errors** - Always catch and handle transaction errors
4. **Use appropriate isolation** - Don't use serializable unless needed
5. **Retry serialization failures** - They're expected under high concurrency
6. **Audit in transaction** - Include audit logs in the same transaction
