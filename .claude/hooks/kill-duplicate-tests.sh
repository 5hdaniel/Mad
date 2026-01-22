#!/bin/bash
#
# Hook: kill-duplicate-tests.sh (PreToolUse - Bash)
# Purpose: Prevent duplicate test processes from the SAME directory
#
# Only kills Jest processes running in the SAME working directory
# This allows parallel agents in different worktrees to run tests safely
#

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"
CURRENT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Only run if this is a test command
if echo "$TOOL_INPUT" | grep -qE "(jest|npm test|npm run test)"; then
    # Find Jest processes running in THIS directory only
    # Uses lsof to check the current working directory of each process
    for PID in $(pgrep -f "jest" 2>/dev/null || true); do
        # Skip our own process
        [ "$PID" = "$$" ] && continue

        # Get the working directory of this Jest process
        JEST_CWD=$(lsof -p "$PID" 2>/dev/null | grep cwd | awk '{print $NF}')

        # Only kill if it's in the same directory
        if [ "$JEST_CWD" = "$CURRENT_DIR" ]; then
            echo "[Hook] Killing existing Jest process $PID in $CURRENT_DIR" >&2
            kill -9 "$PID" 2>/dev/null || true
        fi
    done
fi

exit 0
