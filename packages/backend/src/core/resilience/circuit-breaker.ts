/**
 * Circuit Breaker implementation for resilient async operations
 *
 * Pattern: Prevents cascading failures by stopping requests to failing services
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing recovery)
 */

import { EventEmitter } from 'node:events';
import { getLogger } from '../logger.js';

const logger = getLogger();

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Failure count threshold to open circuit */
  failureThreshold: number;
  /** Time window in ms to count failures */
  windowMs: number;
  /** Time in ms to wait before attempting recovery */
  resetTimeoutMs: number;
  /** Timeout in ms for individual operations */
  timeoutMs: number;
  /** Name for logging and metrics */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  rejections: number;
  lastStateChange: Date;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public state: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Async Circuit Breaker
 *
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   windowMs: 60000,
 *   resetTimeoutMs: 30000,
 *   timeoutMs: 3000,
 *   name: 'external-api',
 * });
 *
 * breaker.on('open', () => logger.error('Circuit opened'));
 *
 * const result = await breaker.execute(() => externalApi.call());
 * ```
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private rejections = 0;
  private lastFailureTime: number | null = null;
  private lastStateChange = new Date();
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(private config: CircuitBreakerConfig) {
    super();
    logger.debug({ name: config.name, config }, 'Circuit breaker initialized');
  }

  /**
   * Execute an async operation with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      this.rejections++;
      const error = new CircuitBreakerError(
        `Circuit breaker "${this.config.name}" is OPEN`,
        CircuitState.OPEN
      );
      this.emit('reject', error);
      throw error;
    }

    // Execute with timeout
    try {
      const result = await this.withTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(this.config.timeoutMs));
      }, this.config.timeoutMs);
    });

    return Promise.race([fn(), timeoutPromise]);
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.emit('success');

    // Transition from HALF_OPEN to CLOSED on success
    if (this.state === CircuitState.HALF_OPEN) {
      this.setState(CircuitState.CLOSED);
      this.failures = 0;
      logger.info(
        { name: this.config.name },
        'Circuit breaker recovered to CLOSED'
      );
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.emit('failure', error);

    // Check if we need to open the circuit
    if (this.shouldOpen()) {
      this.open();
    }
  }

  /**
   * Check if circuit should open based on failure threshold
   */
  private shouldOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      return false;
    }

    // Check failure threshold within time window
    if (this.lastFailureTime) {
      const windowStart = Date.now() - this.config.windowMs;
      if (this.lastFailureTime < windowStart) {
        // Outside window, reset counter
        this.failures = 1;
        return false;
      }
    }

    return this.failures >= this.config.failureThreshold;
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.setState(CircuitState.OPEN);
    this.emit('open');
    logger.error(
      {
        name: this.config.name,
        failures: this.failures,
        threshold: this.config.failureThreshold,
      },
      'Circuit breaker opened due to failures'
    );

    // Set timer to transition to HALF_OPEN
    this.resetTimer = setTimeout(() => {
      this.setState(CircuitState.HALF_OPEN);
      this.emit('halfOpen');
      logger.info(
        { name: this.config.name },
        'Circuit breaker attempting recovery (HALF_OPEN)'
      );
    }, this.config.resetTimeoutMs);
  }

  /**
   * Update circuit state
   */
  private setState(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();
    this.emit('stateChange', { from: oldState, to: newState });
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      rejections: this.rejections,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.setState(CircuitState.CLOSED);
    this.failures = 0;
    this.successes = 0;
    this.rejections = 0;
    this.lastFailureTime = null;
    this.emit('reset');
    logger.info({ name: this.config.name }, 'Circuit breaker manually reset');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.removeAllListeners();
  }
}
