# MCP Server Configuration

## Overview

YG Node Starter includes pre-configured MCP (Model Context Protocol) servers optimized for AI-powered development.

## Configured Servers

The `.mcp.json` includes 6 servers for full-stack Node.js development:

| Server | Purpose | When to Use |
|--------|---------|-------------|
| **memory** | Conversation context persistence across sessions | Always on |
| **sequential-thinking** | Advanced multi-step reasoning and analysis | Complex problems |
| **context7** | Library documentation lookup (npm, node, react) | API lookups |
| **playwright** | Browser automation and E2E testing | Testing UI |
| **postgres** | Database queries and schema inspection | DB work |
| **langfuse** | LLM tracing and observability | AI/LLM debugging |

## Server Details

### Core Servers (Always Active)

#### memory
```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"]
}
```
- Persists conversation context across sessions
- Useful for long-running projects

#### sequential-thinking
```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
}
```
- Enables structured multi-step reasoning
- Best for complex architectural decisions

#### context7
```json
{
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp@latest"]
}
```
- Looks up documentation for npm packages
- Provides real-time API references
- Supports: Node.js, React, Hono, Drizzle, LangChain.js, etc.

### Development Servers

#### playwright
```json
{
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"]
}
```
- Browser automation
- E2E testing support
- Screenshot and visual regression

#### postgres
```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres"],
  "env": {
    "POSTGRES_CONNECTION_STRING": "${POSTGRES_CONNECTION_STRING}"
  }
}
```
- Direct database access
- Schema inspection
- Query execution
- **Requires**: `POSTGRES_CONNECTION_STRING` in environment

### Observability Servers

#### langfuse
```json
{
  "type": "http",
  "url": "${LANGFUSE_MCP_URL}",
  "headers": {
    "Authorization": "Basic ${LANGFUSE_MCP_AUTH}"
  }
}
```
- LLM call tracing
- Cost monitoring
- Performance analysis
- **Requires**: Langfuse instance running (see docker-compose.yml)

## Environment Variables

Set these in `.mcp.env` (gitignored):

```bash
# PostgreSQL
POSTGRES_CONNECTION_STRING=postgresql://postgres:postgres@localhost:5433/yg_app_node

# Langfuse
LANGFUSE_MCP_URL=http://localhost:3001/api/public/mcp
LANGFUSE_MCP_AUTH=<base64-encoded-credentials>
```

## Best Practices

1. **Start minimal** - Enable only servers you need for current task
2. **Monitor tokens** - Use `/context` in Claude Code regularly
3. **Remove when done** - Disable task-specific servers after completion
4. **Keep to 3-5 servers** - Anthropic recommends this for best accuracy

## Monitoring Token Usage

Use `/context` in Claude Code to see:
- Total tokens consumed by MCP servers
- Which servers are currently active
- Token consumption per server

## References

- [Anthropic MCP Documentation](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [MCP Server Catalog](https://github.com/modelcontextprotocol/servers)
