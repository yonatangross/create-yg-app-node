# Database Layer

Production-ready database layer using Drizzle ORM 0.45+ with PostgreSQL and pgvector for RAG capabilities.

## Architecture

```
db/
├── client.ts              # Database connection with lazy initialization
├── schema/                # Table schemas
│   ├── users.ts          # User accounts
│   ├── documents.ts      # Documents with embeddings (RAG)
│   ├── conversations.ts  # Chat conversations
│   └── index.ts          # Schema exports + relations
├── repositories/          # Repository pattern (like SkillForge)
│   ├── interfaces.ts     # TypeScript interfaces (Protocol pattern)
│   ├── user.repository.ts
│   ├── document.repository.ts
│   ├── conversation.repository.ts
│   └── index.ts
└── README.md
```

## Key Features

### 1. Lazy Initialization (SkillForge Pattern)

Database connection is initialized on first use, not at import time:

```typescript
import { getDb } from './db/client.js';

// Connection created here, not at import
const db = await getDb();
```

### 2. Test Mode Detection

Automatically uses smaller connection pool in test mode:

```typescript
// Detected via NODE_ENV=test, VITEST=true, or PYTEST_CURRENT_TEST
if (isTestMode()) {
  // max: 5, prepared statements disabled
}
```

### 3. Type-Safe Repositories

TypeScript interfaces + concrete implementations for testability:

```typescript
interface IUserRepository {
  create(data: NewUser): Promise<User>;
  findById(id: string): Promise<User | null>;
  // ...
}

class UserRepository implements IUserRepository {
  // Implementation with Drizzle
}
```

### 4. pgvector Integration

Documents table includes vector embeddings for similarity search:

```typescript
// Store document with embedding
await documentRepository.create({
  title: 'Guide',
  content: 'content here',
  embedding: [0.1, 0.2, ...], // 1536 dimensions
  userId: 'uuid',
});

// Similarity search
const similar = await documentRepository.similaritySearch({
  embedding: queryEmbedding,
  limit: 5,
  threshold: 0.7,
});
```

## Usage

### Initialize Database

```typescript
import { getDb, closeDb } from './db/client.js';

// Get database instance
const db = await getDb();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeDb();
});
```

### Use Repositories

```typescript
import { userRepository, documentRepository } from './db/repositories/index.js';

// Create user
const user = await userRepository.create({
  email: 'user@example.com',
  name: 'John Doe',
  passwordHash: hashedPassword,
});

// Find user
const found = await userRepository.findByEmail('user@example.com');

// Vector search
const docs = await documentRepository.similaritySearch({
  embedding: [0.1, 0.2, ...],
  userId: user.id,
  limit: 10,
});
```

### Direct Queries

For complex queries not covered by repositories:

```typescript
import { getDb, sql } from './db/client.js';
import { users, documents } from './db/schema/index.js';

const db = await getDb();

// Join query
const results = await db
  .select({
    userName: users.name,
    docTitle: documents.title,
  })
  .from(documents)
  .leftJoin(users, eq(documents.userId, users.id));

// Raw SQL
const raw = await db.execute(sql`SELECT * FROM users WHERE email = ${email}`);
```

## Database Operations

### Migrations

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema directly (dev only)
pnpm db:push

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

### Health Checks

```typescript
import { checkDbHealth } from './db/client.js';

const healthy = await checkDbHealth();
// Returns: true if database is reachable
```

## Schema Design

### Users Table

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_created_at_idx ON users(created_at);
```

### Documents Table (RAG)

```sql
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  embedding vector(1536),  -- pgvector
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX documents_user_id_idx ON documents(user_id);
CREATE INDEX documents_created_at_idx ON documents(created_at);
CREATE INDEX documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops);
```

### Conversations Table

```sql
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  messages jsonb DEFAULT '[]' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX conversations_user_id_idx ON conversations(user_id);
CREATE INDEX conversations_updated_at_idx ON conversations(updated_at);
```

## Best Practices

### 1. Always Use Repositories

```typescript
// ✅ Good
const user = await userRepository.findById(id);

// ❌ Avoid
const db = await getDb();
const user = await db.query.users.findFirst({ where: eq(users.id, id) });
```

### 2. Transactions for Multi-Operations

```typescript
const db = await getDb();

await db.transaction(async (tx) => {
  const user = await tx.insert(users).values(data).returning();
  await tx.insert(documents).values({ userId: user[0].id, ... });
});
```

### 3. Type Inference

```typescript
import { User, NewUser } from './db/schema/index.js';

// ✅ Use inferred types
function createUser(data: NewUser): Promise<User> { }

// ❌ Don't manually define
interface ManualUser { id: string; email: string; ... }
```

### 4. Graceful Shutdown

```typescript
import { gracefulShutdown } from './lib/shutdown.js';
import { closeDb } from './db/client.js';

gracefulShutdown(server, {
  onShutdown: async () => {
    await closeDb();
  },
});
```

## Production Resilience

### Connection Pooling

```typescript
// Configured in client.ts
{
  max: 20,              // Max connections
  idleTimeout: 30,      // Seconds before idle connection closes
  connectTimeout: 10,   // Connection timeout
}
```

### Prepared Statements

```typescript
import { eq, placeholder } from 'drizzle-orm';

// Prepare once
const getUserById = db.query.users
  .findFirst({ where: eq(users.id, placeholder('id')) })
  .prepare('get_user_by_id');

// Execute many times
const user = await getUserById.execute({ id: userId });
```

### Indexes

All foreign keys and frequently-queried columns have indexes:

- `users.email` - Authentication lookups
- `documents.user_id` - Filter by owner
- `documents.embedding` - Vector similarity search (HNSW)
- `conversations.user_id` - Filter by owner
- `conversations.updated_at` - Sort by recent

## Testing

Mock repositories in tests:

```typescript
import { IUserRepository } from './db/repositories/interfaces.js';

class MockUserRepository implements IUserRepository {
  async create(data: NewUser): Promise<User> {
    return { id: 'test-id', ...data };
  }
  // ...
}
```

## Troubleshooting

### Connection Issues

```bash
# Check database is running
docker ps | grep postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Migration Issues

```bash
# Reset database (dev only)
pnpm db:push --force

# View migration status
pnpm db:studio
```

### pgvector Not Found

```sql
-- Install extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## References

- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [postgres.js](https://github.com/porsager/postgres)
- [pgvector](https://github.com/pgvector/pgvector)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
