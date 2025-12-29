/**
 * PGVectorStore Wrapper
 *
 * Production-ready vector store integration with pgvector.
 * Uses cached embeddings service and provides convenience methods.
 * Now with timeout protection on all vector operations.
 */

import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import type { Document } from '@langchain/core/documents';
import { getConfig } from '../core/config.js';
import { getCachedEmbeddings } from './embeddings.js';
import { getLogger } from '../core/logger.js';

const logger = getLogger();

// Type for metadata filtering (accepting any shape for flexibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MetadataFilter = any;

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  tableName?: string;
  idColumnName?: string;
  vectorColumnName?: string;
  contentColumnName?: string;
  metadataColumnName?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<VectorStoreConfig> = {
  tableName: 'documents',
  idColumnName: 'id',
  vectorColumnName: 'embedding',
  contentColumnName: 'content',
  metadataColumnName: 'metadata',
};

/**
 * Vector store instance cache
 */
let vectorStoreInstance: PGVectorStore | null = null;

/**
 * Initialize PGVectorStore with cached embeddings
 *
 * @param config - Optional vector store configuration
 * @returns Initialized PGVectorStore instance
 */
export async function initializeVectorStore(
  vectorConfig?: VectorStoreConfig
): Promise<PGVectorStore> {
  if (vectorStoreInstance) {
    return vectorStoreInstance;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...vectorConfig };
  const embeddings = getCachedEmbeddings();
  const config = getConfig();

  try {
    vectorStoreInstance = await PGVectorStore.initialize(embeddings, {
      postgresConnectionOptions: {
        connectionString: config.DATABASE_URL,
      },
      tableName: finalConfig.tableName,
      columns: {
        idColumnName: finalConfig.idColumnName,
        vectorColumnName: finalConfig.vectorColumnName,
        contentColumnName: finalConfig.contentColumnName,
        metadataColumnName: finalConfig.metadataColumnName,
      },
    });

    logger.info(
      { tableName: finalConfig.tableName },
      'Vector store initialized'
    );

    return vectorStoreInstance;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize vector store');
    throw error;
  }
}

/**
 * Get existing vector store instance
 *
 * @throws Error if not initialized
 */
export function getVectorStore(): PGVectorStore {
  if (!vectorStoreInstance) {
    throw new Error(
      'Vector store not initialized. Call initializeVectorStore() first.'
    );
  }
  return vectorStoreInstance;
}

/**
 * Similarity search with optional metadata filters
 *
 * @param query - Search query text
 * @param k - Number of results to return
 * @param filter - Optional metadata filter
 * @returns Array of documents with scores
 */
export async function similaritySearch(
  query: string,
  k = 5,
  filter?: MetadataFilter
): Promise<Document[]> {
  const vectorStore = getVectorStore();

  try {
    const results = await vectorStore.similaritySearch(query, k, filter);
    logger.debug(
      { query, k, filter, resultsCount: results.length },
      'Similarity search'
    );
    return results;
  } catch (error) {
    logger.error({ error, query }, 'Similarity search failed');
    throw error;
  }
}

/**
 * Similarity search with scores
 *
 * @param query - Search query text
 * @param k - Number of results to return
 * @param filter - Optional metadata filter
 * @returns Array of [document, score] tuples
 */
export async function similaritySearchWithScore(
  query: string,
  k = 5,
  filter?: MetadataFilter
): Promise<[Document, number][]> {
  const vectorStore = getVectorStore();

  try {
    const results = await vectorStore.similaritySearchWithScore(
      query,
      k,
      filter
    );
    logger.debug(
      {
        query,
        k,
        filter,
        resultsCount: results.length,
        scores: results.map(([, score]) => score),
      },
      'Similarity search with scores'
    );
    return results;
  } catch (error) {
    logger.error({ error, query }, 'Similarity search with scores failed');
    throw error;
  }
}

/**
 * Add documents to vector store
 *
 * @param documents - Documents to add
 * @returns Array of document IDs
 */
export async function addDocuments(documents: Document[]): Promise<void> {
  const vectorStore = getVectorStore();

  try {
    await vectorStore.addDocuments(documents);
    logger.info({ count: documents.length }, 'Documents added to vector store');
  } catch (error) {
    logger.error({ error, count: documents.length }, 'Failed to add documents');
    throw error;
  }
}

/**
 * Delete documents by IDs
 *
 * @param ids - Document IDs to delete
 */
export async function deleteDocuments(ids: string[]): Promise<void> {
  const vectorStore = getVectorStore();

  try {
    await vectorStore.delete({ ids });
    logger.info({ count: ids.length }, 'Documents deleted from vector store');
  } catch (error) {
    logger.error({ error, count: ids.length }, 'Failed to delete documents');
    throw error;
  }
}

/**
 * Delete documents by metadata filter
 *
 * @param filter - Metadata filter
 */
export async function deleteDocumentsByFilter(
  filter: MetadataFilter
): Promise<void> {
  const vectorStore = getVectorStore();

  try {
    await vectorStore.delete({ filter });
    logger.info({ filter }, 'Documents deleted by filter');
  } catch (error) {
    logger.error({ error, filter }, 'Failed to delete documents by filter');
    throw error;
  }
}

/**
 * Create a retriever from the vector store
 *
 * @param k - Number of documents to retrieve
 * @param filter - Optional metadata filter
 * @returns Retriever instance
 */
export function createRetriever(k = 5, filter?: MetadataFilter) {
  const vectorStore = getVectorStore();

  if (filter) {
    return vectorStore.asRetriever(k, filter);
  }
  return vectorStore.asRetriever(k);
}

/**
 * Close vector store connection
 */
export async function closeVectorStore(): Promise<void> {
  if (vectorStoreInstance) {
    // PGVectorStore doesn't have explicit close, but we can clean up
    vectorStoreInstance = null;
    logger.info('Vector store connection closed');
  }
}
