/**
 * Shared AI/LLM utilities
 *
 * Usage:
 * ```typescript
 * import { getCachedEmbeddings, initializeVectorStore, getCheckpointer } from '@/shared';
 *
 * const embeddings = getCachedEmbeddings();
 * const embedding = await embeddings.embedQuery('Hello world');
 *
 * const vectorStore = await initializeVectorStore();
 * const docs = await similaritySearch('query', 5);
 *
 * const checkpointer = await getOrInitCheckpointer();
 * const graph = workflow.compile({ checkpointer });
 * ```
 */

// Embeddings
export {
  CachedEmbeddingsService,
  getCachedEmbeddings,
  shutdownEmbeddingsCache,
} from './embeddings.js';

// Vector Store
export {
  initializeVectorStore,
  getVectorStore,
  similaritySearch,
  similaritySearchWithScore,
  addDocuments,
  deleteDocuments,
  deleteDocumentsByFilter,
  createRetriever,
  closeVectorStore,
  type VectorStoreConfig,
} from './vector-store.js';

// Checkpointer
export {
  initializeCheckpointer,
  getCheckpointer,
  getOrInitCheckpointer,
  closeCheckpointer,
  clearThreadCheckpoints,
  getCheckpointStats,
} from './checkpointer.js';
