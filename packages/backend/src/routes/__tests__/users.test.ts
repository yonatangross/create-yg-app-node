/**
 * Integration tests for users routes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../app.js';

describe('Users Routes', () => {
  // Helper to create a test user
  const createTestUser = async (data = { email: 'test@example.com', name: 'Test User' }) => {
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res;
  };

  // Clean up: Since users route uses in-memory Map, we need to work with it
  // In a real app, you'd reset the database between tests

  describe('POST /api/users', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'alice@example.com',
        name: 'Alice Johnson',
      };

      const res = await createTestUser(userData);

      expect(res.status).toBe(201);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        email: userData.email,
        name: userData.name,
      });
      expect(body.data.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(body.data.createdAt).toBeDefined();
      expect(body.data.updatedAt).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const res = await app.request('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          name: 'Test User',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should reject missing name', async () => {
      const res = await app.request('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('should reject empty name', async () => {
      const res = await app.request('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          name: '',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject missing email', async () => {
      const res = await app.request('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user by id', async () => {
      // Create a user first
      const createRes = await createTestUser({
        email: 'bob@example.com',
        name: 'Bob Smith',
      });
      const createdUser = await createRes.json();
      const userId = createdUser.data.id;

      // Get the user
      const res = await app.request(`/api/users/${userId}`);

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: userId,
        email: 'bob@example.com',
        name: 'Bob Smith',
      });
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await app.request(`/api/users/${fakeId}`);

      expect(res.status).toBe(404);
      const body = await res.json();

      expect(body.success).toBe(false);
      expect(body.error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should update user name', async () => {
      // Create a user
      const createRes = await createTestUser({
        email: 'charlie@example.com',
        name: 'Charlie Brown',
      });
      const createdUser = await createRes.json();
      const userId = createdUser.data.id;
      const originalUpdatedAt = createdUser.data.updatedAt;

      // Small delay to ensure updatedAt changes
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update the user
      const res = await app.request(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Charlie Updated',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: userId,
        email: 'charlie@example.com',
        name: 'Charlie Updated',
      });
      expect(body.data.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('should allow partial updates', async () => {
      // Create a user
      const createRes = await createTestUser({
        email: 'diana@example.com',
        name: 'Diana Prince',
      });
      const createdUser = await createRes.json();
      const userId = createdUser.data.id;

      // Update with empty object (should succeed but change nothing except updatedAt)
      const res = await app.request(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Diana Prince');
      expect(body.data.email).toBe('diana@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await app.request(`/api/users/${fakeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Name',
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      // Create a user
      const createRes = await createTestUser({
        email: 'eve@example.com',
        name: 'Eve Adams',
      });
      const createdUser = await createRes.json();
      const userId = createdUser.data.id;

      // Delete the user
      const res = await app.request(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(204);
      expect(await res.text()).toBe('');

      // Verify user is deleted
      const getRes = await app.request(`/api/users/${userId}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await app.request(`/api/users/${fakeId}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
      const body = await res.json();

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/users', () => {
    beforeEach(async () => {
      // Create multiple users for pagination tests
      await createTestUser({ email: 'user1@example.com', name: 'User One' });
      await createTestUser({ email: 'user2@example.com', name: 'User Two' });
      await createTestUser({ email: 'user3@example.com', name: 'User Three' });
    });

    it('should list users with default pagination', async () => {
      const res = await app.request('/api/users');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.items).toBeInstanceOf(Array);
      expect(body.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
      });
      expect(body.data.pagination.total).toBeGreaterThanOrEqual(3);
    });

    it('should support custom page and limit', async () => {
      const res = await app.request('/api/users?page=1&limit=2');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeLessThanOrEqual(2);
      expect(body.data.pagination).toMatchObject({
        page: 1,
        limit: 2,
      });
    });

    it('should calculate pagination metadata correctly', async () => {
      const res = await app.request('/api/users?page=1&limit=2');

      const body = await res.json();
      const { pagination } = body.data;

      expect(pagination.totalPages).toBe(Math.ceil(pagination.total / 2));
      expect(pagination.hasNext).toBe(pagination.page < pagination.totalPages);
      expect(pagination.hasPrev).toBe(pagination.page > 1);
    });

    it('should coerce page and limit to numbers', async () => {
      const res = await app.request('/api/users?page=2&limit=5');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.pagination.page).toBe(2);
      expect(body.data.pagination.limit).toBe(5);
    });

    it('should reject invalid page number', async () => {
      const res = await app.request('/api/users?page=0');

      expect(res.status).toBe(400);
    });

    it('should reject limit over 100', async () => {
      const res = await app.request('/api/users?limit=101');

      expect(res.status).toBe(400);
    });

    it('should return empty array when page exceeds total', async () => {
      const res = await app.request('/api/users?page=9999');

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.data.items).toEqual([]);
    });
  });
});
