-- Create Langfuse database if it doesn't exist
-- This runs on PostgreSQL startup

SELECT 'CREATE DATABASE langfuse'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'langfuse')\gexec
