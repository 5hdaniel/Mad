#!/bin/bash
# Track token usage after engineer agents complete
# Triggered by SubagentStop hook
# Writes to tokens.csv (CSV format)

# --- Log directory: user-private, not world-readable /tmp ---
LOG_DIR="${HOME}/.claude/logs"
mkdir -p "$LOG_DIR"
DEBUG_LOG="${LOG_DIR}/hook-debug.log"

# Log that hook was called (for debugging)
echo "[HOOK FIRED] $(date)" >> "$DEBUG_LOG"

# Read hook input from stdin
INPUT=$(cat)
echo "[HOOK INPUT] $INPUT" >> "$DEBUG_LOG"

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
  echo "[HOOK] No transcript at: $TRANSCRIPT_PATH" >> "$DEBUG_LOG"
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

# Extract timing and calculate duration in seconds (portable -- no macOS-only date -j)
START_TS=$(echo "$STATS" | jq -r '.timing.start // empty')
END_TS=$(echo "$STATS" | jq -r '.timing.end // empty')
if [ -n "$START_TS" ] && [ -n "$END_TS" ]; then
  # Use jq to compute duration from ISO timestamps (portable across macOS/Linux)
  DURATION_SECS=$(jq -n --arg s "$START_TS" --arg e "$END_TS" '
    def parse_ts: split(".")[0] | strptime("%Y-%m-%dT%H:%M:%S") | mktime;
    (($e | parse_ts) - ($s | parse_ts)) | if . < 0 then 0 else . end
  ' 2>/dev/null || echo "0")
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
echo "[HOOK] Logged: $TOTAL_TOKENS tokens to CSV" >> "$DEBUG_LOG"

# --- Push to Supabase (best-effort, never fails the hook) ---
# Set PM_SUPABASE_URL and PM_SUPABASE_KEY in your shell profile or .env to enable.
SUPABASE_URL="${PM_SUPABASE_URL:-}"
SUPABASE_KEY="${PM_SUPABASE_KEY:-}"

if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
  # Convert duration from seconds to milliseconds for the RPC
  DURATION_MS=$((DURATION_SECS * 1000))

  # Extract model from transcript (first message with a model field)
  MODEL=$(jq -r '[.message.model // empty] | first // "unknown"' "$TRANSCRIPT_PATH" 2>/dev/null | head -1)
  [ -z "$MODEL" ] && MODEL="unknown"

  # Build JSON payload with jq to prevent injection via AGENT_ID, SESSION_ID, or MODEL
  JSON_PAYLOAD=$(jq -n \
    --arg agent_id "$AGENT_ID" \
    --argjson input "$TOTAL_INPUT" \
    --argjson output "$TOTAL_OUTPUT" \
    --argjson cache_read "$TOTAL_CACHE_READ" \
    --argjson cache_create "$TOTAL_CACHE_CREATE" \
    --argjson total "$TOTAL_TOKENS" \
    --argjson duration_ms "$DURATION_MS" \
    --argjson api_calls "$API_CALLS" \
    --arg session_id "$SESSION_ID" \
    --arg model "$MODEL" \
    '{
      p_agent_id: $agent_id,
      p_input_tokens: $input,
      p_output_tokens: $output,
      p_cache_read: $cache_read,
      p_cache_create: $cache_create,
      p_total_tokens: $total,
      p_duration_ms: $duration_ms,
      p_api_calls: $api_calls,
      p_session_id: $session_id,
      p_model: $model
    }')

  curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/pm_log_agent_metrics" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" 2>/dev/null || true

  echo "[HOOK] Pushed to Supabase: $TOTAL_TOKENS tokens" >> "$DEBUG_LOG"
fi

echo '{"decision": "allow"}'
exit 0
