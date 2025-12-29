#!/bin/bash
# Context7 Tracker - Logs Context7 documentation lookups
# Hook: PreToolUse (mcp__context7__*)

source "$(dirname "$0")/../../_lib/common.sh"

TOOL_NAME=$(get_tool_name)
LIBRARY_ID=$(get_field '.tool_input.libraryId')
QUERY=$(get_field '.tool_input.query')

log_hook "Context7 lookup: $TOOL_NAME - ${LIBRARY_ID:-$QUERY}"

# Log for analytics
USAGE_LOG="/tmp/claude-context7-usage.log"
echo "$(date -Iseconds) | $TOOL_NAME | ${LIBRARY_ID:-$QUERY}" >> "$USAGE_LOG"

# Info about lookup
if [[ -n "$LIBRARY_ID" ]]; then
  info "Looking up docs for: $LIBRARY_ID"
elif [[ -n "$QUERY" ]]; then
  info "Searching libraries: $QUERY"
fi

exit 0
