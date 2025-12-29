# Production Resilience Patterns

## Circuit Breaker

```typescript
import CircuitBreaker from "opossum";

const llmBreaker = new CircuitBreaker(
  async (messages: BaseMessage[]) => {
    return await model.invoke(messages);
  },
  {
    timeout: 30000, // 30s timeout
    errorThresholdPercentage: 50, // Open after 50% failures
    resetTimeout: 60000, // Try again after 1 minute
    volumeThreshold: 5, // Minimum calls before calculating error %
  }
);

// Event handlers
llmBreaker.on("open", () => {
  logger.warn({ circuit: "llm" }, "Circuit OPEN - failing fast");
});

llmBreaker.on("halfOpen", () => {
  logger.info({ circuit: "llm" }, "Circuit HALF-OPEN - testing");
});

llmBreaker.on("close", () => {
  logger.info({ circuit: "llm" }, "Circuit CLOSED - normal operation");
});

llmBreaker.on("fallback", (result) => {
  logger.info({ result }, "Fallback triggered");
});

// With fallback
llmBreaker.fallback(() => ({
  content: "I'm temporarily unavailable. Please try again later.",
}));

// Usage
const response = await llmBreaker.fire(messages);
```

## Embedding Cache

```typescript
import { Redis } from "ioredis";
import { createHash } from "crypto";

class CachedEmbeddings {
  private redis: Redis;
  private embeddings: OpenAIEmbeddings;
  private ttl: number;
  private prefix: string;

  constructor(options: {
    redis: Redis;
    embeddings: OpenAIEmbeddings;
    ttl?: number;
    prefix?: string;
  }) {
    this.redis = options.redis;
    this.embeddings = options.embeddings;
    this.ttl = options.ttl || 86400; // 24 hours
    this.prefix = options.prefix || "embed";
  }

  private getKey(text: string): string {
    const hash = createHash("sha256").update(text).digest("hex");
    return `${this.prefix}:${hash}`;
  }

  async embedQuery(text: string): Promise<number[]> {
    const key = this.getKey(text);

    // Try cache first
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Call API and cache
    const embedding = await this.embeddings.embedQuery(text);
    await this.redis.setex(key, this.ttl, JSON.stringify(embedding));

    return embedding;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const uncached: { index: number; text: string }[] = [];

    // Check cache for all texts
    const keys = texts.map((t) => this.getKey(t));
    const cached = await this.redis.mget(...keys);

    for (let i = 0; i < texts.length; i++) {
      if (cached[i]) {
        results[i] = JSON.parse(cached[i]);
      } else {
        uncached.push({ index: i, text: texts[i] });
      }
    }

    // Batch embed uncached
    if (uncached.length > 0) {
      const embeddings = await this.embeddings.embedDocuments(
        uncached.map((u) => u.text)
      );

      // Cache and store results
      const pipeline = this.redis.pipeline();
      for (let i = 0; i < uncached.length; i++) {
        const { index, text } = uncached[i];
        results[index] = embeddings[i];
        pipeline.setex(this.getKey(text), this.ttl, JSON.stringify(embeddings[i]));
      }
      await pipeline.exec();
    }

    return results;
  }
}
```

## Token Counting & Budgeting

```typescript
import { encodingForModel, TiktokenModel } from "tiktoken";

class TokenBudget {
  private encoding: ReturnType<typeof encodingForModel>;
  private maxTokens: number;

  constructor(model: TiktokenModel, maxTokens: number) {
    this.encoding = encodingForModel(model);
    this.maxTokens = maxTokens;
  }

  count(text: string): number {
    return this.encoding.encode(text).length;
  }

  countMessages(messages: BaseMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += this.count(String(msg.content));
      total += 4; // Message overhead
    }
    total += 2; // Conversation overhead
    return total;
  }

  truncateToFit(
    messages: BaseMessage[],
    reserveTokens = 1000
  ): BaseMessage[] {
    const available = this.maxTokens - reserveTokens;
    const result: BaseMessage[] = [];
    let used = 2; // Conversation overhead

    // Keep system message and last user message
    const system = messages.find((m) => m._getType() === "system");
    const lastUser = [...messages].reverse().find((m) => m._getType() === "human");

    if (system) {
      used += this.count(String(system.content)) + 4;
      result.push(system);
    }

    // Add messages from recent to old until budget exhausted
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg === system) continue;

      const tokens = this.count(String(msg.content)) + 4;
      if (used + tokens > available) break;

      used += tokens;
      result.unshift(msg);
    }

    return result;
  }
}
```

## Cost Tracking

```typescript
import { Counter, Histogram } from "prom-client";

const tokenCounter = new Counter({
  name: "llm_tokens_total",
  help: "Total LLM tokens used",
  labelNames: ["model", "type"], // type: input | output
});

const costCounter = new Counter({
  name: "llm_cost_usd_total",
  help: "Estimated LLM cost in USD",
  labelNames: ["model"],
});

const latencyHistogram = new Histogram({
  name: "llm_request_duration_seconds",
  help: "LLM request latency",
  labelNames: ["model", "status"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Pricing per 1K tokens (as of Dec 2025)
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "claude-3-5-sonnet": { input: 0.003, output: 0.015 },
};

function trackUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number
) {
  tokenCounter.inc({ model, type: "input" }, inputTokens);
  tokenCounter.inc({ model, type: "output" }, outputTokens);

  const pricing = PRICING[model] || { input: 0.01, output: 0.03 };
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;
  costCounter.inc({ model }, cost);

  latencyHistogram.observe({ model, status: "success" }, latencyMs / 1000);
}
```

## Retry with Backoff

```typescript
interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryableErrors = ["rate_limit_exceeded", "timeout", "ECONNRESET"],
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      const isRetryable = retryableErrors.some(
        (e) => lastError?.message?.includes(e) || lastError?.name?.includes(e)
      );

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      logger.warn(
        { attempt, maxAttempts, delay, error: lastError.message },
        "Retrying after error"
      );

      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}
```

## Graceful Degradation

```typescript
async function getAIResponse(query: string): Promise<string> {
  // Try primary model
  try {
    return await primaryModel.invoke(query);
  } catch (error) {
    logger.warn({ error }, "Primary model failed, trying fallback");
  }

  // Try fallback model
  try {
    return await fallbackModel.invoke(query);
  } catch (error) {
    logger.warn({ error }, "Fallback model failed, using cached response");
  }

  // Try cached similar response
  const cached = await findSimilarCachedResponse(query);
  if (cached) {
    return `[Cached] ${cached}`;
  }

  // Final fallback
  return "I'm unable to process your request right now. Please try again later.";
}
```

## Best Practices Checklist

- [ ] Circuit breaker on all LLM calls
- [ ] Embedding cache (80% cost savings)
- [ ] Token counting before calls
- [ ] Cost tracking with Prometheus
- [ ] Retry with exponential backoff
- [ ] Graceful degradation chain
- [ ] Timeouts on all external calls
- [ ] Structured logging with request IDs
