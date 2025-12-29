/**
 * Resilience Manager - Unified facade for circuit breaker + bulkhead
 *
 * Pattern: Combines multiple resilience patterns into a single API
 * with sensible defaults for different operation types.
 */

import {
  CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from './circuit-breaker.js';
import {
  Bulkhead,
  BulkheadTier,
  type BulkheadConfig,
  type BulkheadStats,
} from './bulkhead.js';
import { getLogger } from '../logger.js';
import { getConfig } from '../config.js';

const logger = getLogger();

export interface ResilienceConfig {
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Bulkhead configuration */
  bulkhead?: Partial<BulkheadConfig>;
  /** Enable circuit breaker (default: true) */
  enableCircuitBreaker?: boolean;
  /** Enable bulkhead (default: true) */
  enableBulkhead?: boolean;
}

export interface ResilienceStats {
  circuitBreaker?: CircuitBreakerStats;
  bulkhead?: BulkheadStats;
}

/**
 * Resilience Manager with circuit breaker and bulkhead
 *
 * Usage:
 * ```typescript
 * const manager = new ResilienceManager('external-api', {
 *   circuitBreaker: {
 *     failureThreshold: 5,
 *     timeoutMs: 5000,
 *   },
 *   bulkhead: {
 *     maxConcurrent: 10,
 *     tier: BulkheadTier.STANDARD,
 *   },
 * });
 *
 * const result = await manager.execute(() => externalApi.call());
 * ```
 */
export class ResilienceManager {
  private circuitBreaker?: CircuitBreaker;
  private bulkhead?: Bulkhead;

  constructor(
    private name: string,
    config: ResilienceConfig = {}
  ) {
    const appConfig = getConfig();

    // Initialize circuit breaker
    if (config.enableCircuitBreaker !== false) {
      const cbConfig: CircuitBreakerConfig = {
        name: this.name,
        failureThreshold: config.circuitBreaker?.failureThreshold ?? 5,
        windowMs: config.circuitBreaker?.windowMs ?? 60000,
        resetTimeoutMs:
          config.circuitBreaker?.resetTimeoutMs ??
          appConfig.CIRCUIT_BREAKER_RESET_TIMEOUT,
        timeoutMs:
          config.circuitBreaker?.timeoutMs ??
          appConfig.CIRCUIT_BREAKER_TIMEOUT,
      };

      this.circuitBreaker = new CircuitBreaker(cbConfig);

      // Wire up event handlers
      this.circuitBreaker.on('open', () => {
        logger.error({ name: this.name }, 'Circuit breaker opened');
      });

      this.circuitBreaker.on('halfOpen', () => {
        logger.warn({ name: this.name }, 'Circuit breaker half-open');
      });

      this.circuitBreaker.on('stateChange', ({ from, to }) => {
        logger.info({ name: this.name, from, to }, 'Circuit state changed');
      });
    }

    // Initialize bulkhead
    if (config.enableBulkhead !== false) {
      const bhConfig: BulkheadConfig = {
        name: this.name,
        tier: config.bulkhead?.tier ?? BulkheadTier.STANDARD,
        maxConcurrent: config.bulkhead?.maxConcurrent ?? 10,
        maxQueueSize: config.bulkhead?.maxQueueSize ?? 20,
      };

      this.bulkhead = new Bulkhead(bhConfig);
    }

    logger.debug(
      {
        name: this.name,
        circuitBreakerEnabled: !!this.circuitBreaker,
        bulkheadEnabled: !!this.bulkhead,
      },
      'Resilience manager initialized'
    );
  }

  /**
   * Execute an async operation with resilience protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Apply circuit breaker and bulkhead in order
    // Circuit breaker is outermost (fails fast)
    // Bulkhead is innermost (limits concurrency)

    if (this.circuitBreaker && this.bulkhead) {
      return this.circuitBreaker.execute(() => this.bulkhead!.execute(fn));
    }

    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(fn);
    }

    if (this.bulkhead) {
      return this.bulkhead.execute(fn);
    }

    return fn();
  }

  /**
   * Get combined statistics
   */
  getStats(): ResilienceStats {
    const stats: ResilienceStats = {};

    if (this.circuitBreaker) {
      stats.circuitBreaker = this.circuitBreaker.getStats();
    }

    if (this.bulkhead) {
      stats.bulkhead = this.bulkhead.getStats();
    }

    return stats;
  }

  /**
   * Reset all resilience components
   */
  reset(): void {
    this.circuitBreaker?.reset();
    this.bulkhead?.clear();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.circuitBreaker?.destroy();
    this.bulkhead?.clear();
  }
}

/**
 * Registry of named resilience managers
 */
class ResilienceRegistry {
  private managers = new Map<string, ResilienceManager>();

  /**
   * Get or create a named resilience manager
   */
  getOrCreate(
    name: string,
    config?: ResilienceConfig
  ): ResilienceManager {
    let manager = this.managers.get(name);

    if (!manager) {
      manager = new ResilienceManager(name, config);
      this.managers.set(name, manager);
      logger.debug({ name }, 'Created new resilience manager');
    }

    return manager;
  }

  /**
   * Get all managers
   */
  getAll(): Map<string, ResilienceManager> {
    return new Map(this.managers);
  }

  /**
   * Get statistics for all managers
   */
  getAllStats(): Record<string, ResilienceStats> {
    const stats: Record<string, ResilienceStats> = {};

    this.managers.forEach((manager, name) => {
      stats[name] = manager.getStats();
    });

    return stats;
  }

  /**
   * Reset all managers
   */
  resetAll(): void {
    this.managers.forEach((manager) => {
      manager.reset();
    });
  }

  /**
   * Destroy all managers
   */
  destroyAll(): void {
    this.managers.forEach((manager) => {
      manager.destroy();
    });
    this.managers.clear();
  }
}

// Global registry
const registry = new ResilienceRegistry();

/**
 * Get or create a named resilience manager
 *
 * Usage:
 * ```typescript
 * const manager = getResilienceManager('external-api', {
 *   circuitBreaker: { timeoutMs: 5000 },
 * });
 *
 * const result = await manager.execute(() => externalApi.call());
 * ```
 */
export function getResilienceManager(
  name: string,
  config?: ResilienceConfig
): ResilienceManager {
  return registry.getOrCreate(name, config);
}

/**
 * Get statistics for all resilience managers
 */
export function getAllResilienceStats(): Record<string, ResilienceStats> {
  return registry.getAllStats();
}

/**
 * Reset all resilience managers
 */
export function resetAllResilience(): void {
  registry.resetAll();
}

/**
 * Destroy all resilience managers
 */
export function destroyAllResilience(): void {
  registry.destroyAll();
}
