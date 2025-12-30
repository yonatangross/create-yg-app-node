/**
 * Test Setup
 * Configures testing-library, vitest globals, and MSW
 */

import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

// Enable API mocking before tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

// Reset any request handlers that are added during tests
afterEach(() => server.resetHandlers());

// Clean up after all tests are done
afterAll(() => server.close());
