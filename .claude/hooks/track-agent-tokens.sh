#!/bin/bash
# Track token usage after engineer agents complete
# Triggered by SubagentStop hook
#
# PRIMARY: Supabase pm_token_metrics (via pm_log_agent_metrics RPC)
# BACKUP:  tokens.csv (append-only, never queried in workflow)
#
# Task context: reads .claude/.current-task JSON file written by PM before agent invocation
# Failed payloads: written to ~/.claude/metrics/failed-payloads.jsonl for replay

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

# --- Read task context from .current-task file (written by PM at Step 5) ---
CURRENT_TASK_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/.current-task"
TASK_ID=""
AGENT_TYPE=""
SPRINT_ID=""
BACKLOG_ITEM_ID=""
DESCRIPTION=""

if [ -f "$CURRENT_TASK_FILE" ]; then
  TASK_ID=$(jq -r '.task_id // ""' "$CURRENT_TASK_FILE" 2>/dev/null)
  AGENT_TYPE=$(jq -r '.agent_type // ""' "$CURRENT_TASK_FILE" 2>/dev/null)
  SPRINT_ID=$(jq -r '.sprint_id // ""' "$CURRENT_TASK_FILE" 2>/dev/null)
  BACKLOG_ITEM_ID=$(jq -r '.backlog_item_id // ""' "$CURRENT_TASK_FILE" 2>/dev/null)
  DESCRIPTION=$(jq -r '.description // ""' "$CURRENT_TASK_FILE" 2>/dev/null)
  echo "[HOOK] Read task context: task=$TASK_ID type=$AGENT_TYPE sprint=$SPRINT_ID backlog=$BACKLOG_ITEM_ID desc=$DESCRIPTION" >> "$DEBUG_LOG"
else
  echo "[HOOK] WARNING: No .current-task file at $CURRENT_TASK_FILE — metrics will have no task linkage" >> "$DEBUG_LOG"
fi

# Use portable path for metrics CSV (backup only)
METRICS_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/metrics/tokens.csv"
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

# Billable = input + output + cache_create (standardized formula, matches DB generated column)
BILLABLE_TOKENS=$((TOTAL_INPUT + TOTAL_OUTPUT + TOTAL_CACHE_CREATE))

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

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DURATION_MS=$((DURATION_SECS * 1000))

# Extract model from transcript (first message with a model field)
MODEL=$(jq -r '[.message.model // empty] | first // "unknown"' "$TRANSCRIPT_PATH" 2>/dev/null | head -1)
[ -z "$MODEL" ] && MODEL="unknown"

# ============================================================
# PRIMARY: Push to Supabase
# ============================================================
# Try env vars first, then fall back to config file
SUPABASE_URL="${PM_SUPABASE_URL:-}"
SUPABASE_KEY="${PM_SUPABASE_KEY:-}"
SUPABASE_SUCCESS=false

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  HOOK_ENV="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/.env"
  if [ -f "$HOOK_ENV" ]; then
    # shellcheck source=/dev/null
    source "$HOOK_ENV"
    SUPABASE_URL="${PM_SUPABASE_URL:-}"
    SUPABASE_KEY="${PM_SUPABASE_KEY:-}"
    echo "[HOOK] Loaded credentials from $HOOK_ENV" >> "$DEBUG_LOG"
  fi
fi

if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
  # Build JSON payload with jq to prevent injection
  JSON_PAYLOAD=$(jq -n \
    --arg agent_id "$AGENT_ID" \
    --arg agent_type "$AGENT_TYPE" \
    --arg task_id "$TASK_ID" \
    --arg description "$DESCRIPTION" \
    --arg sprint_id "$SPRINT_ID" \
    --arg backlog_item_id "$BACKLOG_ITEM_ID" \
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
      p_agent_type: (if $agent_type == "" then null else $agent_type end),
      p_task_id: (if $task_id == "" then null else $task_id end),
      p_description: (if $description == "" then null else $description end),
      p_sprint_id: (if $sprint_id == "" then null else $sprint_id end),
      p_backlog_item_id: (if $backlog_item_id == "" then null else $backlog_item_id end),
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

  # Capture HTTP status and response body
  HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/rest/v1/rpc/pm_log_agent_metrics" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" 2>/dev/null) || true

  HTTP_BODY=$(echo "$HTTP_RESPONSE" | sed '$d')
  HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -1)

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    SUPABASE_SUCCESS=true
    echo "[HOOK] Supabase OK ($HTTP_STATUS): $TOTAL_TOKENS tokens, task=$TASK_ID" >> "$DEBUG_LOG"
  else
    echo "[HOOK] SUPABASE_PUSH_FAILED ($HTTP_STATUS): $HTTP_BODY" >> "$DEBUG_LOG"

    # Write failed payload to JSONL for replay at Step 14
    FAILED_FILE="${HOME}/.claude/metrics/failed-payloads.jsonl"
    mkdir -p "$(dirname "$FAILED_FILE")"
    jq -n \
      --arg ts "$TIMESTAMP" \
      --arg status "$HTTP_STATUS" \
      --arg error "$HTTP_BODY" \
      --argjson payload "$JSON_PAYLOAD" \
      '{timestamp: $ts, http_status: $status, error: $error, payload: $payload}' >> "$FAILED_FILE"
    echo "[HOOK] Failed payload saved to $FAILED_FILE" >> "$DEBUG_LOG"
  fi
else
  echo "[HOOK] WARNING: PM_SUPABASE_URL or PM_SUPABASE_KEY not set — Supabase push skipped" >> "$DEBUG_LOG"
fi

# ============================================================
# BACKUP: Always write to CSV (append-only backup)
# ============================================================
# CSV columns: timestamp,session_id,agent_id,agent_type,task_id,description,input_tokens,output_tokens,cache_read,cache_create,billable_tokens,total_tokens,api_calls,duration_secs,started_at,ended_at
CSV_ROW="${TIMESTAMP},${SESSION_ID},${AGENT_ID},${AGENT_TYPE},${TASK_ID},,$TOTAL_INPUT,$TOTAL_OUTPUT,$TOTAL_CACHE_READ,$TOTAL_CACHE_CREATE,$BILLABLE_TOKENS,$TOTAL_TOKENS,$API_CALLS,$DURATION_SECS,$START_TS,$END_TS"

echo "$CSV_ROW" >> "$METRICS_FILE"
echo "[HOOK] CSV backup written: $TOTAL_TOKENS tokens (supabase=$SUPABASE_SUCCESS)" >> "$DEBUG_LOG"

echo '{"decision": "allow"}'
exit 0
