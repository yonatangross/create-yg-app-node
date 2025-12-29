#!/bin/bash
# Subagent Validator - Logs and validates Task tool invocations
# Hook: PreToolUse (Task)

source "$(dirname "$0")/../../_lib/common.sh"

SUBAGENT_TYPE=$(get_field '.tool_input.subagent_type')
DESCRIPTION=$(get_field '.tool_input.description')
PROMPT=$(get_field '.tool_input.prompt' | head -c 200)

log_hook "Task invocation: $SUBAGENT_TYPE - $DESCRIPTION"

# Log subagent usage for analytics
USAGE_LOG="/tmp/claude-subagent-usage.log"
echo "$(date -Iseconds) | $SUBAGENT_TYPE | $DESCRIPTION" >> "$USAGE_LOG"

# Valid subagent types for this project
VALID_TYPES="general-purpose|Explore|Plan|claude-code-guide|statusline-setup|frontend-developer|ui-designer|backend-developer|database-architect|ai-agent-engineer|prompt-engineer|test-engineer|visual-qa|accessibility-auditor|code-reviewer|security-auditor"

if [[ ! "$SUBAGENT_TYPE" =~ ^($VALID_TYPES)$ ]]; then
  warn "Unknown subagent type: $SUBAGENT_TYPE"
  log_hook "WARNING: Unknown subagent type: $SUBAGENT_TYPE"
fi

# Info about subagent being used
info "Spawning $SUBAGENT_TYPE agent: $DESCRIPTION"

exit 0
