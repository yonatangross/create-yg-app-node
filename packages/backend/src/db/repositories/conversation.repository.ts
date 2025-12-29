/**
 * Conversation Repository Implementation
 *
 * Implements IConversationRepository using Drizzle ORM
 * Handles JSONB message arrays for efficient chat storage
 */

import { eq, desc, count, sql } from 'drizzle-orm';
import { getDb } from '../client.js';
import { conversations } from '../schema/index.js';
import type {
  Conversation,
  NewConversation,
  ChatMessage,
} from '../schema/index.js';
import type { IConversationRepository } from './interfaces.js';
import { logger } from '../../lib/logger.js';

export class ConversationRepository implements IConversationRepository {
  /**
   * Create a new conversation
   */
  async create(data: NewConversation): Promise<Conversation> {
    try {
      const db = await getDb();

      const [conversation] = await db
        .insert(conversations)
        .values(data)
        .returning();

      if (!conversation) {
        throw new Error('Failed to create conversation');
      }

      logger.info(
        { conversationId: conversation.id, userId: conversation.userId },
        'Conversation created'
      );

      return conversation;
    } catch (error) {
      logger.error(
        { error, userId: data.userId },
        'Failed to create conversation'
      );
      throw error;
    }
  }

  /**
   * Find conversation by ID
   */
  async findById(id: string): Promise<Conversation | null> {
    try {
      const db = await getDb();

      const conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, id),
      });

      return conversation ?? null;
    } catch (error) {
      logger.error(
        { error, conversationId: id },
        'Failed to find conversation by ID'
      );
      throw error;
    }
  }

  /**
   * Find conversations by user ID
   */
  async findByUserId(
    userId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ conversations: Conversation[]; total: number }> {
    try {
      const db = await getDb();
      const { limit = 20, offset = 0 } = params ?? {};

      // Fetch conversations (sorted by most recently updated)
      const convsList = await db.query.conversations.findMany({
        where: eq(conversations.userId, userId),
        orderBy: [desc(conversations.updatedAt)],
        limit,
        offset,
      });

      // Count total
      const totalResult = await db
        .select({ value: count() })
        .from(conversations)
        .where(eq(conversations.userId, userId));

      const total = totalResult[0]?.value ?? 0;

      return {
        conversations: convsList,
        total,
      };
    } catch (error) {
      logger.error(
        { error, userId, params },
        'Failed to find conversations by user ID'
      );
      throw error;
    }
  }

  /**
   * Update conversation (title or messages)
   */
  async update(
    id: string,
    data: Partial<NewConversation>
  ): Promise<Conversation> {
    try {
      const db = await getDb();

      const [updated] = await db
        .update(conversations)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, id))
        .returning();

      if (!updated) {
        throw new Error(`Conversation not found: ${id}`);
      }

      logger.info({ conversationId: id }, 'Conversation updated');

      return updated;
    } catch (error) {
      logger.error(
        { error, conversationId: id },
        'Failed to update conversation'
      );
      throw error;
    }
  }

  /**
   * Append message to conversation
   *
   * Uses JSONB array append for efficient message storage
   */
  async appendMessage(id: string, message: ChatMessage): Promise<Conversation> {
    try {
      const db = await getDb();

      // Use PostgreSQL's jsonb_insert or array append
      const [updated] = await db
        .update(conversations)
        .set({
          messages: sql`messages || ${JSON.stringify(message)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, id))
        .returning();

      if (!updated) {
        throw new Error(`Conversation not found: ${id}`);
      }

      logger.info(
        {
          conversationId: id,
          messageRole: message.role,
          messageLength: message.content.length,
        },
        'Message appended to conversation'
      );

      return updated;
    } catch (error) {
      logger.error({ error, conversationId: id }, 'Failed to append message');
      throw error;
    }
  }

  /**
   * Delete conversation
   */
  async delete(id: string): Promise<void> {
    try {
      const db = await getDb();

      await db.delete(conversations).where(eq(conversations.id, id));

      logger.info({ conversationId: id }, 'Conversation deleted');
    } catch (error) {
      logger.error(
        { error, conversationId: id },
        'Failed to delete conversation'
      );
      throw error;
    }
  }

  /**
   * Get conversation count for user
   */
  async countByUserId(userId: string): Promise<number> {
    try {
      const db = await getDb();

      const totalResult = await db
        .select({ value: count() })
        .from(conversations)
        .where(eq(conversations.userId, userId));

      return totalResult[0]?.value ?? 0;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to count conversations');
      throw error;
    }
  }
}

// Export singleton instance
export const conversationRepository = new ConversationRepository();
