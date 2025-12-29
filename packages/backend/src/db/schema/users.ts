import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/**
 * Users table schema
 *
 * Stores user account information with secure password handling
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Index on email for fast lookups during authentication
    emailIdx: index('users_email_idx').on(table.email),
    // Index on createdAt for sorting/filtering
    createdAtIdx: index('users_created_at_idx').on(table.createdAt),
  })
);

// Type inference for type-safe operations
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Omit sensitive fields for API responses
export type PublicUser = Omit<User, 'passwordHash'>;
