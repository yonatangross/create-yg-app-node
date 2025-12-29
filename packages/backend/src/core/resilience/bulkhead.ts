/**
 * Bulkhead pattern for resource isolation
 *
 * Pattern: Isolates resources into tiers (CRITICAL, STANDARD, OPTIONAL)
 * to prevent one tier from exhausting system resources.
 */

import { getLogger } from '../logger.js';

const logger = getLogger();

export enum BulkheadTier {
  CRITICAL = 'CRITICAL',
  STANDARD = 'STANDARD',
  OPTIONAL = 'OPTIONAL',
}

export interface BulkheadConfig {
  /** Maximum concurrent executions */
  maxConcurrent: number;
  /** Maximum queue size */
  maxQueueSize: number;
  /** Resource tier */
  tier: BulkheadTier;
  /** Name for logging and metrics */
  name?: string;
}

export interface BulkheadStats {
  tier: BulkheadTier;
  currentConcurrent: number;
  maxConcurrent: number;
  queueSize: number;
  maxQueueSize: number;
  totalExecuted: number;
  totalRejected: number;
}

export class BulkheadRejectedError extends Error {
  constructor(tier: BulkheadTier, reason: string) {
    super(`Bulkhead rejected (${tier}): ${reason}`);
    this.name = 'BulkheadRejectedError';
  }
}

interface QueuedTask<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Bulkhead for resource isolation
 *
 * Usage:
 * ```typescript
 * const bulkhead = new Bulkhead({
 *   maxConcurrent: 10,
 *   maxQueueSize: 20,
 *   tier: BulkheadTier.STANDARD,
 *   name: 'api-calls',
 * });
 *
 * const result = await bulkhead.execute(() => apiCall());
 * ```
 */
export class Bulkhead {
  private currentConcurrent = 0;
  private queue: QueuedTask<unknown>[] = [];
  private totalExecuted = 0;
  private totalRejected = 0;

  constructor(private config: BulkheadConfig) {
    logger.debug(
      { name: config.name, tier: config.tier, config },
      'Bulkhead initialized'
    );
  }

  /**
   * Execute an async operation with bulkhead protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can execute immediately
    if (this.currentConcurrent < this.config.maxConcurrent) {
      return this.executeNow(fn);
    }

    // Check if queue is full
    if (this.queue.length >= this.config.maxQueueSize) {
      this.totalRejected++;
      const error = new BulkheadRejectedError(
        this.config.tier,
        `Queue full (${this.queue.length}/${this.config.maxQueueSize})`
      );
      logger.warn(
        {
          name: this.config.name,
          tier: this.config.tier,
          queueSize: this.queue.length,
        },
        'Bulkhead rejected - queue full'
      );
      throw error;
    }

    // Queue the task
    return this.enqueue(fn);
  }

  /**
   * Execute immediately
   */
  private async executeNow<T>(fn: () => Promise<T>): Promise<T> {
    this.currentConcurrent++;
    this.totalExecuted++;

    try {
      const result = await fn();
      return result;
    } finally {
      this.currentConcurrent--;
      this.processQueue();
    }
  }

  /**
   * Add task to queue
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject } as QueuedTask<unknown>);
      logger.debug(
        {
          name: this.config.name,
          tier: this.config.tier,
          queueSize: this.queue.length,
        },
        'Task queued'
      );
    });
  }

  /**
   * Process queued tasks
   */
  private processQueue(): void {
    if (
      this.queue.length === 0 ||
      this.currentConcurrent >= this.config.maxConcurrent
    ) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.currentConcurrent++;
    this.totalExecuted++;

    task
      .fn()
      .then((result) => {
        task.resolve(result);
      })
      .catch((error) => {
        task.reject(error);
      })
      .finally(() => {
        this.currentConcurrent--;
        this.processQueue();
      });
  }

  /**
   * Get current statistics
   */
  getStats(): BulkheadStats {
    return {
      tier: this.config.tier,
      currentConcurrent: this.currentConcurrent,
      maxConcurrent: this.config.maxConcurrent,
      queueSize: this.queue.length,
      maxQueueSize: this.config.maxQueueSize,
      totalExecuted: this.totalExecuted,
      totalRejected: this.totalRejected,
    };
  }

  /**
   * Clear the queue (for shutdown)
   */
  clear(): void {
    const queuedTasks = this.queue.length;
    this.queue.forEach((task) => {
      task.reject(
        new BulkheadRejectedError(
          this.config.tier,
          'Bulkhead cleared during shutdown'
        )
      );
    });
    this.queue = [];

    if (queuedTasks > 0) {
      logger.warn(
        { name: this.config.name, tier: this.config.tier, queuedTasks },
        'Bulkhead cleared pending tasks'
      );
    }
  }

  /**
   * Wait for all current executions to complete
   */
  async drain(): Promise<void> {
    while (this.currentConcurrent > 0 || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
