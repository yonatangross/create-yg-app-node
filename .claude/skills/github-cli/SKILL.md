---
name: github-cli
description: Use this skill for GitHub operations using the gh CLI. Covers issues, pull requests, releases, and repository management.
version: 1.0.0
author: YG Node Starter
tags: [github, git, cli, workflow]
---

# GitHub CLI (gh) Patterns

## Overview

Essential `gh` commands for efficient GitHub workflow management.

## Issues

### Create Issue
```bash
# Simple
gh issue create --title "Bug: Login fails" --body "Description here"

# With labels and assignee
gh issue create \
  --title "feat: Add dark mode" \
  --body "## Description\n\nAdd dark mode toggle.\n\n## Acceptance Criteria\n- [ ] Toggle in settings\n- [ ] Persists preference" \
  --label "enhancement" \
  --label "frontend" \
  --assignee "@me"
```

### View Issues
```bash
# List open issues
gh issue list

# With filters
gh issue list --label "bug" --assignee "@me"

# View specific issue
gh issue view 123

# View in browser
gh issue view 123 --web
```

### Update Issues
```bash
# Close issue
gh issue close 123

# Reopen
gh issue reopen 123

# Add comment
gh issue comment 123 --body "Fixed in #456"

# Edit
gh issue edit 123 --add-label "in-progress"
```

## Pull Requests

### Create PR
```bash
# Interactive
gh pr create

# With details
gh pr create \
  --title "feat: Add user authentication" \
  --body "$(cat <<'EOF'
## Summary
- Add JWT authentication
- Add login/register endpoints
- Add auth middleware

## Test Plan
- [ ] Unit tests pass
- [ ] E2E login flow works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base dev \
  --label "feature"

# Draft PR
gh pr create --draft --title "WIP: New feature"
```

### View PRs
```bash
# List PRs
gh pr list

# My PRs
gh pr list --author "@me"

# View specific PR
gh pr view 123

# View diff
gh pr diff 123

# View in browser
gh pr view 123 --web
```

### Review PRs
```bash
# Checkout PR locally
gh pr checkout 123

# Review
gh pr review 123 --approve
gh pr review 123 --request-changes --body "Please fix..."
gh pr review 123 --comment --body "Looks good overall"

# Merge
gh pr merge 123 --squash --delete-branch

# Auto-merge when checks pass
gh pr merge 123 --auto --squash
```

### PR Comments
```bash
# Add comment
gh pr comment 123 --body "Updated based on feedback"

# View comments
gh pr view 123 --comments
```

## Branches

### Branch from Issue
```bash
# Create branch from issue
gh issue develop 123 --checkout

# Or manually
git checkout -b issue/123-fix-login
```

## Releases

### Create Release
```bash
# Create release
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes "## What's New\n- Feature A\n- Feature B" \
  --target main

# With auto-generated notes
gh release create v1.1.0 --generate-notes

# Draft release
gh release create v2.0.0 --draft

# Pre-release
gh release create v2.0.0-beta.1 --prerelease
```

### View Releases
```bash
# List releases
gh release list

# View specific release
gh release view v1.0.0

# Download assets
gh release download v1.0.0
```

## Repository

### Clone
```bash
# Clone your repo
gh repo clone owner/repo

# Clone and cd
gh repo clone owner/repo && cd repo
```

### Fork
```bash
# Fork repo
gh repo fork owner/repo --clone
```

### Create Repo
```bash
# Create new repo
gh repo create my-project --public --clone

# From current directory
gh repo create --source=. --public --remote=origin --push
```

### View Repo
```bash
# View in browser
gh repo view --web

# View README
gh repo view
```

## Workflows (Actions)

### View Runs
```bash
# List runs
gh run list

# View specific run
gh run view 12345

# Watch run in progress
gh run watch 12345

# View logs
gh run view 12345 --log
```

### Trigger Workflow
```bash
# Trigger workflow dispatch
gh workflow run build.yml

# With inputs
gh workflow run deploy.yml -f environment=staging
```

### Manage Workflows
```bash
# List workflows
gh workflow list

# Enable/disable
gh workflow enable build.yml
gh workflow disable old-workflow.yml
```

## Common Patterns

### Create Feature Branch + PR
```bash
# From issue
git checkout dev
git pull origin dev
git checkout -b issue/123-add-feature

# ... make changes ...

git add .
git commit -m "feat: add feature

Closes #123"

git push -u origin issue/123-add-feature
gh pr create --base dev --fill
```

### Squash and Merge
```bash
gh pr merge 123 --squash --delete-branch --body "feat: add feature (#123)"
```

### Fix PR After Review
```bash
gh pr checkout 123
# ... make fixes ...
git add .
git commit -m "fix: address review feedback"
git push
gh pr review 123 --comment --body "Addressed all feedback, ready for re-review"
```

### Quick Issue → PR Flow
```bash
# Create issue
gh issue create --title "Bug: Fix X" --body "Description" --label "bug"

# Note the issue number, create branch
gh issue develop 42 --checkout

# ... fix the bug ...

git add .
git commit -m "fix: resolve X

Fixes #42"

git push -u origin HEAD
gh pr create --base dev --fill
```

## Aliases

Add to `~/.config/gh/config.yml`:

```yaml
aliases:
  prc: pr create --fill
  prm: pr merge --squash --delete-branch
  il: issue list --assignee "@me"
  pl: pr list --author "@me"
```

Usage:
```bash
gh prc   # Quick PR create
gh prm   # Quick merge
gh il    # My issues
gh pl    # My PRs
```
