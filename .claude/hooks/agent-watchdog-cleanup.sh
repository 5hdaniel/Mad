#!/bin/bash
#
# Hook: agent-watchdog-cleanup.sh (SubagentStop)
# Purpose: Clean up watchdog process when agent completes
#

AGENT_ID="${CLAUDE_AGENT_ID:-unknown}"
WATCHDOG_PID_FILE="/tmp/claude-watchdog-${AGENT_ID}.pid"

# Remove the pid file to signal watchdog to stop
if [ -f "$WATCHDOG_PID_FILE" ]; then
    WATCHDOG_PID=$(cat "$WATCHDOG_PID_FILE")
    rm -f "$WATCHDOG_PID_FILE"

    # Kill the watchdog process if still running
    if [ -n "$WATCHDOG_PID" ] && kill -0 "$WATCHDOG_PID" 2>/dev/null; then
        kill "$WATCHDOG_PID" 2>/dev/null || true
    fi
fi

exit 0
