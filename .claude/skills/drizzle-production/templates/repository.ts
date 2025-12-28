/**
 * Repository Pattern Template
 * Type-safe repository with common operations
 */

import { eq, and, desc, asc, sql, like, SQL } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db, Database } from "./db";

// =============================================================================
// Types
// =============================================================================

interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// =============================================================================
// Base Repository
// =============================================================================

export abstract class BaseRepository<
  TTable extends PgTable,
  TSelect,
  TInsert,
> {
  constructor(
    protected readonly db: Database,
    protected readonly table: TTable,
    protected readonly primaryKey: keyof TSelect & string = "id" as any
  ) {}

  async findById(id: string): Promise<TSelect | undefined> {
    const [result] = await this.db
      .select()
      .from(this.table)
      .where(eq((this.table as any)[this.primaryKey], id))
      .limit(1);

    return result as TSelect | undefined;
  }

  async findMany(params: PaginationParams): Promise<PaginatedResult<TSelect>> {
    const { page, limit, sortBy = "createdAt", sortOrder = "desc" } = params;
    const offset = (page - 1) * limit;

    const orderFn = sortOrder === "desc" ? desc : asc;
    const orderColumn = (this.table as any)[sortBy];

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(this.table)
        .orderBy(orderFn(orderColumn))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(this.table),
    ]);

    const total = countResult[0].count;
    const totalPages = Math.ceil(total / limit);

    return {
      items: items as TSelect[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async create(data: TInsert): Promise<TSelect> {
    const [result] = await this.db
      .insert(this.table)
      .values(data as any)
      .returning();

    return result as TSelect;
  }

  async createMany(data: TInsert[]): Promise<TSelect[]> {
    const results = await this.db
      .insert(this.table)
      .values(data as any)
      .returning();

    return results as TSelect[];
  }

  async update(id: string, data: Partial<TInsert>): Promise<TSelect | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq((this.table as any)[this.primaryKey], id))
      .returning();

    return result as TSelect | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await this.db
      .delete(this.table)
      .where(eq((this.table as any)[this.primaryKey], id))
      .returning();

    return !!result;
  }

  async softDelete(id: string): Promise<TSelect | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ deletedAt: new Date() } as any)
      .where(eq((this.table as any)[this.primaryKey], id))
      .returning();

    return result as TSelect | undefined;
  }

  async exists(id: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: (this.table as any)[this.primaryKey] })
      .from(this.table)
      .where(eq((this.table as any)[this.primaryKey], id))
      .limit(1);

    return !!result;
  }

  async count(where?: SQL): Promise<number> {
    const query = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table);

    if (where) {
      query.where(where);
    }

    const [result] = await query;
    return result.count;
  }
}

// =============================================================================
// Example: User Repository
// =============================================================================

import { users, User, NewUser } from "./schema";

export class UserRepository extends BaseRepository<typeof users, User, NewUser> {
  constructor(database: Database = db) {
    super(database, users);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [result] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result;
  }

  async findActiveUsers(params: PaginationParams): Promise<PaginatedResult<User>> {
    const { page, limit, sortBy = "createdAt", sortOrder = "desc" } = params;
    const offset = (page - 1) * limit;

    const orderFn = sortOrder === "desc" ? desc : asc;

    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(and(eq(users.isActive, true), sql`${users.deletedAt} IS NULL`))
        .orderBy(orderFn(users[sortBy as keyof typeof users] as any))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.isActive, true), sql`${users.deletedAt} IS NULL`)),
    ]);

    const total = countResult[0].count;
    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async search(query: string, limit = 10): Promise<User[]> {
    return this.db
      .select()
      .from(users)
      .where(
        and(
          sql`${users.deletedAt} IS NULL`,
          sql`(
            ${users.name} ILIKE ${`%${query}%`} OR
            ${users.email} ILIKE ${`%${query}%`}
          )`
        )
      )
      .limit(limit);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }
}

// =============================================================================
// Usage
// =============================================================================

/*
const userRepo = new UserRepository();

// Basic operations
const user = await userRepo.findById("uuid");
const users = await userRepo.findMany({ page: 1, limit: 20 });
const newUser = await userRepo.create({ email: "...", name: "...", passwordHash: "..." });
await userRepo.update("uuid", { name: "New Name" });
await userRepo.softDelete("uuid");

// Custom methods
const byEmail = await userRepo.findByEmail("test@example.com");
const active = await userRepo.findActiveUsers({ page: 1, limit: 10 });
const results = await userRepo.search("john");
*/
