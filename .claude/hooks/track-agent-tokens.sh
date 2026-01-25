#!/bin/bash
# Track token usage after engineer agents complete
# Triggered by SubagentStop hook
# Writes to tokens.csv (CSV format)

# Log that hook was called (for debugging)
echo "[HOOK FIRED] $(date)" >> /tmp/claude-hook-debug.log

# Read hook input from stdin
INPUT=$(cat)
echo "[HOOK INPUT] $INPUT" >> /tmp/claude-hook-debug.log

# Extract fields from hook input
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""')
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // ""')
# Use agent_transcript_path for subagent token data (not main session transcript)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.agent_transcript_path // .transcript_path // ""')

# Use absolute path for metrics CSV
METRICS_FILE="/Users/daniel/Documents/Mad/.claude/metrics/tokens.csv"
mkdir -p "$(dirname "$METRICS_FILE")"

# Create CSV header if file doesn't exist
if [ ! -f "$METRICS_FILE" ]; then
  echo "timestamp,session_id,agent_id,agent_type,task_id,description,input_tokens,output_tokens,cache_read,cache_create,billable_tokens,total_tokens,api_calls,duration_secs,started_at,ended_at" > "$METRICS_FILE"
fi

# Skip if no transcript
if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  echo "[HOOK] No transcript at: $TRANSCRIPT_PATH" >> /tmp/claude-hook-debug.log
  echo '{"decision": "allow"}'
  exit 0
fi

# Parse transcript for token totals and duration
# Tokens are in message.usage.input_tokens, message.usage.output_tokens, etc.
STATS=$(jq -s '
  {
    tokens: ([.[] | select(.message.usage != null) | .message.usage] | {
      total_input: (map(.input_tokens // 0) | add),
      total_output: (map(.output_tokens // 0) | add),
      total_cache_read: (map(.cache_read_input_tokens // 0) | add),
      total_cache_create: (map(.cache_creation_input_tokens // 0) | add),
      api_calls: length
    }),
    timing: {
      start: (map(.timestamp) | map(select(. != null)) | sort | first),
      end: (map(.timestamp) | map(select(. != null)) | sort | last)
    }
  }
' "$TRANSCRIPT_PATH" 2>/dev/null || echo '{"tokens":{"total_input":0,"total_output":0,"total_cache_read":0,"total_cache_create":0,"api_calls":0},"timing":{"start":null,"end":null}}')

# Extract token metrics
TOTAL_INPUT=$(echo "$STATS" | jq -r '.tokens.total_input // 0')
TOTAL_OUTPUT=$(echo "$STATS" | jq -r '.tokens.total_output // 0')
TOTAL_CACHE_READ=$(echo "$STATS" | jq -r '.tokens.total_cache_read // 0')
TOTAL_CACHE_CREATE=$(echo "$STATS" | jq -r '.tokens.total_cache_create // 0')
API_CALLS=$(echo "$STATS" | jq -r '.tokens.api_calls // 0')
# Total = new input + output + cache (cache counts towards context usage)
TOTAL_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT + TOTAL_CACHE_READ + TOTAL_CACHE_CREATE))

# Billable = actual new work (output + cache creation, NOT cache reads)
BILLABLE_TOKENS=$((TOTAL_OUTPUT + TOTAL_CACHE_CREATE))

# Extract timing and calculate duration in seconds
START_TS=$(echo "$STATS" | jq -r '.timing.start // empty')
END_TS=$(echo "$STATS" | jq -r '.timing.end // empty')
if [ -n "$START_TS" ] && [ -n "$END_TS" ]; then
  # Convert ISO timestamps to epoch seconds and calculate difference
  START_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${START_TS%.*}" +%s 2>/dev/null || echo "0")
  END_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${END_TS%.*}" +%s 2>/dev/null || echo "0")
  DURATION_SECS=$((END_EPOCH - START_EPOCH))
else
  DURATION_SECS=0
  START_TS=""
  END_TS=""
fi

# Log metrics as CSV row
# CSV columns: timestamp,session_id,agent_id,agent_type,task_id,description,input_tokens,output_tokens,cache_read,cache_create,billable_tokens,total_tokens,api_calls,duration_secs,started_at,ended_at
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# agent_type, task_id, description are left empty - agents can fill these manually using /log-metrics skill
CSV_ROW="${TIMESTAMP},${SESSION_ID},${AGENT_ID},,,,$TOTAL_INPUT,$TOTAL_OUTPUT,$TOTAL_CACHE_READ,$TOTAL_CACHE_CREATE,$BILLABLE_TOKENS,$TOTAL_TOKENS,$API_CALLS,$DURATION_SECS,$START_TS,$END_TS"

echo "$CSV_ROW" >> "$METRICS_FILE"
echo "[HOOK] Logged: $TOTAL_TOKENS tokens to CSV" >> /tmp/claude-hook-debug.log

echo '{"decision": "allow"}'
exit 0
