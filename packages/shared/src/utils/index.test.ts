/**
 * Tests for shared utility functions
 */

import { describe, it, expect, vi } from 'vitest';
import {
  sleep,
  retry,
  ok,
  err,
  safeJsonParse,
  createPaginationMeta,
  generateRequestId,
} from './index.js';

describe('Shared Utilities', () => {
  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
    });
  });

  describe('retry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await retry(fn, { initialDelayMs: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max attempts exceeded', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(
        retry(fn, { maxAttempts: 3, initialDelayMs: 10 })
      ).rejects.toThrow('always fails');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect shouldRetry predicate', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('no retry'));

      await expect(
        retry(fn, {
          maxAttempts: 5,
          initialDelayMs: 10,
          shouldRetry: () => false, // Never retry
        })
      ).rejects.toThrow('no retry');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Result type helpers', () => {
    it('ok() should create success result', () => {
      const result = ok(42);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('err() should create error result', () => {
      const error = new Error('test error');
      const result = err(error);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('safeJsonParse', () => {
    it('should return ok result for valid JSON', () => {
      const result = safeJsonParse<{ name: string }>('{"name": "test"}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ name: 'test' });
      }
    });

    it('should return error result for invalid JSON', () => {
      const result = safeJsonParse('not valid json');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(SyntaxError);
      }
    });
  });

  describe('createPaginationMeta', () => {
    it('should calculate pagination for first page', () => {
      const meta = createPaginationMeta(100, 1, 20);

      expect(meta).toEqual({
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should calculate pagination for middle page', () => {
      const meta = createPaginationMeta(100, 3, 20);

      expect(meta).toEqual({
        page: 3,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should calculate pagination for last page', () => {
      const meta = createPaginationMeta(100, 5, 20);

      expect(meta).toEqual({
        page: 5,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: false,
        hasPrev: true,
      });
    });

    it('should handle partial last page', () => {
      const meta = createPaginationMeta(45, 3, 20);

      expect(meta.totalPages).toBe(3);
    });
  });

  describe('generateRequestId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }

      expect(ids.size).toBe(100); // All unique
    });

    it('should have expected format', () => {
      const id = generateRequestId();

      expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });
});
