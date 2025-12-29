/**
 * Repository Interfaces
 *
 * TypeScript interfaces defining repository contracts (similar to Python Protocols)
 * This enables dependency injection and testing with mock implementations
 */

import type {
  User,
  NewUser,
  PublicUser,
  Document,
  NewDocument,
  DocumentWithScore,
  Conversation,
  NewConversation,
  ChatMessage,
} from '../schema/index.js';

/**
 * User Repository Interface
 *
 * Handles all user data operations
 */
export interface IUserRepository {
  /**
   * Create a new user
   */
  create(data: NewUser): Promise<User>;

  /**
   * Find user by ID
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Update user
   */
  update(id: string, data: Partial<NewUser>): Promise<User>;

  /**
   * Delete user (soft or hard delete)
   */
  delete(id: string): Promise<void>;

  /**
   * List users with pagination
   */
  list(params: {
    limit?: number;
    offset?: number;
  }): Promise<{ users: PublicUser[]; total: number }>;
}

/**
 * Document Repository Interface
 *
 * Handles document storage and vector similarity search for RAG
 */
export interface IDocumentRepository {
  /**
   * Create a new document with embedding
   */
  create(data: NewDocument): Promise<Document>;

  /**
   * Find document by ID
   */
  findById(id: string): Promise<Document | null>;

  /**
   * Find documents by user ID
   */
  findByUserId(
    userId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ documents: Document[]; total: number }>;

  /**
   * Update document
   */
  update(id: string, data: Partial<NewDocument>): Promise<Document>;

  /**
   * Delete document
   */
  delete(id: string): Promise<void>;

  /**
   * Vector similarity search
   * Returns documents ordered by cosine similarity to query embedding
   */
  similaritySearch(params: {
    embedding: number[];
    userId?: string;
    limit?: number;
    threshold?: number;
  }): Promise<DocumentWithScore[]>;

  /**
   * Batch insert documents (for bulk imports)
   */
  batchCreate(documents: NewDocument[]): Promise<Document[]>;
}

/**
 * Conversation Repository Interface
 *
 * Handles chat conversation storage and retrieval
 */
export interface IConversationRepository {
  /**
   * Create a new conversation
   */
  create(data: NewConversation): Promise<Conversation>;

  /**
   * Find conversation by ID
   */
  findById(id: string): Promise<Conversation | null>;

  /**
   * Find conversations by user ID
   */
  findByUserId(
    userId: string,
    params?: { limit?: number; offset?: number }
  ): Promise<{ conversations: Conversation[]; total: number }>;

  /**
   * Update conversation (title or messages)
   */
  update(id: string, data: Partial<NewConversation>): Promise<Conversation>;

  /**
   * Append message to conversation
   */
  appendMessage(id: string, message: ChatMessage): Promise<Conversation>;

  /**
   * Delete conversation
   */
  delete(id: string): Promise<void>;

  /**
   * Get conversation count for user
   */
  countByUserId(userId: string): Promise<number>;
}
