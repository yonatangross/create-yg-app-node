# Migration Safety Checklist

## Pre-Migration

- [ ] **Database backup** completed
- [ ] **Staging tested** - Migration ran successfully on staging
- [ ] **Reviewed SQL** - Checked generated migration file
- [ ] **Rollback plan** - Know how to reverse changes
- [ ] **Maintenance window** - Scheduled if needed

## Schema Change Types

### ✅ Safe (No downtime)

- [ ] Add nullable column
- [ ] Add column with default
- [ ] Add index (use CONCURRENTLY)
- [ ] Add table
- [ ] Add enum value

### ⚠️ Caution (Backwards compatible)

- [ ] Rename column → Add new, migrate data, drop old
- [ ] Change column type → Add new, migrate, drop old
- [ ] Add NOT NULL → Add nullable, backfill, then alter

### ❌ Dangerous (May cause downtime)

- [ ] Drop column
- [ ] Drop table
- [ ] Remove enum value
- [ ] Change primary key

## Migration Patterns

### Adding NOT NULL Column

```sql
-- Step 1: Add nullable
ALTER TABLE users ADD COLUMN phone text;

-- Step 2: Backfill (in batches for large tables)
UPDATE users SET phone = 'unknown' WHERE phone IS NULL;

-- Step 3: Add constraint
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
```

### Renaming Column

```sql
-- Step 1: Add new column
ALTER TABLE users ADD COLUMN full_name text;

-- Step 2: Migrate data
UPDATE users SET full_name = name;

-- Step 3: Update application to use new column

-- Step 4: Make new column NOT NULL (if needed)
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- Step 5: Drop old column (after deployment)
ALTER TABLE users DROP COLUMN name;
```

### Creating Index

```sql
-- Use CONCURRENTLY to avoid blocking writes
CREATE INDEX CONCURRENTLY users_email_idx ON users (email);
```

## Verification

- [ ] **Check migrations applied** - Query `drizzle.__drizzle_migrations`
- [ ] **Verify schema** - Run `drizzle-kit check`
- [ ] **Test queries** - Run application tests
- [ ] **Monitor performance** - Check slow query logs
- [ ] **Verify data** - Spot check migrated data

## Rollback

### Immediate Rollback

```bash
# If migration just applied and fails
psql $DATABASE_URL < rollback/0001_migration.sql
```

### Schema Drift

```bash
# Check for drift
pnpm drizzle-kit check

# Generate fix migration
pnpm drizzle-kit generate
```

## Large Table Migrations

For tables with millions of rows:

- [ ] **Estimate time** - Test on staging with similar data size
- [ ] **Batch updates** - Update in chunks of 10,000-100,000
- [ ] **Off-peak hours** - Run during low traffic
- [ ] **Monitor locks** - Watch for blocking queries
- [ ] **Progress tracking** - Log progress every N rows

```typescript
// Batch update example
async function batchMigrate() {
  const BATCH_SIZE = 10000;
  let offset = 0;
  let processed = 0;

  while (true) {
    const result = await db.execute(sql`
      WITH batch AS (
        SELECT id FROM users
        WHERE new_column IS NULL
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE users
      SET new_column = 'default'
      WHERE id IN (SELECT id FROM batch)
      RETURNING id
    `);

    processed += result.rowCount;
    console.log(`Processed: ${processed}`);

    if (result.rowCount === 0) break;

    // Small delay to reduce load
    await new Promise((r) => setTimeout(r, 100));
  }
}
```

## Post-Migration

- [ ] **Application healthy** - No errors in logs
- [ ] **Queries performing** - No new slow queries
- [ ] **Data integrity** - Spot checks pass
- [ ] **Documentation** - Update schema docs
- [ ] **Cleanup** - Remove temporary columns/tables

## Emergency Contacts

- Database Admin: [contact]
- On-Call Engineer: [contact]
- Escalation: [contact]

## Sign-off

| Step | Completed | By | Time |
|------|-----------|-----|------|
| Backup | ☐ | | |
| Staging test | ☐ | | |
| Production migration | ☐ | | |
| Verification | ☐ | | |
