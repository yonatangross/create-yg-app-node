import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Message structure stored in conversations.messages JSONB
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Conversations table schema
 *
 * Stores chat conversations with messages as JSONB array
 * This denormalized approach is optimal for chat use cases where:
 * - Messages are always fetched together with conversation
 * - No need for complex queries on individual messages
 * - Simplifies pagination and retrieval
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // Store entire conversation history as JSONB array
    messages: jsonb('messages').$type<ChatMessage[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Index on userId for fast filtering by user
    userIdIdx: index('conversations_user_id_idx').on(table.userId),
    // Index on updatedAt for sorting (most recent first)
    updatedAtIdx: index('conversations_updated_at_idx').on(table.updatedAt),
  })
);

// Type inference
export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;
