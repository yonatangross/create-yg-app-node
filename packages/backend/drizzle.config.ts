import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/yg_app_node',
  },
  verbose: true,
  strict: true,
  // Generate migrations with proper naming
  migrations: {
    prefix: 'timestamp',
  },
});
