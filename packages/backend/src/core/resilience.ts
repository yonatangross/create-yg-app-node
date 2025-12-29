/**
 * Resilience Manager
 *
 * Circuit breaker implementation using opossum for production resilience.
 * Protects external service calls from cascading failures.
 *
 * Pattern: Wrap all external calls (LLM, vector search, external APIs)
 * with circuit breakers to prevent system-wide failures.
 */

import CircuitBreaker from 'opossum';
import type { Options as CircuitBreakerOptions } from 'opossum';
import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * Circuit breaker registry
 */
const breakerRegistry = new Map<string, CircuitBreaker>();

/**
 * Service types for circuit breaker configuration
 */
export type ServiceType = 'llm' | 'vector' | 'database' | 'http' | 'webhook';

/**
 * Circuit breaker configuration by service type
 */
const CIRCUIT_BREAKER_CONFIG: Record<ServiceType, CircuitBreakerOptions> = {
  // LLM service (generous timeout, moderate failure tolerance)
  llm: {
    timeout: 30000, // 30s timeout
    errorThresholdPercentage: 50, // Open after 50% errors
    resetTimeout: 30000, // Try again after 30s
    rollingCountTimeout: 10000, // 10s window
    rollingCountBuckets: 10,
    volumeThreshold: 5, // Min 5 requests before opening
    name: 'llm-circuit',
  },

  // Vector search (fast timeout, stricter failure handling)
  vector: {
    timeout: 10000, // 10s timeout
    errorThresholdPercentage: 40, // Open after 40% errors
    resetTimeout: 20000, // Try again after 20s
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    volumeThreshold: 3,
    name: 'vector-circuit',
  },

  // Database (moderate timeout, very strict)
  database: {
    timeout: 10000, // 10s timeout
    errorThresholdPercentage: 30, // Open after 30% errors
    resetTimeout: 15000, // Try again after 15s
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    volumeThreshold: 3,
    name: 'database-circuit',
  },

  // HTTP external APIs (fast timeout, moderate tolerance)
  http: {
    timeout: 10000, // 10s timeout
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    volumeThreshold: 5,
    name: 'http-circuit',
  },

  // Webhooks (very fast timeout, high tolerance)
  webhook: {
    timeout: 5000, // 5s timeout
    errorThresholdPercentage: 60,
    resetTimeout: 60000, // Try again after 1 min
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    volumeThreshold: 3,
    name: 'webhook-circuit',
  },
};

/**
 * Circuit breaker state
 */
export type CircuitState = 'open' | 'closed' | 'half-open';

/**
 * Get or create a circuit breaker for a service
 *
 * @param serviceType - Type of service
 * @param serviceName - Unique name for this service instance
 * @param customOptions - Optional custom circuit breaker options
 * @returns Circuit breaker instance
 */
export function getCircuitBreaker<TArgs extends unknown[], TResult>(
  serviceType: ServiceType,
  serviceName: string,
  customOptions?: Partial<CircuitBreakerOptions>
): CircuitBreaker<TArgs, TResult> {
  const breakerKey = `${serviceType}:${serviceName}`;

  // Return existing breaker if available
  if (breakerRegistry.has(breakerKey)) {
    return breakerRegistry.get(breakerKey) as CircuitBreaker<TArgs, TResult>;
  }

  // Create new breaker with service-specific config
  const config = {
    ...CIRCUIT_BREAKER_CONFIG[serviceType],
    ...customOptions,
    name: `${serviceType}:${serviceName}`,
  };

  // Note: Circuit breaker needs a function to wrap, but we'll provide that when calling .fire()
  const breaker = new CircuitBreaker<TArgs, TResult>(
    // Dummy function - actual function is passed to .fire()
    async (..._args: TArgs): Promise<TResult> => {
      throw new Error('Circuit breaker not initialized with function');
    },
    config
  );

  // Setup event listeners for monitoring
  breaker.on('open', () => {
    logger.warn(
      {
        service: breakerKey,
        state: 'open',
        errorRate: breaker.stats.failures / breaker.stats.fires,
      },
      'Circuit breaker opened - too many failures'
    );
  });

  breaker.on('halfOpen', () => {
    logger.info({ service: breakerKey, state: 'half-open' }, 'Circuit breaker half-open - testing');
  });

  breaker.on('close', () => {
    logger.info({ service: breakerKey, state: 'closed' }, 'Circuit breaker closed - service healthy');
  });

  breaker.on('failure', (error: Error) => {
    logger.error(
      {
        service: breakerKey,
        error: error.message,
        stats: breaker.stats,
      },
      'Circuit breaker failure'
    );
  });

  breaker.on('timeout', () => {
    logger.warn({ service: breakerKey, timeout: config.timeout }, 'Circuit breaker timeout');
  });

  breaker.on('reject', () => {
    logger.warn({ service: breakerKey }, 'Circuit breaker rejected request - circuit is open');
  });

  breaker.on('fallback', (result: unknown) => {
    logger.info({ service: breakerKey, result }, 'Circuit breaker fallback executed');
  });

  breakerRegistry.set(breakerKey, breaker as CircuitBreaker);

  logger.info({ service: breakerKey, config }, 'Circuit breaker created');

  return breaker;
}

