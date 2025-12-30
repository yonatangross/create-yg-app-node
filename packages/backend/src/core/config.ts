/**
 * Core configuration with Zod validation and lazy initialization
 *
 * Pattern: Lazy initialization ensures config is validated only when needed
 * and can be mocked in tests.
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from project root (2 levels up from src/core/)
// Searches: packages/backend/.env -> root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(4000),
  VERSION: z.string().default('1.0.0'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // Database
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5434/yg_app_node'),
  DATABASE_POOL_MAX: z.coerce.number().default(20),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_IDLE_TIMEOUT: z.coerce.number().default(30000), // 30s
  DATABASE_CONNECT_TIMEOUT: z.coerce.number().default(10000), // 10s

  // Redis
  REDIS_URL: z.string().url().default('redis://:redis_password@localhost:6381'),
  REDIS_MAX_RETRIES: z.coerce.number().default(3),
  REDIS_CONNECT_TIMEOUT: z.coerce.number().default(10000), // 10s

  // AI/LLM
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Observability
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().url().optional(),

  // Security
  JWT_SECRET: z
    .string()
    .min(32)
    .default('change-this-in-production-minimum-32-chars'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:4173,http://localhost:4000'),
  // Trust proxy headers (X-Forwarded-For, X-Real-IP)
  // Only enable when behind a reverse proxy (nginx, cloudflare, etc.)
  TRUST_PROXY: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default('false'),

  // Resilience
  CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().default(3000), // 3s
  CIRCUIT_BREAKER_ERROR_THRESHOLD: z.coerce.number().default(50), // 50%
  CIRCUIT_BREAKER_RESET_TIMEOUT: z.coerce.number().default(30000), // 30s
  CIRCUIT_BREAKER_VOLUME_THRESHOLD: z.coerce.number().default(5), // min requests

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Graceful Shutdown
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(30000), // 30s
});

export type Config = z.infer<typeof envSchema>;

let cachedConfig: Config | null = null;

/**
 * Get validated configuration (lazy initialization)
 *
 * @throws {Error} If environment variables are invalid
 */
export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `  ${field}: ${messages?.join(', ')}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${errorMessages}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return getConfig().NODE_ENV === 'test';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

/**
 * Reset cached config (for testing)
 * @internal
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Backward-compatible config export
 * Prefer using getConfig() for lazy initialization in most cases
 */
export const config = getConfig();
