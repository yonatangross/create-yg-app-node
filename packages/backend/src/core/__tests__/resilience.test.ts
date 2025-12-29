/**
 * Tests for resilience patterns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  TimeoutError,
} from '../resilience/circuit-breaker.js';
import {
  Bulkhead,
  BulkheadTier,
  BulkheadRejectedError,
} from '../resilience/bulkhead.js';
import { ResilienceManager, getResilienceManager } from '../resilience/manager.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      windowMs: 60000,
      resetTimeoutMs: 1000,
      timeoutMs: 500,
    });
  });

  it('should execute successful operations', async () => {
    const fn = vi.fn(async () => 'success');
    const result = await breaker.execute(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledOnce();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should timeout slow operations', async () => {
    const slowFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return 'too-slow';
    };

    await expect(breaker.execute(slowFn)).rejects.toThrow(TimeoutError);
  });

  it('should open circuit after threshold failures', async () => {
    const failingFn = vi.fn(async () => {
      throw new Error('Service unavailable');
    });

    // Cause 3 failures to trip the breaker
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingFn)).rejects.toThrow(
        'Service unavailable'
      );
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(failingFn).toHaveBeenCalledTimes(3);

    // Next call should be rejected without calling function
    await expect(breaker.execute(failingFn)).rejects.toThrow(
      CircuitBreakerError
    );
    expect(failingFn).toHaveBeenCalledTimes(3); // Still 3, not 4
  });

  it('should transition to half-open after reset timeout', async () => {
    const failingFn = async () => {
      throw new Error('Failure');
    };

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingFn)).rejects.toThrow();
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it('should get stats', () => {
    const stats = breaker.getStats();

    expect(stats).toMatchObject({
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      rejections: 0,
    });
  });
});

describe('Bulkhead', () => {
  let bulkhead: Bulkhead;

  beforeEach(() => {
    bulkhead = new Bulkhead({
      name: 'test-bulkhead',
      tier: BulkheadTier.STANDARD,
      maxConcurrent: 2,
      maxQueueSize: 2,
    });
  });

  it('should execute operations within limit', async () => {
    const fn = vi.fn(async () => 'result');

    const result = await bulkhead.execute(fn);

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should queue operations when at max concurrent', async () => {
    let resolve1: (() => void) | undefined;
    let resolve2: (() => void) | undefined;

    const promise1 = new Promise<void>((res) => {
      resolve1 = res;
    });
    const promise2 = new Promise<void>((res) => {
      resolve2 = res;
    });

    const fn1 = async () => {
      await promise1;
      return 'result1';
    };
    const fn2 = async () => {
      await promise2;
      return 'result2';
    };
    const fn3 = vi.fn(async () => 'result3');

    // Start 2 concurrent operations (max)
    const exec1 = bulkhead.execute(fn1);
    const exec2 = bulkhead.execute(fn2);

    // Third should be queued
    const exec3 = bulkhead.execute(fn3);

    // fn3 shouldn't have been called yet
    expect(fn3).not.toHaveBeenCalled();

    // Complete first operation
    resolve1!();
    await exec1;

    // Wait a bit for queued task to start
    await new Promise((res) => setTimeout(res, 10));

    // Now fn3 should have been called
    expect(fn3).toHaveBeenCalled();

    // Clean up
    resolve2!();
    await Promise.all([exec2, exec3]);
  });

  it('should reject when queue is full', async () => {
    const blockingFn = async () => {
      await new Promise<void>((res) => {
        // Auto-resolve after a short delay to prevent deadlock
        setTimeout(() => {
          res();
        }, 100);
      });
      return 'blocked';
    };

    // Fill concurrent slots (2)
    const exec1 = bulkhead.execute(blockingFn);
    const exec2 = bulkhead.execute(blockingFn);

    // Wait a tick to ensure they're running
    await new Promise((res) => setTimeout(res, 10));

    // Fill queue (2)
    const exec3 = bulkhead.execute(blockingFn);
    const exec4 = bulkhead.execute(blockingFn);

    // Wait a tick to ensure queue is full
    await new Promise((res) => setTimeout(res, 10));

    // Next should be rejected
    await expect(bulkhead.execute(blockingFn)).rejects.toThrow(
      BulkheadRejectedError
    );

    // Wait for all executions to complete
    await Promise.all([exec1, exec2, exec3, exec4]);
  }, 10000);

  it('should get stats', () => {
    const stats = bulkhead.getStats();

    expect(stats).toMatchObject({
      tier: BulkheadTier.STANDARD,
      currentConcurrent: 0,
      maxConcurrent: 2,
      queueSize: 0,
      maxQueueSize: 2,
      totalExecuted: 0,
      totalRejected: 0,
    });
  });
});

describe('ResilienceManager', () => {
  it('should execute with both circuit breaker and bulkhead', async () => {
    const manager = new ResilienceManager('test-service', {
      circuitBreaker: {
        failureThreshold: 3,
        timeoutMs: 1000,
      },
      bulkhead: {
        maxConcurrent: 5,
        tier: BulkheadTier.STANDARD,
      },
    });

    const fn = vi.fn(async () => 'success');
    const result = await manager.execute(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledOnce();

    const stats = manager.getStats();
    expect(stats.circuitBreaker).toBeDefined();
    expect(stats.bulkhead).toBeDefined();
  });

  it('should work with only circuit breaker', async () => {
    const manager = new ResilienceManager('test-cb-only', {
      enableBulkhead: false,
    });

    const fn = vi.fn(async () => 'success');
    await manager.execute(fn);

    const stats = manager.getStats();
    expect(stats.circuitBreaker).toBeDefined();
    expect(stats.bulkhead).toBeUndefined();
  });

  it('should work with only bulkhead', async () => {
    const manager = new ResilienceManager('test-bh-only', {
      enableCircuitBreaker: false,
    });

    const fn = vi.fn(async () => 'success');
    await manager.execute(fn);

    const stats = manager.getStats();
    expect(stats.circuitBreaker).toBeUndefined();
    expect(stats.bulkhead).toBeDefined();
  });
});

describe('getResilienceManager', () => {
  it('should return same instance for same name', () => {
    const manager1 = getResilienceManager('shared-service');
    const manager2 = getResilienceManager('shared-service');

    expect(manager1).toBe(manager2);
  });

  it('should return different instances for different names', () => {
    const manager1 = getResilienceManager('service-a');
    const manager2 = getResilienceManager('service-b');

    expect(manager1).not.toBe(manager2);
  });
});
