# Schema Definition

## Basic Table

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    activeIdx: index("users_active_idx").on(table.isActive),
  })
);
```

## Column Types

```typescript
import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  date,
  time,
  json,
  jsonb,
  real,
  doublePrecision,
  decimal,
  serial,
  bigserial,
} from "drizzle-orm/pg-core";

export const examples = pgTable("examples", {
  // Primary keys
  id: uuid("id").defaultRandom().primaryKey(),
  serialId: serial("serial_id").primaryKey(),

  // Strings
  name: text("name").notNull(),
  code: varchar("code", { length: 50 }),

  // Numbers
  count: integer("count").default(0),
  bigNum: bigint("big_num", { mode: "number" }),
  price: decimal("price", { precision: 10, scale: 2 }),
  rating: real("rating"),
  score: doublePrecision("score"),

  // Boolean
  isPublished: boolean("is_published").default(false),

  // Dates
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  birthDate: date("birth_date"),
  startTime: time("start_time"),

  // JSON
  metadata: json("metadata").$type<Record<string, unknown>>(),
  settings: jsonb("settings").$type<{ theme: string; notifications: boolean }>(),
});
```

## Relations

```typescript
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
});

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
});

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
});

// Define relations for query builder
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
```

## Enums

```typescript
import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user", "guest"]);
export const statusEnum = pgEnum("status", ["pending", "active", "archived"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  role: userRoleEnum("role").default("user").notNull(),
  status: statusEnum("status").default("pending").notNull(),
});
```

## Type Inference

```typescript
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Infer types from schema
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Post = InferSelectModel<typeof posts>;
export type NewPost = InferInsertModel<typeof posts>;

// With relations (for query builder results)
export type UserWithPosts = User & {
  posts: Post[];
};
```

## Soft Deletes

```typescript
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Query helper
export const activeUsers = db
  .select()
  .from(users)
  .where(isNull(users.deletedAt));
```

## Composite Keys

```typescript
import { primaryKey } from "drizzle-orm/pg-core";

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    assignedAt: timestamp("assigned_at").defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
  })
);
```

## Best Practices

1. **UUID primary keys** - Better for distributed systems
2. **Timestamps with timezone** - Always use `withTimezone: true`
3. **Explicit notNull** - Be explicit about nullability
4. **Index foreign keys** - Add indexes on FK columns
5. **Soft deletes** - Use `deletedAt` instead of hard delete
6. **Type inference** - Use `InferSelectModel` over manual types
