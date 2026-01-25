#!/bin/bash
# Show token usage metrics from agent tracking
# Uses the Python log_metrics.py script for summary

METRICS_FILE=".claude/metrics/tokens.csv"
PYTHON_SCRIPT=".claude/skills/log-metrics/log_metrics.py"

if [ ! -f "$METRICS_FILE" ]; then
  echo "No metrics found yet. Run some engineer agents first."
  exit 0
fi

echo "=== Token Usage Metrics ==="
echo ""

# Use Python script for summary
if [ -f "$PYTHON_SCRIPT" ]; then
  python "$PYTHON_SCRIPT" --summary
else
  # Fallback to basic CSV stats
  echo "Summary:"
  TOTAL_ROWS=$(tail -n +2 "$METRICS_FILE" | wc -l | tr -d ' ')
  echo "  Entries tracked: $TOTAL_ROWS"
  echo ""
  echo "Recent entries:"
  tail -5 "$METRICS_FILE"
fi
