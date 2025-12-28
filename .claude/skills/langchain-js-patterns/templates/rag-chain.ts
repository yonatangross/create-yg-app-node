/**
 * RAG Chain Template
 * Production-ready RAG with pgvector, cached embeddings, and streaming
 */

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Redis } from "ioredis";
import { createHash } from "crypto";

// =============================================================================
// Cached Embeddings (80% cost reduction)
// =============================================================================

export class CachedEmbeddings {
  constructor(
    private embeddings: OpenAIEmbeddings,
    private redis: Redis,
    private ttl = 86400 // 24 hours
  ) {}

  async embedQuery(text: string): Promise<number[]> {
    const key = `embed:${createHash("sha256").update(text).digest("hex")}`;
    const cached = await this.redis.get(key);

    if (cached) {
      return JSON.parse(cached);
    }

    const embedding = await this.embeddings.embedQuery(text);
    await this.redis.setex(key, this.ttl, JSON.stringify(embedding));
    return embedding;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }
}

// =============================================================================
// Vector Store Setup
// =============================================================================

export async function createVectorStore(
  connectionString: string,
  redis: Redis
) {
  const baseEmbeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
  });

  const cachedEmbeddings = new CachedEmbeddings(baseEmbeddings, redis);

  const vectorStore = await PGVectorStore.initialize(cachedEmbeddings, {
    postgresConnectionOptions: {
      connectionString,
    },
    tableName: "documents",
    columns: {
      idColumnName: "id",
      vectorColumnName: "embedding",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
  });

  return vectorStore;
}

// =============================================================================
// Document Ingestion
// =============================================================================

export async function ingestDocuments(
  vectorStore: PGVectorStore,
  documents: { content: string; metadata: Record<string, unknown> }[]
) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const allDocs: Document[] = [];

  for (const doc of documents) {
    const chunks = await splitter.createDocuments(
      [doc.content],
      [doc.metadata]
    );
    allDocs.push(...chunks);
  }

  await vectorStore.addDocuments(allDocs);

  return allDocs.length;
}

// =============================================================================
// RAG Chain
// =============================================================================

const RAG_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful assistant that answers questions based on the provided context.

Instructions:
- Answer ONLY based on the context provided
- If the context doesn't contain the answer, say "I don't have enough information to answer that"
- Cite your sources by referencing the document metadata when available
- Be concise but thorough

Context:
{context}`,
  ],
  ["human", "{question}"],
]);

export function createRAGChain(vectorStore: PGVectorStore, k = 5) {
  const model = new ChatOpenAI({
    model: "gpt-4-turbo",
    temperature: 0,
  });

  const retriever = vectorStore.asRetriever({ k });

  const formatDocs = (docs: Document[]) => {
    return docs
      .map((doc, i) => {
        const source = doc.metadata.source || `Document ${i + 1}`;
        return `[${source}]\n${doc.pageContent}`;
      })
      .join("\n\n---\n\n");
  };

  const chain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocs),
      question: new RunnablePassthrough(),
    },
    RAG_PROMPT,
    model,
    new StringOutputParser(),
  ]);

  return chain;
}

// =============================================================================
// RAG with Sources
// =============================================================================

export function createRAGChainWithSources(vectorStore: PGVectorStore, k = 5) {
  const model = new ChatOpenAI({
    model: "gpt-4-turbo",
    temperature: 0,
  });

  const retriever = vectorStore.asRetriever({ k });

  return async function ragWithSources(question: string) {
    const docs = await retriever.invoke(question);

    const context = docs
      .map((doc, i) => {
        const source = doc.metadata.source || `Document ${i + 1}`;
        return `[${source}]\n${doc.pageContent}`;
      })
      .join("\n\n---\n\n");

    const prompt = await RAG_PROMPT.invoke({ context, question });
    const response = await model.invoke(prompt);

    return {
      answer: response.content as string,
      sources: docs.map((doc) => ({
        content: doc.pageContent.slice(0, 200) + "...",
        metadata: doc.metadata,
      })),
    };
  };
}

// =============================================================================
// Streaming RAG
// =============================================================================

export async function* streamRAG(
  vectorStore: PGVectorStore,
  question: string,
  k = 5
) {
  const model = new ChatOpenAI({
    model: "gpt-4-turbo",
    temperature: 0,
    streaming: true,
  });

  const retriever = vectorStore.asRetriever({ k });
  const docs = await retriever.invoke(question);

  // Yield sources first
  yield {
    type: "sources" as const,
    sources: docs.map((doc) => ({
      content: doc.pageContent.slice(0, 200),
      metadata: doc.metadata,
    })),
  };

  const context = docs
    .map((doc) => doc.pageContent)
    .join("\n\n---\n\n");

  const prompt = await RAG_PROMPT.invoke({ context, question });
  const stream = await model.stream(prompt);

  for await (const chunk of stream) {
    yield {
      type: "token" as const,
      content: chunk.content,
    };
  }
}
