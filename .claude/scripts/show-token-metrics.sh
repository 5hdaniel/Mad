#!/bin/bash
# Show token usage metrics from agent tracking

METRICS_FILE=".claude/metrics/tokens.jsonl"

if [ ! -f "$METRICS_FILE" ]; then
  echo "No metrics found yet. Run some engineer agents first."
  exit 0
fi

echo "=== Token Usage Metrics ==="
echo ""

# Total stats
TOTALS=$(jq -s '
  {
    sessions: length,
    total_tokens: (map(.total_tokens) | add),
    total_input: (map(.input_tokens) | add),
    total_output: (map(.output_tokens) | add),
    avg_per_session: ((map(.total_tokens) | add) / length | floor)
  }
' "$METRICS_FILE")

echo "Summary:"
echo "  Sessions tracked: $(echo "$TOTALS" | jq -r '.sessions')"
echo "  Total tokens: $(echo "$TOTALS" | jq -r '.total_tokens' | numfmt --grouping 2>/dev/null || echo "$TOTALS" | jq -r '.total_tokens')"
echo "  Avg per session: $(echo "$TOTALS" | jq -r '.avg_per_session' | numfmt --grouping 2>/dev/null || echo "$TOTALS" | jq -r '.avg_per_session')"
echo ""

echo "Recent sessions:"
tail -5 "$METRICS_FILE" | jq -r '"\(.timestamp): \(.total_tokens) tokens"'
