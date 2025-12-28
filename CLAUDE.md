---
name: yg-node-starter
description: Production-ready Node.js/TypeScript application starter
version: 1.0.0
---

# YG Node Starter

> Production-ready Node.js/TypeScript application with modern tooling and AI capabilities.

## WHY

Production-ready starter template for Node.js applications. Clone, customize, and start building.

## WHAT

**Stack**: Node.js + TypeScript + Vitest + ESLint + Prettier

**Commands**: `pnpm dev` | `pnpm build` | `pnpm test` | `pnpm check`

## HOW

```bash
pnpm install   # Install dependencies
pnpm dev       # Start development (tsx watch)
pnpm test      # Run tests
pnpm check     # Lint + format + typecheck
pnpm build     # Build for production
```

---

## IMPORTANT: Code Quality

**YOU MUST** run these before committing:

```bash
pnpm run check  # Runs format:check, lint, and typecheck
```

Or individually:
```bash
pnpm run format:check   # Check formatting (Prettier)
pnpm run lint           # Lint code (ESLint)
pnpm run typecheck      # Type check (tsc --noEmit)
```

---

## IMPORTANT: Git Workflow

- **NEVER** commit directly to `main` or `dev`
- Create feature branches: `feature/<name>` or `issue/<number>-<desc>`
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`

---

## Key Files

| Purpose | Location |
|---------|----------|
| Entry point | `src/index.ts` |
| Tests | `src/**/*.test.ts` |
| Claude instructions | `.claude/instructions/*.md` |
| Git hooks | `.claude/hooks/*.sh` |

---

## Project Structure

```
src/
├── index.ts          # Application entry point
├── index.test.ts     # Tests
└── ...               # Your code here
```

---

## MCP Servers

Config: `.mcp.json` (create from `.mcp.json.example`)

---

## Testing

```bash
pnpm test           # Watch mode
pnpm test:run       # Single run
pnpm test:coverage  # With coverage
```
