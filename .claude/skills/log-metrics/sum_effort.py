#!/usr/bin/env python3
"""
Aggregate effort metrics for a task, session, or sprint.

Used by PM in Step 14 of the agent handoff workflow.

Usage:
    python sum_effort.py --task TASK-1234
    python sum_effort.py --task-prefix TASK-17
    python sum_effort.py --session-id abc123
"""

import argparse
import csv
import json
import sys
from pathlib import Path

METRICS_DIR = Path(__file__).parent.parent.parent / "metrics"
CSV_PATH = METRICS_DIR / "tokens.csv"


def load_metrics():
    """Load all rows from tokens.csv."""
    if not CSV_PATH.exists():
        return []

    with open(CSV_PATH, "r") as f:
        reader = csv.DictReader(f)
        return list(reader)


def safe_int(value):
    """Convert value to int, defaulting to 0."""
    try:
        return int(value or 0)
    except (ValueError, TypeError):
        return 0


def aggregate_rows(rows, identifier_field, identifier_value):
    """Aggregate metrics from rows."""
    totals = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read": 0,
        "cache_create": 0,
        "billable_tokens": 0,
        "total_tokens": 0,
        "api_calls": 0,
        "duration_secs": 0,
    }

    agent_sessions = set()
    entries = 0

    for row in rows:
        entries += 1

        # Aggregate numeric fields
        for field in totals:
            totals[field] += safe_int(row.get(field))

        # Track unique agent sessions
        agent_id = row.get("agent_id")
        if agent_id:
            agent_sessions.add(agent_id)

    return {
        identifier_field: identifier_value,
        "input_tokens": totals["input_tokens"],
        "output_tokens": totals["output_tokens"],
        "cache_read": totals["cache_read"],
        "cache_create": totals["cache_create"],
        "billable_tokens": totals["billable_tokens"],
        "total_tokens": totals["total_tokens"],
        "api_calls": totals["api_calls"],
        "duration_secs": totals["duration_secs"],
        "agent_sessions": len(agent_sessions),
        "entries": entries
    }


def filter_by_task(rows, task_id):
    """Filter rows by exact task ID match."""
    return [r for r in rows if r.get("task_id") == task_id]


def filter_by_task_prefix(rows, prefix):
    """Filter rows by task ID prefix."""
    return [r for r in rows if (r.get("task_id") or "").startswith(prefix)]


def filter_by_session(rows, session_id):
    """Filter rows by session ID."""
    return [r for r in rows if r.get("session_id") == session_id]


def filter_by_agent(rows, agent_id):
    """Filter rows by agent ID."""
    return [r for r in rows if r.get("agent_id") == agent_id]


def main():
    parser = argparse.ArgumentParser(
        description="Aggregate effort metrics for a task, session, or sprint",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --task TASK-1775
  %(prog)s --task-prefix TASK-17
  %(prog)s --session-id abc123

Output (JSON):
  {
    "task_id": "TASK-1775",
    "total_tokens": 125000,
    "billable_tokens": 45000,
    "api_calls": 87,
    "duration_secs": 3600,
    "agent_sessions": 5,
    "entries": 12
  }
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--task", "-t", help="Sum effort for exact task ID")
    group.add_argument("--task-prefix", help="Sum effort for task prefix (e.g., TASK-17 for all TASK-17XX)")
    group.add_argument("--session-id", "-s", help="Sum effort for session ID")
    group.add_argument("--agent-id", "-a", help="Sum effort for agent ID")

    parser.add_argument("--pretty", "-p", action="store_true", help="Pretty print output")

    args = parser.parse_args()

    # Load all rows
    rows = load_metrics()

    if not rows:
        print('{"error": "No metrics file found or empty"}', file=sys.stderr)
        sys.exit(1)

    # Filter based on criteria
    if args.task:
        filtered = filter_by_task(rows, args.task)
        result = aggregate_rows(filtered, "task_id", args.task)
    elif args.task_prefix:
        filtered = filter_by_task_prefix(rows, args.task_prefix)
        result = aggregate_rows(filtered, "task_prefix", args.task_prefix)
    elif args.session_id:
        filtered = filter_by_session(rows, args.session_id)
        result = aggregate_rows(filtered, "session_id", args.session_id)
    elif args.agent_id:
        filtered = filter_by_agent(rows, args.agent_id)
        result = aggregate_rows(filtered, "agent_id", args.agent_id)

    # Output
    if args.pretty:
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps(result))


if __name__ == "__main__":
    main()
