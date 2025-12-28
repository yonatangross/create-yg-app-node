#!/bin/bash
# =============================================================================
# Git Branch Protection Hook
# =============================================================================
# Prevents direct commits to main/dev branches by failing git commit commands
# when on protected branches.
# =============================================================================

# Read the tool input from stdin (Claude passes JSON)
INPUT=$(cat)

# Extract the command being executed
COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"command"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

# Only check git commit commands
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

# Get current branch (handle case where we're not in a git repo)
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
BRANCH=$(git branch --show-current 2>/dev/null)

if [[ -z "$BRANCH" ]]; then
  exit 0
fi

# Protected branches
PROTECTED_BRANCHES=("main" "master" "dev" "develop")

for protected in "${PROTECTED_BRANCHES[@]}"; do
  if [[ "$BRANCH" == "$protected" ]]; then
    echo "BLOCKED"
    echo ""
    echo "Direct commits to '$BRANCH' are not allowed."
    echo ""
    echo "Please create a feature branch first:"
    echo "  git checkout -b feature/<name>"
    echo "  git checkout -b issue/<number>-<description>"
    echo ""
    echo "Then commit your changes and create a PR."
    exit 2
  fi
done

exit 0
