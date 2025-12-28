import type { Context } from 'hono';

/**
 * Application environment variables available in context
 */
export interface AppVariables {
  requestId: string;
  startTime: number;
}

export interface AppEnv {
  Variables: AppVariables;
}

export type AppContext = Context<AppEnv>;
