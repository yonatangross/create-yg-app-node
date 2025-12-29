import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from './users.js';

// Custom type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => parseFloat(v));
  },
});

/**
 * Documents table schema
 *
 * Stores documents with embeddings for RAG (Retrieval-Augmented Generation)
 * Uses pgvector extension for similarity search
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    // JSONB for flexible metadata storage
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    // pgvector embedding column (OpenAI text-embedding-3-small = 1536 dimensions)
    embedding: vector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Index on userId for fast filtering by user
    userIdIdx: index('documents_user_id_idx').on(table.userId),
    // Index on createdAt for sorting
    createdAtIdx: index('documents_created_at_idx').on(table.createdAt),
    // HNSW index for vector similarity search (requires pgvector extension)
    // This index is created via migration, not in schema definition
    // Example: CREATE INDEX documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops);
  })
);

// Type inference
export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;

// Document with similarity score (for search results)
export type DocumentWithScore = Document & { similarity: number };
