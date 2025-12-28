# Query Patterns

## Select Queries

```typescript
import { eq, and, or, like, ilike, gt, lt, gte, lte, ne, isNull, isNotNull, inArray, notInArray, between, desc, asc, sql } from "drizzle-orm";

// Basic select all
const allUsers = await db.select().from(users);

// Select specific columns
const userEmails = await db
  .select({ id: users.id, email: users.email })
  .from(users);

// With where clause
const activeUsers = await db
  .select()
  .from(users)
  .where(eq(users.isActive, true));

// Multiple conditions
const filteredUsers = await db
  .select()
  .from(users)
  .where(
    and(
      eq(users.isActive, true),
      like(users.email, "%@company.com")
    )
  );

// OR conditions
const adminsOrMods = await db
  .select()
  .from(users)
  .where(
    or(
      eq(users.role, "admin"),
      eq(users.role, "moderator")
    )
  );
```

## Query Builder (with relations)

```typescript
// Single with relations
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: true,
    comments: true,
  },
});

// Nested relations
const userWithAll = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: {
      with: {
        comments: {
          with: {
            author: true,
          },
        },
      },
    },
  },
});

// Select specific columns in relations
const userPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  columns: {
    id: true,
    email: true,
  },
  with: {
    posts: {
      columns: {
        id: true,
        title: true,
      },
    },
  },
});

// Filter relations
const userPublishedPosts = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    posts: {
      where: eq(posts.isPublished, true),
      orderBy: [desc(posts.createdAt)],
      limit: 10,
    },
  },
});
```

## Pagination

```typescript
// Offset pagination
const page = 1;
const limit = 20;

const users = await db
  .select()
  .from(users)
  .orderBy(desc(users.createdAt))
  .limit(limit)
  .offset((page - 1) * limit);

// Count total
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(users);

// Cursor pagination (more efficient)
const lastId = "previous-last-id";

const users = await db
  .select()
  .from(users)
  .where(gt(users.id, lastId))
  .orderBy(asc(users.id))
  .limit(20);
```

## Joins

```typescript
// Inner join
const postsWithAuthors = await db
  .select({
    postId: posts.id,
    postTitle: posts.title,
    authorName: users.name,
    authorEmail: users.email,
  })
  .from(posts)
  .innerJoin(users, eq(posts.authorId, users.id));

// Left join
const usersWithPosts = await db
  .select({
    userId: users.id,
    userName: users.name,
    postTitle: posts.title,
  })
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId));

// Multiple joins
const commentsWithDetails = await db
  .select({
    commentId: comments.id,
    commentContent: comments.content,
    postTitle: posts.title,
    authorName: users.name,
  })
  .from(comments)
  .innerJoin(posts, eq(comments.postId, posts.id))
  .innerJoin(users, eq(comments.authorId, users.id));
```

## Aggregations

```typescript
// Count
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(users)
  .where(eq(users.isActive, true));

// Group by
const postsByAuthor = await db
  .select({
    authorId: posts.authorId,
    postCount: sql<number>`count(*)::int`,
    totalViews: sql<number>`sum(${posts.viewCount})::int`,
  })
  .from(posts)
  .groupBy(posts.authorId);

// Having
const prolificAuthors = await db
  .select({
    authorId: posts.authorId,
    postCount: sql<number>`count(*)::int`,
  })
  .from(posts)
  .groupBy(posts.authorId)
  .having(sql`count(*) > 10`);
```

## Subqueries

```typescript
// Subquery in where
const usersWithPosts = await db
  .select()
  .from(users)
  .where(
    inArray(
      users.id,
      db.select({ id: posts.authorId }).from(posts)
    )
  );

// Subquery in select
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

## Raw SQL

```typescript
// Raw where condition
const recentUsers = await db
  .select()
  .from(users)
  .where(sql`${users.createdAt} > now() - interval '7 days'`);

// Full raw query
const result = await db.execute(sql`
  SELECT * FROM users
  WHERE email ILIKE ${`%${search}%`}
  ORDER BY created_at DESC
  LIMIT ${limit}
`);
```

## Best Practices

1. **Use query builder** - Better DX with relations
2. **Cursor pagination** - More efficient than offset for large tables
3. **Select specific columns** - Don't `select()` all if you don't need it
4. **Index your filters** - Ensure WHERE columns are indexed
5. **Avoid N+1** - Use `with` for relations instead of loops
