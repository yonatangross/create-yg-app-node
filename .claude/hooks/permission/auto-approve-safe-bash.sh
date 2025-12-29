#!/bin/bash
# Auto-Approve Safe Bash - Automatically approves safe bash commands
# Hook: PermissionRequest (Bash)
# Adapted for Node.js/pnpm project

source "$(dirname "$0")/../_lib/common.sh"

COMMAND=$(get_field '.tool_input.command')

log_hook "Evaluating bash command: ${COMMAND:0:50}..."

# Safe command patterns that should be auto-approved
SAFE_PATTERNS=(
  # Git operations (read-only and safe modifications)
  '^git (status|log|diff|branch|show|fetch|pull)'
  '^git checkout'
  '^git stash'

  # Node.js package managers
  '^npm (list|ls|outdated|audit|run|test)'
  '^pnpm (list|ls|outdated|audit|run|test|check)'
  '^pnpm run (check|format|lint|typecheck|test|dev|build)'
  '^yarn (list|outdated|audit|run|test)'

  # Testing
  '^vitest'
  '^pnpm test'
  '^npm test'

  # TypeScript/Node tools
  '^tsx'
  '^tsc --noEmit'
  '^npx tsc'

  # Docker (read-only operations)
  '^docker (ps|images|logs|inspect)'
  '^docker-compose (ps|logs)'
  '^docker compose (ps|logs)'

  # Basic file operations (read-only)
  '^ls'
  '^pwd'
  '^echo'
  '^cat'
  '^head'
  '^tail'
  '^wc'
  '^find'
  '^which'
  '^type'
  '^env'
  '^printenv'

  # GitHub CLI (read operations)
  '^gh (issue|pr|repo|workflow) (list|view|status)'
  '^gh milestone'

  # Make targets (typically safe)
  '^make (dev|test|lint|check|build)'
)

for pattern in "${SAFE_PATTERNS[@]}"; do
  if [[ "$COMMAND" =~ $pattern ]]; then
    log_hook "Auto-approved: matches safe pattern '$pattern'"
    echo '{"decision": "allow", "reason": "Safe command pattern auto-approved"}'
    exit 0
  fi
done

# Not a recognized safe command - let user decide
log_hook "Command requires manual approval"
exit 0
