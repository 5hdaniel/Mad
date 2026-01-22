#!/bin/bash
#
# Hook: agent-watchdog.sh (SubagentStart)
# Purpose: Monitor long-running agents and report progress
#
# Reports after: 2 min, 5 min, then every 5 min
#

AGENT_ID="${CLAUDE_AGENT_ID:-unknown}"
AGENT_TYPE="${CLAUDE_SUBAGENT_TYPE:-unknown}"
START_TIME=$(date +%s)
WATCHDOG_PID_FILE="/tmp/claude-watchdog-${AGENT_ID}.pid"

# Start watchdog in background
(
  sleep 120  # Wait 2 minutes

  if [ -f "$WATCHDOG_PID_FILE" ]; then
    echo "[WATCHDOG] Agent '$AGENT_TYPE' ($AGENT_ID) running for 2 minutes..." >&2
  fi

  sleep 180  # Wait 3 more minutes (5 total)

  while [ -f "$WATCHDOG_PID_FILE" ]; do
    ELAPSED=$(( ($(date +%s) - START_TIME) / 60 ))
    echo "[WATCHDOG] Agent '$AGENT_TYPE' ($AGENT_ID) still running after ${ELAPSED} minutes" >&2
    sleep 300  # Check every 5 minutes
  done
) &

WATCHDOG_PID=$!
echo $WATCHDOG_PID > "$WATCHDOG_PID_FILE"

exit 0
