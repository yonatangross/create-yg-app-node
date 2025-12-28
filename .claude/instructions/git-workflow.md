# Git Workflow

## Branch Strategy

- `main` - Production branch (protected)
- `dev` - Development branch (protected)
- `feature/*` - New features
- `issue/*` - Bug fixes tied to issues
- `refactor/*` - Code improvements

## Creating a Feature Branch

```bash
# From dev branch
git checkout dev
git pull origin dev
git checkout -b feature/my-feature
```

## Commit Convention

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance

Example:
```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve null pointer in parser"
```

## Pull Request Process

1. Create feature branch
2. Make changes
3. Run quality checks: `pnpm run check`
4. Push branch: `git push -u origin feature/my-feature`
5. Create PR: `gh pr create --base dev`
6. Wait for review
7. Merge after approval

## Forbidden Actions

- Direct commits to `main` or `dev`
- Force push to shared branches
- Skipping pre-commit hooks
- Merging without PR review
