# YG Node Starter

Production-ready Node.js/TypeScript application starter with modern tooling.

## Features

- **TypeScript** - Strict mode with modern config
- **ESLint + Prettier** - Code quality and formatting
- **Vitest** - Fast, modern testing framework
- **pnpm** - Efficient package management
- **GitHub Actions** - CI/CD pipeline
- **Claude Code** - AI-assisted development ready

## Quick Start

```bash
# Clone and install
git clone https://github.com/yonatangross/create-yg-app-node.git
cd create-yg-app-node
pnpm install

# Development
pnpm dev       # Start with hot reload
pnpm test      # Run tests in watch mode
pnpm check     # Run all quality checks

# Production
pnpm build     # Build for production
pnpm start     # Run production build
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build TypeScript to JavaScript |
| `pnpm start` | Run the built application |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm check` | Run format, lint, and typecheck |

## Project Structure

```
.
├── src/                  # Source code
│   ├── index.ts          # Entry point
│   └── index.test.ts     # Tests
├── .claude/              # Claude Code configuration
│   ├── hooks/            # Git protection hooks
│   └── instructions/     # AI instructions
├── .github/              # GitHub configuration
│   ├── workflows/        # CI/CD pipelines
│   └── dependabot.yml    # Dependency updates
├── CLAUDE.md             # Claude Code project instructions
├── tsconfig.json         # TypeScript configuration
├── eslint.config.js      # ESLint configuration
├── vitest.config.ts      # Vitest configuration
└── package.json          # Project configuration
```

## Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run quality checks: `pnpm check`
4. Run tests: `pnpm test:run`
5. Commit with conventional commits: `git commit -m "feat: add feature"`
6. Push and create PR: `gh pr create --base dev`

## License

MIT
