import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateUserSchema,
  UpdateUserSchema,
  PaginationParamsSchema,
  createPaginationMeta,
} from '@yg-app/shared';
import type { AppEnv } from '../types.js';

const usersRoutes = new Hono<AppEnv>();

// In-memory store for demo (replace with Drizzle DB)
const users = new Map<
  string,
  {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }
>();

/**
 * List users with pagination
 */
usersRoutes.get('/', zValidator('query', PaginationParamsSchema), async (c) => {
  const { page, limit } = c.req.valid('query');
  const allUsers = Array.from(users.values());
  const start = (page - 1) * limit;
  const items = allUsers.slice(start, start + limit);

  return c.json({
    success: true,
    data: {
      items,
      pagination: createPaginationMeta(allUsers.length, page, limit),
    },
  });
});

/**
 * Get user by ID
 */
usersRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = users.get(id);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
      404
    );
  }

  return c.json({ success: true, data: user });
});

/**
 * Create new user
 */
usersRoutes.post('/', zValidator('json', CreateUserSchema), async (c) => {
  const data = c.req.valid('json');
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  users.set(user.id, user);

  return c.json({ success: true, data: user }, 201);
});

/**
 * Update user
 */
usersRoutes.patch('/:id', zValidator('json', UpdateUserSchema), async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');
  const user = users.get(id);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
      404
    );
  }

  // Filter out undefined values from updates
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined)
  );

  const updated = {
    ...user,
    ...filteredUpdates,
    updatedAt: new Date().toISOString(),
  };

  users.set(id, updated);

  return c.json({ success: true, data: updated });
});

/**
 * Delete user
 */
usersRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existed = users.delete(id);

  if (!existed) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
      404
    );
  }

  return c.body(null, 204);
});

export { usersRoutes };
