# Migrations

## Configuration

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

## Commands

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply pending migrations
pnpm drizzle-kit migrate

# Push schema directly (dev only, no migration files)
pnpm drizzle-kit push

# Check for schema drift
pnpm drizzle-kit check

# Open Drizzle Studio (database GUI)
pnpm drizzle-kit studio

# Drop all tables (dangerous!)
pnpm drizzle-kit drop
```

## Migration Files

```sql
-- drizzle/0001_create_users.sql
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
```

## Custom Migrations

```typescript
// drizzle/meta/_journal.json tracks applied migrations

// For custom SQL, create a file manually:
// drizzle/0002_add_full_text_search.sql

/*
  Custom migration for full-text search
  Applied: manually
*/

ALTER TABLE posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX posts_search_idx ON posts USING GIN (search_vector);
```

## Programmatic Migration

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log("Running migrations...");

  await migrate(db, {
    migrationsFolder: "./drizzle",
  });

  console.log("Migrations complete!");

  await pool.end();
}

runMigrations().catch(console.error);
```

## Seed Data

```typescript
// src/db/seed.ts
import { db } from "./index";
import { users, posts } from "./schema";

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (dev only!)
  await db.delete(posts);
  await db.delete(users);

  // Insert seed data
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
    })
    .returning();

  await db.insert(posts).values([
    {
      authorId: admin.id,
      title: "Welcome Post",
      content: "Welcome to the platform!",
      isPublished: true,
    },
    {
      authorId: admin.id,
      title: "Getting Started",
      content: "Here's how to get started...",
      isPublished: true,
    },
  ]);

  console.log("Seeding complete!");
}

seed().catch(console.error);
```

## Safe Migration Patterns

```sql
-- Adding a column (safe)
ALTER TABLE users ADD COLUMN bio text;

-- Adding NOT NULL column (requires default or backfill)
-- Step 1: Add nullable
ALTER TABLE users ADD COLUMN phone text;

-- Step 2: Backfill
UPDATE users SET phone = 'unknown' WHERE phone IS NULL;

-- Step 3: Make NOT NULL
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- Creating index concurrently (non-blocking)
CREATE INDEX CONCURRENTLY users_phone_idx ON users (phone);

-- Renaming (use view for backwards compatibility)
ALTER TABLE users RENAME COLUMN name TO full_name;
CREATE VIEW users_v1 AS
  SELECT id, email, full_name AS name, created_at FROM users;
```

## Migration Safety Checklist

- [ ] **No data loss** - Check if dropping columns/tables
- [ ] **Backwards compatible** - Can old code still work?
- [ ] **Non-blocking** - Use CONCURRENTLY for indexes
- [ ] **Reversible** - Can you roll back if needed?
- [ ] **Tested** - Run on staging first
- [ ] **Backed up** - Database backup before production

## Rollback Strategy

```typescript
// drizzle/0003_add_phone.sql
-- Migration
ALTER TABLE users ADD COLUMN phone text;
CREATE INDEX users_phone_idx ON users (phone);

-- drizzle/rollback/0003_add_phone.sql (manual)
DROP INDEX IF EXISTS users_phone_idx;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
```

## Best Practices

1. **Generate, don't write** - Let drizzle-kit generate SQL
2. **Review migrations** - Check generated SQL before applying
3. **Small migrations** - One logical change per migration
4. **Test on staging** - Always test migrations on staging first
5. **Backup before migrate** - Especially for production
6. **No downtime** - Use backwards-compatible patterns
