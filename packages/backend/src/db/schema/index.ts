/**
 * Database Schema Index
 *
 * Re-exports all table schemas and relations for Drizzle ORM
 */

// Table schemas
export * from './users.js';
export * from './documents.js';
export * from './conversations.js';

// Relations (for Drizzle query builder)
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { documents } from './documents.js';
import { conversations } from './conversations.js';

/**
 * User relations
 * - A user can have many documents
 * - A user can have many conversations
 */
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  conversations: many(conversations),
}));

/**
 * Document relations
 * - Each document belongs to one user
 */
export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

/**
 * Conversation relations
 * - Each conversation belongs to one user
 */
export const conversationsRelations = relations(conversations, ({ one }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
}));
