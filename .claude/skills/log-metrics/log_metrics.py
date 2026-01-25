#!/usr/bin/env python3
"""
Log agent metrics to tokens.csv

Usage:
    python log_metrics.py --agent-type engineer --task-id TASK-1184 --description "Implemented feature" --input 5000 --output 3000

All arguments except --agent-type are optional.
"""

import argparse
import csv
import os
from datetime import datetime, timezone
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

VALID_AGENT_TYPES = ["engineer", "pm", "sr-engineer", "qa", "explore", "fix", "main"]


def ensure_csv_exists():
    """Create CSV with headers if it doesn't exist."""
    if not CSV_PATH.exists():
        CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CSV_PATH, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(COLUMNS)


def log_metrics(
    agent_type: str,
    task_id: str = "",
    description: str = "",
    input_tokens: int = 0,
    output_tokens: int = 0,
    cache_read: int = 0,
    cache_create: int = 0,
    api_calls: int = 0,
    duration_secs: int = 0,
    session_id: str = "",
    agent_id: str = "",
    started_at: str = "",
    ended_at: str = ""
):
    """Append a metrics row to tokens.csv."""
    ensure_csv_exists()

    total_tokens = input_tokens + output_tokens + cache_read + cache_create
    billable_tokens = input_tokens + output_tokens
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    row = {
        "timestamp": timestamp,
        "session_id": session_id,
        "agent_id": agent_id,
        "agent_type": agent_type,
        "task_id": task_id,
        "description": description,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_read": cache_read,
        "cache_create": cache_create,
        "billable_tokens": billable_tokens,
        "total_tokens": total_tokens,
        "api_calls": api_calls,
        "duration_secs": duration_secs,
        "started_at": started_at,
        "ended_at": ended_at
    }

    with open(CSV_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writerow(row)

    print(f"Logged metrics for {agent_type}")
    print(f"  Task: {task_id or '(none)'}")
    print(f"  Description: {description or '(none)'}")
    print(f"  Tokens: {total_tokens:,} total ({input_tokens:,} in, {output_tokens:,} out)")
    if duration_secs:
        print(f"  Duration: {duration_secs}s")


def show_summary():
    """Show summary of logged metrics."""
    if not CSV_PATH.exists():
        print("No metrics file found.")
        return

    with open(CSV_PATH, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("No metrics logged yet.")
        return

    # Summary by agent type
    by_type = {}
    for row in rows:
        agent_type = row.get("agent_type") or "unknown"
        if agent_type not in by_type:
            by_type[agent_type] = {"count": 0, "tokens": 0}
        by_type[agent_type]["count"] += 1
        try:
            by_type[agent_type]["tokens"] += int(row.get("total_tokens") or 0)
        except ValueError:
            pass

    print(f"\nMetrics Summary ({len(rows)} entries)")
    print("-" * 40)
    for agent_type, stats in sorted(by_type.items()):
        print(f"  {agent_type:12} {stats['count']:4} entries  {stats['tokens']:>12,} tokens")

    total_tokens = sum(s["tokens"] for s in by_type.values())
    print("-" * 40)
    print(f"  {'TOTAL':12} {len(rows):4} entries  {total_tokens:>12,} tokens")


def main():
    parser = argparse.ArgumentParser(description="Log agent metrics to tokens.csv")
    parser.add_argument("--agent-type", "-t", choices=VALID_AGENT_TYPES, help="Type of agent")
    parser.add_argument("--task-id", "-i", default="", help="Task ID (e.g., TASK-1184, PR-588)")
    parser.add_argument("--description", "-d", default="", help="Brief description of work")
    parser.add_argument("--input", type=int, default=0, help="Input tokens")
    parser.add_argument("--output", type=int, default=0, help="Output tokens")
    parser.add_argument("--cache-read", type=int, default=0, help="Cache read tokens")
    parser.add_argument("--cache-create", type=int, default=0, help="Cache create tokens")
    parser.add_argument("--api-calls", type=int, default=0, help="Number of API calls")
    parser.add_argument("--duration", type=int, default=0, help="Duration in seconds")
    parser.add_argument("--session-id", default="", help="Session ID")
    parser.add_argument("--agent-id", default="", help="Agent ID")
    parser.add_argument("--summary", "-s", action="store_true", help="Show metrics summary")

    args = parser.parse_args()

    if args.summary:
        show_summary()
        return

    if not args.agent_type:
        parser.error("--agent-type is required (or use --summary)")

    log_metrics(
        agent_type=args.agent_type,
        task_id=args.task_id,
        description=args.description,
        input_tokens=args.input,
        output_tokens=args.output,
        cache_read=args.cache_read,
        cache_create=args.cache_create,
        api_calls=args.api_calls,
        duration_secs=args.duration,
        session_id=args.session_id,
        agent_id=args.agent_id
    )


if __name__ == "__main__":
    main()
