/**
 * PostgresSaver Checkpointer
 *
 * LangGraph checkpoint storage using PostgreSQL.
 * Enables persistent agent state across requests.
 *
 * Usage:
 *   const checkpointer = await getCheckpointer();
 *   const graph = workflow.compile({ checkpointer });
 */

import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import postgres from 'postgres';
import { getConfig } from '../core/config.js';
import { getLogger } from '../core/logger.js';

const logger = getLogger();

/**
 * Singleton PostgresSaver instance
 */
let checkpointerInstance: PostgresSaver | null = null;

/**
 * Postgres client for checkpointer
 */
let postgresClient: postgres.Sql | null = null;

/**
 * Initialize PostgresSaver with connection pooling
 *
 * @returns PostgresSaver instance
 */
export async function initializeCheckpointer(): Promise<PostgresSaver> {
  if (checkpointerInstance) {
    return checkpointerInstance;
  }

  const config = getConfig();

  try {
    // Create postgres client if not exists
    if (!postgresClient) {
      postgresClient = postgres(config.DATABASE_URL, {
        max: config.DATABASE_POOL_MAX,
        idle_timeout: config.DATABASE_IDLE_TIMEOUT / 1000, // Convert to seconds
        connect_timeout: config.DATABASE_CONNECT_TIMEOUT / 1000, // Convert to seconds
      });

      logger.info('Postgres client created for checkpointer');
    }

    // Initialize PostgresSaver
    checkpointerInstance = PostgresSaver.fromConnString(config.DATABASE_URL);

    // Setup tables (creates if not exists)
    await checkpointerInstance.setup();

    logger.info('PostgresSaver checkpointer initialized');

    return checkpointerInstance;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize checkpointer');
    throw error;
  }
}

/**
 * Get existing checkpointer instance
 *
 * @throws Error if not initialized
 */
export function getCheckpointer(): PostgresSaver {
  if (!checkpointerInstance) {
    throw new Error(
      'Checkpointer not initialized. Call initializeCheckpointer() first.'
    );
  }
  return checkpointerInstance;
}

/**
 * Get or initialize checkpointer (lazy initialization)
 *
 * @returns PostgresSaver instance
 */
export async function getOrInitCheckpointer(): Promise<PostgresSaver> {
  if (checkpointerInstance) {
    return checkpointerInstance;
  }
  return initializeCheckpointer();
}

/**
 * Close checkpointer connection
 */
export async function closeCheckpointer(): Promise<void> {
  try {
    if (postgresClient) {
      await postgresClient.end();
      postgresClient = null;
      logger.info('Checkpointer Postgres connection closed');
    }

    checkpointerInstance = null;
  } catch (error) {
    logger.error({ error }, 'Error closing checkpointer');
  }
}

/**
 * Clear checkpoints for a thread
 *
 * Note: PostgresSaver does not have a built-in delete method.
 * Checkpoints are managed through SQL directly if needed.
 *
 * @param threadId - Thread ID to clear
 */
export async function clearThreadCheckpoints(threadId: string): Promise<void> {
  logger.warn({ threadId }, 'clearThreadCheckpoints not implemented - use SQL if needed');
  // PostgresSaver doesn't expose delete in current API
  // Would need direct SQL: DELETE FROM checkpoints WHERE thread_id = $1
}

/**
 * Get checkpoint stats
 *
 * @param threadId - Optional thread ID to get stats for
 * @returns Checkpoint count
 */
export async function getCheckpointStats(
  threadId?: string
): Promise<{ count: number }> {
  const checkpointer = getCheckpointer();

  try {
    let count = 0;
    const config = threadId ? { configurable: { thread_id: threadId } } : {};

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of checkpointer.list(config)) {
      count++;
    }

    return { count };
  } catch (error) {
    logger.error({ error }, 'Failed to get checkpoint stats');
    return { count: -1 };
  }
}
