/**
 * Document Repository Implementation
 *
 * Implements IDocumentRepository with pgvector similarity search
 * Provides type-safe CRUD operations and vector similarity queries
 */

import { eq, desc, count, sql, SQL } from 'drizzle-orm';
import { getDb, getSqlClient } from '../client.js';
import { documents } from '../schema/index.js';
import type {
  Document,
  NewDocument,
  DocumentWithScore,
} from '../schema/index.js';
import type { IDocumentRepository } from './interfaces.js';
import { logger } from '../../lib/logger.js';

export class DocumentRepository implements IDocumentRepository {
  /**
   * Create a new document with embedding
   */
  async create(data: NewDocument): Promise<Document> {
    try {
      const db = await getDb();

      const [document] = await db.insert(documents).values(data).returning();

      if (!document) {
        throw new Error('Failed to create document');
      }

      logger.info(
        { documentId: document.id, userId: document.userId },
        'Document created'
      );

      return document;
    } catch (error) {
      logger.error({ error, userId: data.userId }, 'Failed to create document');
      throw error;
    }
  }

  /**
   * Find document by ID
   */
  async findById(id: string): Promise<Document | null> {
    try {
      const db = await getDb();

      const document = await db.query.documents.findFirst({
        where: eq(documents.id, id),
      });

      return document ?? null;
    } catch (error) {
      logger.error({ error, documentId: id }, 'Failed to find document by ID');
      throw error;
    }
  }

  /**
   * Find documents by user ID
   */
  async findByUserId(
    userId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ documents: Document[]; total: number }> {
    try {
      const db = await getDb();
      const { limit = 20, offset = 0 } = params ?? {};

      // Fetch documents
      const docsList = await db.query.documents.findMany({
        where: eq(documents.userId, userId),
        orderBy: [desc(documents.createdAt)],
        limit,
        offset,
      });

      // Count total
      const totalResult = await db
        .select({ value: count() })
        .from(documents)
        .where(eq(documents.userId, userId));

      const total = totalResult[0]?.value ?? 0;

      return {
        documents: docsList,
        total,
      };
    } catch (error) {
      logger.error(
        { error, userId, params },
        'Failed to find documents by user ID'
      );
      throw error;
    }
  }

  /**
   * Update document
   */
  async update(id: string, data: Partial<NewDocument>): Promise<Document> {
    try {
      const db = await getDb();

      const [updated] = await db
        .update(documents)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id))
        .returning();

      if (!updated) {
        throw new Error(`Document not found: ${id}`);
      }

      logger.info({ documentId: id }, 'Document updated');

      return updated;
    } catch (error) {
      logger.error({ error, documentId: id }, 'Failed to update document');
      throw error;
    }
  }

  /**
   * Delete document
   */
  async delete(id: string): Promise<void> {
    try {
      const db = await getDb();

      await db.delete(documents).where(eq(documents.id, id));

      logger.info({ documentId: id }, 'Document deleted');
    } catch (error) {
      logger.error({ error, documentId: id }, 'Failed to delete document');
      throw error;
    }
  }

  /**
   * Vector similarity search using pgvector
   *
   * Uses cosine similarity (1 - cosine_distance) for ranking
   * Higher scores = more similar documents
   */
  async similaritySearch(params: {
    embedding: number[];
    userId?: string;
    limit?: number;
    threshold?: number;
  }): Promise<DocumentWithScore[]> {
    try {
      const sqlClient = getSqlClient();
      const { embedding, userId, limit = 10, threshold = 0.7 } = params;

      // Convert embedding array to pgvector format
      const embeddingStr = `[${embedding.join(',')}]`;

      // Build query with optional user filter
      let query = sql`
        SELECT
          id,
          user_id,
          title,
          content,
          metadata,
          embedding,
          created_at,
          updated_at,
          1 - (embedding <=> ${embeddingStr}::vector) as similarity
        FROM documents
      `;

      const conditions: SQL[] = [];

      // Add similarity threshold
      conditions.push(
        sql`1 - (embedding <=> ${embeddingStr}::vector) >= ${threshold}`
      );

      // Add user filter if provided
      if (userId) {
        conditions.push(sql`user_id = ${userId}`);
      }

      // Combine conditions
      if (conditions.length > 0) {
        query = sql`${query} WHERE ${sql.join(conditions, sql` AND `)}`;
      }

      // Order by similarity and limit
      query = sql`
        ${query}
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      // Execute raw query (pgvector operators not yet in Drizzle)
      const results = await sqlClient.unsafe(query.queryChunks.join(''));

      logger.info(
        {
          userId,
          resultCount: results.length,
          limit,
          threshold,
        },
        'Similarity search completed'
      );

      // Type assertion is safe here because we control the query structure
      return results as unknown as DocumentWithScore[];
    } catch (error) {
      logger.error({ error, params }, 'Failed to perform similarity search');
      throw error;
    }
  }

  /**
   * Batch insert documents (for bulk imports)
   */
  async batchCreate(docs: NewDocument[]): Promise<Document[]> {
    try {
      const db = await getDb();

      const inserted = await db.insert(documents).values(docs).returning();

      logger.info({ count: inserted.length }, 'Batch documents created');

      return inserted;
    } catch (error) {
      logger.error(
        { error, count: docs.length },
        'Failed to batch create documents'
      );
      throw error;
    }
  }
}

// Export singleton instance
export const documentRepository = new DocumentRepository();
