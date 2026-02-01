#!/usr/bin/env python3
"""
Query and filter metrics from tokens.csv

Usage:
    python query_metrics.py --task TASK-1234
    python query_metrics.py --agent-type engineer
    python query_metrics.py --since 2026-01-30
    python query_metrics.py --task TASK-1234 --json

All filters can be combined.
"""

import argparse
import csv
import json
import sys
from datetime import datetime
from pathlib import Path

METRICS_DIR = Path(__file__).parent.parent.parent / "metrics"
CSV_PATH = METRICS_DIR / "tokens.csv"

COLUMNS = [
    "timestamp",
    "session_id",
    "agent_id",
    "agent_type",
    "task_id",
    "description",
    "input_tokens",
    "output_tokens",
    "cache_read",
    "cache_create",
    "billable_tokens",
    "total_tokens",
    "api_calls",
    "duration_secs",
    "started_at",
    "ended_at"
]


def load_metrics():
    """Load all rows from tokens.csv."""
    if not CSV_PATH.exists():
        return []

    with open(CSV_PATH, "r") as f:
        reader = csv.DictReader(f)
        return list(reader)


def filter_rows(rows, task=None, task_prefix=None, agent_type=None,
                session_id=None, agent_id=None, since=None, until=None):
    """Filter rows based on criteria."""
    result = []

    for row in rows:
        # Task filter (exact match)
        if task and row.get("task_id") != task:
            continue

        # Task prefix filter (e.g., TASK-17 matches TASK-1775, TASK-1776)
        if task_prefix and not (row.get("task_id") or "").startswith(task_prefix):
            continue

        # Agent type filter
        if agent_type and row.get("agent_type") != agent_type:
            continue

        # Session ID filter
        if session_id and row.get("session_id") != session_id:
            continue

        # Agent ID filter
        if agent_id and row.get("agent_id") != agent_id:
            continue

        # Date filters
        timestamp = row.get("timestamp", "")
        if timestamp:
            try:
                row_date = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

                if since:
                    since_date = datetime.fromisoformat(since + "T00:00:00+00:00")
                    if row_date < since_date:
                        continue

                if until:
                    until_date = datetime.fromisoformat(until + "T23:59:59+00:00")
                    if row_date > until_date:
                        continue
            except (ValueError, TypeError):
                pass

        result.append(row)

    return result


def output_csv(rows):
    """Output rows as CSV."""
    if not rows:
        print("No matching entries found.", file=sys.stderr)
        return

    writer = csv.DictWriter(sys.stdout, fieldnames=COLUMNS)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)


def output_json(rows):
    """Output rows as JSON."""
    # Convert numeric fields
    for row in rows:
        for field in ["input_tokens", "output_tokens", "cache_read", "cache_create",
                      "billable_tokens", "total_tokens", "api_calls", "duration_secs"]:
            try:
                row[field] = int(row.get(field) or 0)
            except (ValueError, TypeError):
                row[field] = 0

    print(json.dumps(rows, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Query and filter metrics from tokens.csv",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --task TASK-1775
  %(prog)s --agent-type engineer --since 2026-01-30
  %(prog)s --task-prefix TASK-17 --json
  %(prog)s --session-id abc123 --json
        """
    )

    # Filters
    parser.add_argument("--task", "-t", help="Filter by exact task ID")
    parser.add_argument("--task-prefix", help="Filter by task ID prefix (e.g., TASK-17)")
    parser.add_argument("--agent-type", "-a", help="Filter by agent type")
    parser.add_argument("--session-id", "-s", help="Filter by session ID")
    parser.add_argument("--agent-id", help="Filter by agent ID")
    parser.add_argument("--since", help="Filter entries on or after date (YYYY-MM-DD)")
    parser.add_argument("--until", help="Filter entries on or before date (YYYY-MM-DD)")

    # Output format
    parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    parser.add_argument("--count", "-c", action="store_true", help="Only show count of matches")

    args = parser.parse_args()

    # Load and filter
    rows = load_metrics()
    filtered = filter_rows(
        rows,
        task=args.task,
        task_prefix=args.task_prefix,
        agent_type=args.agent_type,
        session_id=args.session_id,
        agent_id=args.agent_id,
        since=args.since,
        until=args.until
    )

    # Output
    if args.count:
        print(len(filtered))
    elif args.json:
        output_json(filtered)
    else:
        output_csv(filtered)


if __name__ == "__main__":
    main()
