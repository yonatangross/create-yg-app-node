/**
 * User Repository Implementation
 *
 * Implements IUserRepository using Drizzle ORM
 * Follows SkillForge patterns with type-safe database operations
 */

import { eq, desc, count } from 'drizzle-orm';
import { getDb } from '../client.js';
import { users } from '../schema/index.js';
import type { User, NewUser, PublicUser } from '../schema/index.js';
import type { IUserRepository } from './interfaces.js';
import { logger } from '../../lib/logger.js';

export class UserRepository implements IUserRepository {
  /**
   * Create a new user
   */
  async create(data: NewUser): Promise<User> {
    try {
      const db = await getDb();

      const [user] = await db.insert(users).values(data).returning();

      if (!user) {
        throw new Error('Failed to create user');
      }

      logger.info({ userId: user.id, email: user.email }, 'User created');

      return user;
    } catch (error) {
      logger.error({ error, email: data.email }, 'Failed to create user');
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      const db = await getDb();

      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      });

      return user ?? null;
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to find user by ID');
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const db = await getDb();

      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      return user ?? null;
    } catch (error) {
      logger.error({ error, email }, 'Failed to find user by email');
      throw error;
    }
  }

  /**
   * Update user
   */
  async update(id: string, data: Partial<NewUser>): Promise<User> {
    try {
      const db = await getDb();

      const [updated] = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updated) {
        throw new Error(`User not found: ${id}`);
      }

      logger.info({ userId: id }, 'User updated');

      return updated;
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to update user');
      throw error;
    }
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    try {
      const db = await getDb();

      await db.delete(users).where(eq(users.id, id));

      logger.info({ userId: id }, 'User deleted');
    } catch (error) {
      logger.error({ error, userId: id }, 'Failed to delete user');
      throw error;
    }
  }

  /**
   * List users with pagination
   */
  async list(params: {
    limit?: number;
    offset?: number;
  }): Promise<{ users: PublicUser[]; total: number }> {
    try {
      const db = await getDb();
      const { limit = 20, offset = 0 } = params;

      // Fetch users
      const usersList = await db.query.users.findMany({
        orderBy: [desc(users.createdAt)],
        limit,
        offset,
      });

      // Count total
      const totalResult = await db
        .select({ value: count() })
        .from(users);

      const total = totalResult[0]?.value ?? 0;

      // Remove password hash from response
      const publicUsers: PublicUser[] = usersList.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ passwordHash: _excluded, ...user }) => user
      );

      return {
        users: publicUsers,
        total,
      };
    } catch (error) {
      logger.error({ error, params }, 'Failed to list users');
      throw error;
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
