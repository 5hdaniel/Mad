#!/bin/bash
# Track token usage after engineer agents complete
# Triggered by SubagentStop hook

set -e

# Read hook input from stdin
INPUT=$(cat)

# Extract fields from hook input
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // ""')
CWD=$(echo "$INPUT" | jq -r '.cwd // ""')

# Output file for metrics
METRICS_DIR="${CWD}/.claude/metrics"
METRICS_FILE="${METRICS_DIR}/tokens.jsonl"

# Ensure metrics directory exists
mkdir -p "$METRICS_DIR"

# Skip if no transcript
if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  echo '{"decision": "allow"}' # Let the agent continue
  exit 0
fi

# Parse transcript for token totals
# The transcript is a JSONL file with API request events
TOKEN_STATS=$(jq -s '
  [.[] | select(.type == "api_request" or .input_tokens != null)]
  | {
      total_input: (map(.input_tokens // 0) | add),
      total_output: (map(.output_tokens // 0) | add),
      total_cache_read: (map(.cache_read_tokens // 0) | add),
      total_cache_creation: (map(.cache_creation_tokens // 0) | add),
      total_cost_usd: (map(.cost_usd // 0) | add),
      api_calls: length
    }
' "$TRANSCRIPT_PATH" 2>/dev/null || echo '{}')

# Calculate total tokens
TOTAL_INPUT=$(echo "$TOKEN_STATS" | jq -r '.total_input // 0')
TOTAL_OUTPUT=$(echo "$TOKEN_STATS" | jq -r '.total_output // 0')
TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT))

# Only log if we got meaningful data
if [ "$TOTAL_TOKENS" -gt 0 ]; then
  # Create log entry
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  LOG_ENTRY=$(jq -n \
    --arg ts "$TIMESTAMP" \
    --arg sid "$SESSION_ID" \
    --argjson input "$TOTAL_INPUT" \
    --argjson output "$TOTAL_OUTPUT" \
    --argjson total "$TOTAL_TOKENS" \
    --argjson stats "$TOKEN_STATS" \
    '{
      timestamp: $ts,
      session_id: $sid,
      input_tokens: $input,
      output_tokens: $output,
      total_tokens: $total,
      details: $stats
    }')

  # Append to metrics log
  echo "$LOG_ENTRY" >> "$METRICS_FILE"

  # Also log to stderr for visibility (shows in Claude Code output)
  echo "[TOKEN TRACKER] Session $SESSION_ID: ${TOTAL_TOKENS} tokens (input: ${TOTAL_INPUT}, output: ${TOTAL_OUTPUT})" >&2
fi

# Return success - don't block
echo '{"decision": "allow"}'
exit 0
