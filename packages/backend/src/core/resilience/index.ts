/**
 * Resilience module - Circuit breakers, bulkheads, and unified management
 *
 * Usage:
 * ```typescript
 * import { getResilienceManager, BulkheadTier } from '@/core/resilience';
 *
 * const manager = getResilienceManager('external-api', {
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

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  TimeoutError,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from './circuit-breaker.js';

// Bulkhead
export {
  Bulkhead,
  BulkheadTier,
  BulkheadRejectedError,
  type BulkheadConfig,
  type BulkheadStats,
} from './bulkhead.js';

// Manager
export {
  ResilienceManager,
  getResilienceManager,
  getAllResilienceStats,
  resetAllResilience,
  destroyAllResilience,
  type ResilienceConfig,
  type ResilienceStats,
} from './manager.js';
