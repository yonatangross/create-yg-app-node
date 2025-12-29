#!/bin/bash
# CI Simulation Hook - Reminds to run CI checks before commits
# Hook: PreToolUse (Bash)
# Adapted for Node.js/pnpm project

source "$(dirname "$0")/../../_lib/common.sh"

COMMAND=$(get_field '.tool_input.command')

# Only trigger for git commit commands
if [[ ! "$COMMAND" =~ git\ commit ]]; then
  exit 0
fi

log_hook "Git commit detected - CI reminder"

# Check if CI checks were recently run
CI_MARKER="/tmp/claude-ci-checks-run"
MARKER_AGE_LIMIT=300  # 5 minutes

if [[ -f "$CI_MARKER" ]]; then
  MARKER_AGE=$(($(date +%s) - $(stat -f %m "$CI_MARKER" 2>/dev/null || stat -c %Y "$CI_MARKER" 2>/dev/null)))
  if [[ $MARKER_AGE -lt $MARKER_AGE_LIMIT ]]; then
    # CI checks were run recently, allow commit
    exit 0
  fi
fi

# Show reminder (don't block, just inform)
cat >&2 << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║  💡 REMINDER: Run CI checks before committing                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

Full check (format + lint + typecheck):
  pnpm run check

Individual checks:
  pnpm run format:check
  pnpm run lint
  pnpm run typecheck

Run tests:
  pnpm test:run

To mark checks as run: touch /tmp/claude-ci-checks-run

EOF

exit 0