/**
 * Wrap a function with circuit breaker protection
 *
 * @param fn - The async function to protect
 * @param serviceType - Type of service
 * @param serviceName - Unique service name
 * @param options - Optional circuit breaker options
 * @returns Protected function
 *
 * @example
 * ```typescript
 * const safeLLMCall = withCircuitBreaker(
 *   (messages) => model.invoke(messages),
 *   'llm',
 *   'openai-gpt4'
 * );
 *
 * const result = await safeLLMCall(messages);
 * ```
 */
export function withCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  serviceType: ServiceType,
  serviceName: string,
  options?: Partial<CircuitBreakerOptions>
): (...args: TArgs) => Promise<TResult> {
  const breakerConfig = {
    ...CIRCUIT_BREAKER_CONFIG[serviceType],
    ...options,
    name: `${serviceType}:${serviceName}`,
  };

  return async (...args: TArgs): Promise<TResult> => {
    // Create a new circuit breaker with the actual function for each call
    const executionBreaker = new CircuitBreaker<TArgs, TResult>(
      fn,
      breakerConfig
    );

    // Setup logging for this execution
    executionBreaker.on('failure', (error: Error) => {
      logger.error(
        {
          service: `${serviceType}:${serviceName}`,
          error: error.message,
        },
        'Circuit breaker failure'
      );
    });

    executionBreaker.on('timeout', () => {
      logger.warn({ service: `${serviceType}:${serviceName}` }, 'Circuit breaker timeout');
    });

    return executionBreaker.fire(...args);
  };
}

/**
 * Get circuit breaker state
 *
 * @param serviceType - Type of service
 * @param serviceName - Service name
 * @returns Circuit state or null if not found
 */
export function getCircuitState(
  serviceType: ServiceType,
  serviceName: string
): CircuitState | null {
  const breakerKey = `${serviceType}:${serviceName}`;
  const breaker = breakerRegistry.get(breakerKey);

  if (!breaker) {
    return null;
  }

  if (breaker.opened) return 'open';
  if (breaker.halfOpen) return 'half-open';
  return 'closed';
}

/**
 * Get circuit breaker statistics
 *
 * @param serviceType - Type of service
 * @param serviceName - Service name
 * @returns Stats or null if not found
 */
export function getCircuitStats(
  serviceType: ServiceType,
  serviceName: string
): CircuitBreaker['stats'] | null {
  const breakerKey = `${serviceType}:${serviceName}`;
  const breaker = breakerRegistry.get(breakerKey);
  return breaker?.stats ?? null;
}

/**
 * Reset a circuit breaker (for testing/admin purposes)
 *
 * @param serviceType - Type of service
 * @param serviceName - Service name
 */
export function resetCircuitBreaker(
  serviceType: ServiceType,
  serviceName: string
): void {
  const breakerKey = `${serviceType}:${serviceName}`;
  const breaker = breakerRegistry.get(breakerKey);

  if (breaker) {
    breaker.close();
    logger.info({ service: breakerKey }, 'Circuit breaker manually reset');
  }
}

/**
 * Get all circuit breaker states for health checks
 *
 * @returns Map of service names to states
 */
export function getAllCircuitStates(): Map<string, {
  state: CircuitState;
  stats: CircuitBreaker['stats'];
}> {
  const states = new Map<string, { state: CircuitState; stats: CircuitBreaker['stats'] }>();

  breakerRegistry.forEach((breaker, key) => {
    let state: CircuitState = 'closed';
    if (breaker.opened) state = 'open';
    else if (breaker.halfOpen) state = 'half-open';

    states.set(key, {
      state,
      stats: breaker.stats,
    });
  });

  return states;
}

/**
 * Graceful degradation helper
 *
 * Executes a function with a fallback if the circuit is open
 * or the operation fails.
 *
 * @param fn - The primary function
 * @param fallback - The fallback function or value
 * @param serviceType - Service type
 * @param serviceName - Service name
 * @returns Result or fallback
 *
 * @example
 * ```typescript
 * const context = await withGracefulDegradation(
 *   () => vectorStore.search(query),
 *   [], // Empty array as fallback
 *   'vector',
 *   'memory-search'
 * );
 * ```
 */
export async function withGracefulDegradation<TResult>(
  fn: () => Promise<TResult>,
  fallback: TResult | (() => Promise<TResult>),
  serviceType: ServiceType,
  serviceName: string
): Promise<TResult> {
  try {
    const protectedFn = withCircuitBreaker(fn, serviceType, serviceName);
    return await protectedFn();
  } catch (error) {
    logger.warn(
      {
        service: `${serviceType}:${serviceName}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Graceful degradation - using fallback'
    );

    if (typeof fallback === 'function') {
      return await (fallback as () => Promise<TResult>)();
    }
    return fallback;
  }
}

/**
 * Health check for all circuit breakers
 *
 * @returns Health status
 */
export function getCircuitBreakerHealth(): {
  healthy: boolean;
  openCircuits: string[];
  totalCircuits: number;
} {
  const allStates = getAllCircuitStates();
  const openCircuits: string[] = [];

  allStates.forEach((value, key) => {
    if (value.state === 'open') {
      openCircuits.push(key);
    }
  });

  return {
    healthy: openCircuits.length === 0,
    openCircuits,
    totalCircuits: allStates.size,
  };
}

/**
 * Shutdown all circuit breakers
 */
export function shutdownCircuitBreakers(): void {
  logger.info({ count: breakerRegistry.size }, 'Shutting down circuit breakers');
  breakerRegistry.clear();
}
