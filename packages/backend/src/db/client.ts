import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getLogger } from '../core/logger.js';
import * as schema from './schema/index.js';

const logger = getLogger();

/**
 * Global database client instance (lazy initialization pattern)
 * Uses singleton pattern with deferred connection to avoid startup costs
 */
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;
let sqlClient: postgres.Sql | null = null;

/**
 * Database configuration
 */
interface DbConfig {
  url: string;
  max?: number;
  idleTimeout?: number;
  connectTimeout?: number;
}

/**
 * Check if running in test mode
 * Detects Vitest, Jest, or pytest environments
 */
function isTestMode(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST === 'true' ||
    Boolean(process.env.PYTEST_CURRENT_TEST)
  );
}

/**
 * Get database configuration based on environment
 */
function getDbConfig(): DbConfig {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Use smaller pool for tests
  if (isTestMode()) {
    return {
      url,
      max: 5,
      idleTimeout: 10,
      connectTimeout: 5,
    };
  }

  // Production pool configuration
  return {
    url,
    max: 20,
    idleTimeout: 30,
    connectTimeout: 10,
  };
}

/**
 * Initialize database connection with lazy loading
 * Returns singleton instance
 */
export async function getDb(): Promise<PostgresJsDatabase<typeof schema>> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    const config = getDbConfig();

    logger.info(
      {
        max: config.max,
        idleTimeout: config.idleTimeout,
        testMode: isTestMode(),
      },
      'Initializing database connection pool'
    );

    // Create postgres.js client
    const poolOptions: postgres.Options<Record<string, never>> = {
      onnotice: () => {}, // Suppress NOTICE messages
      prepare: !isTestMode(), // Disable prepared statements in tests for isolation
    };

    if (config.max !== undefined) poolOptions.max = config.max;
    if (config.idleTimeout !== undefined)
      poolOptions.idle_timeout = config.idleTimeout;
    if (config.connectTimeout !== undefined)
      poolOptions.connect_timeout = config.connectTimeout;

    sqlClient = postgres(config.url, poolOptions);

    // Create Drizzle instance
    dbInstance = drizzle(sqlClient, { schema, logger: false });

    logger.info('Database connection pool initialized');

    return dbInstance;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database connection');
    throw error;
  }
}

/**
 * Get direct SQL client (for raw queries or pgvector operations)
 */
export function getSqlClient(): postgres.Sql {
  if (!sqlClient) {
    throw new Error('Database not initialized. Call getDb() first.');
  }
  return sqlClient;
}

/**
 * Graceful shutdown: close all database connections
 * Should be called in shutdown handlers
 */
export async function closeDb(): Promise<void> {
  if (sqlClient) {
    try {
      logger.info('Closing database connections');
      await sqlClient.end({ timeout: 5 });
      sqlClient = null;
      dbInstance = null;
      logger.info('Database connections closed');
    } catch (error) {
      logger.error({ error }, 'Error closing database connections');
      throw error;
    }
  }
}

/**
 * Health check: verify database connectivity
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const sqlClient = getSqlClient();
    // Simple query to verify connection
    await sqlClient`SELECT 1 as health`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

// Re-export sql for convenience
export { sql } from 'drizzle-orm';
