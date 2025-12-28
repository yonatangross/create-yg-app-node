# Code Quality Rules

## Pre-Commit Checklist

Before any commit, ensure:

1. **Format check passes**: `pnpm run format:check`
2. **Lint check passes**: `pnpm run lint`
3. **Type check passes**: `pnpm run typecheck`
4. **Tests pass**: `pnpm run test:run`

Quick all-in-one: `pnpm run check && pnpm run test:run`

## TypeScript Standards

- Use `strict: true` in tsconfig.json
- Explicit return types for public functions
- No `any` types (use `unknown` if needed)
- Consistent type imports: `import type { ... }`
- Prefer interfaces over type aliases for objects

## Code Style

- Prettier handles formatting (don't argue with it)
- ESLint handles linting (fix all warnings before commit)
- Import order: builtin -> external -> internal -> relative

## Testing Standards

- Test files: `*.test.ts` or `*.spec.ts`
- Use `describe/it` pattern
- Mock external dependencies
- Aim for meaningful coverage, not 100%

## Error Handling

- Always handle errors explicitly
- Use typed errors when possible
- Log errors with context
- Never swallow errors silently
