---
name: testing-strategy-builder
description: Use this skill when implementing tests for Node.js/TypeScript applications. Provides testing patterns for Vitest, React Testing Library, Playwright, and MSW.
version: 1.0.0
author: YG Node Starter
tags: [testing, vitest, playwright, msw, typescript]
---

# Testing Strategy Builder (Node.js/TypeScript)

## Overview

Comprehensive testing patterns for Node.js applications using Vitest, React Testing Library, Playwright, and MSW.

## Vitest Configuration

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

## Unit Testing Patterns

### Service Testing
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('UserService', () => {
  let userService: UserService;
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = createMockDb();
    userService = new UserService(mockDb);
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
      });

      const user = await userService.findById('123');

      expect(user).toBeDefined();
      expect(user.id).toBe('123');
    });

    it('throws NotFoundError when user does not exist', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(userService.findById('999'))
        .rejects
        .toThrow(NotFoundError);
    });
  });
});
```

### Mocking with vi
```typescript
// Mock module
vi.mock('./database', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
  },
}));

// Spy on function
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock implementation
vi.mocked(externalService.call).mockResolvedValue({ data: 'test' });

// Mock timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

## API Testing (Hono)

### Testing Hono Routes
```typescript
import { describe, it, expect } from 'vitest';
import { testClient } from 'hono/testing';
import { app } from '../app';

describe('Users API', () => {
  const client = testClient(app);

  it('GET /api/users returns list', async () => {
    const res = await client.api.users.$get();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeInstanceOf(Array);
  });

  it('POST /api/users creates user', async () => {
    const res = await client.api.users.$post({
      json: {
        email: 'new@example.com',
        name: 'New User',
      },
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.email).toBe('new@example.com');
  });

  it('returns 400 for invalid data', async () => {
    const res = await client.api.users.$post({
      json: { email: 'invalid' },
    });

    expect(res.status).toBe(400);
  });
});
```

## MSW (Mock Service Worker)

### Setup
```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json({
      data: [
        { id: '1', name: 'Test User' },
      ],
    });
  }),

  http.get('/api/users/:id', ({ params }) => {
    if (params.id === '404') {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      data: { id: params.id, name: 'Test User' },
    });
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { data: { id: '123', ...body } },
      { status: 201 }
    );
  }),
];
```

```typescript
// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// src/test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Override Handlers in Tests
```typescript
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

it('handles server error', async () => {
  server.use(
    http.get('/api/users', () => {
      return HttpResponse.json(
        { error: { message: 'Server error' } },
        { status: 500 }
      );
    })
  );

  // Test error handling...
});
```

## React Component Testing

### Setup
```typescript
// src/test/utils.tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}
```

### Component Test
```typescript
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { UserCard } from './UserCard';

describe('UserCard', () => {
  it('renders user data', async () => {
    renderWithProviders(<UserCard id="1" />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });

  it('handles click events', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    renderWithProviders(<UserCard id="1" onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith('1');
  });

  it('shows loading skeleton', () => {
    renderWithProviders(<UserCard id="1" />);

    expect(screen.getByTestId('user-card-skeleton')).toBeInTheDocument();
  });
});
```

## E2E Testing (Playwright)

### playwright.config.ts
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test
```typescript
import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test('can create a new user', async ({ page }) => {
    await page.goto('/users');

    await page.click('button:has-text("Add User")');

    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="name"]', 'Test User');
    await page.click('button:has-text("Create")');

    await expect(page.locator('text=Test User')).toBeVisible();
  });

  test('shows validation errors', async ({ page }) => {
    await page.goto('/users/new');

    await page.click('button:has-text("Create")');

    await expect(page.locator('text=Email is required')).toBeVisible();
  });
});
```

## Test Organization

```
src/
├── services/
│   ├── userService.ts
│   └── userService.test.ts      # Unit tests co-located
├── routes/
│   ├── users.ts
│   └── users.test.ts            # API tests co-located
├── components/
│   ├── UserCard.tsx
│   └── UserCard.test.tsx        # Component tests co-located
├── test/
│   ├── setup.ts                 # Global test setup
│   ├── utils.tsx                # Test utilities
│   └── mocks/
│       ├── handlers.ts          # MSW handlers
│       └── server.ts            # MSW server
e2e/
├── users.spec.ts                # E2E tests
└── auth.spec.ts
```

## Best Practices

1. **Use MSW for network mocking** - Never mock fetch directly
2. **Co-locate tests** - Keep `.test.ts` next to source files
3. **Test behavior, not implementation** - Focus on what, not how
4. **Use Testing Library queries** - Prefer `getByRole`, `getByText`
5. **Await async operations** - Use `waitFor` for async UI
6. **Reset state between tests** - Use `beforeEach`, `afterEach`
7. **80% coverage target** - Focus on meaningful coverage
