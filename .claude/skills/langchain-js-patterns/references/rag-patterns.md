# RAG Implementation Patterns

## Vector Store Setup (pgvector)

```typescript
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small", // 1536 dimensions, best cost/quality
});

const vectorStore = await PGVectorStore.initialize(embeddings, {
  postgresConnectionOptions: {
    connectionString: process.env.DATABASE_URL,
  },
  tableName: "documents",
  columns: {
    idColumnName: "id",
    vectorColumnName: "embedding",
    contentColumnName: "content",
    metadataColumnName: "metadata",
  },
});
```

## Chunking Strategies

```typescript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// General purpose
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

// Code-aware splitting
const codeSplitter = RecursiveCharacterTextSplitter.fromLanguage("typescript", {
  chunkSize: 2000,
  chunkOverlap: 200,
});

// Markdown-aware splitting
const markdownSplitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
  chunkSize: 1000,
  chunkOverlap: 100,
});
```

## Retrieval Strategies

```typescript
// Basic similarity search
const docs = await vectorStore.similaritySearch(query, 5);

// With score threshold
const docsWithScores = await vectorStore.similaritySearchWithScore(query, 10);
const filtered = docsWithScores.filter(([, score]) => score > 0.7);

// MMR (Maximal Marginal Relevance) - diversity
const retriever = vectorStore.asRetriever({
  searchType: "mmr",
  k: 5,
  fetchK: 20, // Fetch more, then diversify
});

// With metadata filter
const retriever = vectorStore.asRetriever({
  filter: { source: "documentation" },
  k: 5,
});
```

## Hybrid Search (Vector + Keyword)

```typescript
// Combine with BM25 or full-text search
async function hybridSearch(query: string, k: number) {
  const [vectorResults, keywordResults] = await Promise.all([
    vectorStore.similaritySearchWithScore(query, k),
    db.execute(sql`
      SELECT * FROM documents
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
      LIMIT ${k}
    `),
  ]);

  // Reciprocal Rank Fusion
  const scores = new Map<string, number>();
  const K = 60; // RRF constant

  vectorResults.forEach(([doc, _], rank) => {
    const id = doc.metadata.id;
    scores.set(id, (scores.get(id) || 0) + 1 / (K + rank + 1));
  });

  keywordResults.forEach((doc, rank) => {
    scores.set(doc.id, (scores.get(doc.id) || 0) + 1 / (K + rank + 1));
  });

  // Sort by combined score
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
}
```

## Reranking

```typescript
import { CohereRerank } from "@langchain/cohere";

const reranker = new CohereRerank({
  model: "rerank-english-v3.0",
  topN: 5,
});

async function retrieveAndRerank(query: string) {
  // Over-fetch
  const docs = await vectorStore.similaritySearch(query, 20);

  // Rerank
  const reranked = await reranker.rerank(
    docs.map(d => d.pageContent),
    query
  );

  return reranked.map(r => docs[r.index]);
}
```

## Context Window Management

```typescript
import { encodingForModel } from "tiktoken";

const encoding = encodingForModel("gpt-4");
const MAX_CONTEXT_TOKENS = 8000;

function fitToContext(docs: Document[], query: string): Document[] {
  const queryTokens = encoding.encode(query).length;
  let totalTokens = queryTokens + 500; // Reserve for prompt template

  const result: Document[] = [];

  for (const doc of docs) {
    const docTokens = encoding.encode(doc.pageContent).length;
    if (totalTokens + docTokens > MAX_CONTEXT_TOKENS) break;

    totalTokens += docTokens;
    result.push(doc);
  }

  return result;
}
```

## Best Practices

1. **Chunk size** - 500-1000 tokens for general text, larger for code
2. **Overlap** - 10-20% of chunk size to preserve context
3. **Embedding model** - text-embedding-3-small for cost, text-embedding-3-large for quality
4. **k value** - Start with 5, increase if answers incomplete
5. **Cache embeddings** - 80% cost reduction with Redis cache
6. **Metadata** - Store source, date, section for filtering and citations
