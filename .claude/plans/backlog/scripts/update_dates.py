#!/usr/bin/env python3
"""
Update backlog CSV with created_at and completed_at dates from git history.

This script:
1. For created_at: Looks up when the MD file was first committed, or falls back
   to the CSV conversion date (2026-01-17) for items without MD files, or the
   original backlog creation date (2025-12-15) for early items.
2. For completed_at: Attempts to determine when an item's status changed to Completed.

Run periodically to update dates for new items.
"""

import csv
import subprocess
import os
import re
from datetime import datetime
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
BACKLOG_DIR = SCRIPT_DIR.parent
DATA_DIR = BACKLOG_DIR / "data"
ITEMS_DIR = BACKLOG_DIR / "items"
CSV_PATH = DATA_DIR / "backlog.csv"
REPO_ROOT = BACKLOG_DIR.parent.parent.parent  # .claude/plans/backlog -> repo root

# Fallback dates
ORIGINAL_BACKLOG_DATE = "2025-12-15"  # When INDEX.md was first created
CSV_CONVERSION_DATE = "2026-01-17"  # When CSV was created from INDEX.md

# Items that existed in the original backlog (before CSV conversion)
# These get ORIGINAL_BACKLOG_DATE as fallback if no MD file
ORIGINAL_ITEMS = set(range(1, 72))  # BACKLOG-001 to BACKLOG-071 were original


def run_git_command(args: list[str]) -> str:
    """Run a git command and return the output."""
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            timeout=30
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return ""


def get_md_creation_date(backlog_id: str) -> str | None:
    """Get the creation date of a backlog MD file from git history."""
    md_path = f"items/{backlog_id}.md"

    # First try the items/ subdirectory (current structure)
    date = run_git_command([
        "log", "--follow", "--diff-filter=A", "--format=%aI", "-1",
        "--", f".claude/plans/backlog/{md_path}"
    ])

    if date:
        return date[:10]  # Extract YYYY-MM-DD

    # Also try the old structure without items/ subdirectory
    date = run_git_command([
        "log", "--follow", "--diff-filter=A", "--format=%aI", "-1",
        "--", f".claude/plans/backlog/{backlog_id}.md"
    ])

    if date:
        return date[:10]

    return None


def get_item_number(backlog_id: str) -> int:
    """Extract the numeric part of a backlog ID."""
    match = re.search(r"BACKLOG-(\d+)", backlog_id)
    if match:
        return int(match.group(1))
    return 0


def get_fallback_date(backlog_id: str) -> str:
    """Get a fallback date for items without MD files."""
    item_num = get_item_number(backlog_id)

    if item_num in ORIGINAL_ITEMS:
        return ORIGINAL_BACKLOG_DATE
    else:
        return CSV_CONVERSION_DATE


def get_completed_date(backlog_id: str, status: str, sprint: str = "", variance: str = "") -> str | None:
    """
    Try to determine when an item was marked as completed.

    Uses multiple strategies:
    1. Look for commits mentioning the backlog ID with completion keywords
    2. Look for sprint completion commits
    3. Extract PR number from variance and find merge date
    """
    if status.lower() not in ("completed", "done"):
        return None

    # Strategy 1: Look for commits that mention this backlog ID being completed
    log_output = run_git_command([
        "log", "--all", "--oneline", "--format=%aI|%s",
        "--grep", f"{backlog_id}",
        "--", ".claude/plans/backlog/"
    ])

    if log_output:
        # Look for completion-related commits
        completion_keywords = ["complete", "completed", "done", "finish", "mark.*complete"]

        for line in log_output.split("\n"):
            if "|" not in line:
                continue
            date, message = line.split("|", 1)
            message_lower = message.lower()

            # Check if this commit seems to be about completing this item
            if backlog_id.lower() in message_lower:
                for keyword in completion_keywords:
                    if re.search(keyword, message_lower):
                        return date[:10]

    # Strategy 2: Look for sprint completion if sprint is assigned
    if sprint and sprint != "-":
        sprint_log = run_git_command([
            "log", "--all", "--oneline", "--format=%aI|%s",
            "--grep", f"{sprint}",
            "--grep", "complete",
            "--all-match",
            "--", ".claude/plans/"
        ])

        if sprint_log:
            for line in sprint_log.split("\n"):
                if "|" not in line:
                    continue
                date, message = line.split("|", 1)
                if sprint.lower() in message.lower():
                    return date[:10]

    # Strategy 3: Extract PR number from variance and find merge date
    if variance:
        pr_match = re.search(r"PR\s*#?(\d+)", variance, re.IGNORECASE)
        if pr_match:
            pr_num = pr_match.group(1)
            # Try to find when this PR was merged
            pr_log = run_git_command([
                "log", "--all", "--oneline", "--format=%aI|%s",
                "--grep", f"#{pr_num}",
            ])
            if pr_log:
                for line in pr_log.split("\n"):
                    if "|" not in line:
                        continue
                    date, message = line.split("|", 1)
                    if f"#{pr_num}" in message or f"PR #{pr_num}" in message.upper():
                        return date[:10]

    return None


def update_csv():
    """Update the CSV with created_at and completed_at dates."""
    if not CSV_PATH.exists():
        print(f"Error: CSV not found at {CSV_PATH}")
        return

    # Read existing CSV
    with open(CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        original_fieldnames = reader.fieldnames or []

    # Ensure created_at and completed_at columns exist
    fieldnames = list(original_fieldnames)

    # Find position after 'variance' and before 'file'
    if "variance" in fieldnames and "file" in fieldnames:
        variance_idx = fieldnames.index("variance")
        file_idx = fieldnames.index("file")

        # Insert created_at and completed_at after variance
        if "created_at" not in fieldnames:
            fieldnames.insert(variance_idx + 1, "created_at")
        if "completed_at" not in fieldnames:
            # Insert after created_at
            created_idx = fieldnames.index("created_at")
            fieldnames.insert(created_idx + 1, "completed_at")
    else:
        # Fallback: just add to end
        if "created_at" not in fieldnames:
            fieldnames.append("created_at")
        if "completed_at" not in fieldnames:
            fieldnames.append("completed_at")

    # Update each row
    updated_count = 0
    cleaned_rows = []
    for row in rows:
        backlog_id = row.get("id", "")
        if not backlog_id.startswith("BACKLOG-"):
            continue

        # Clean row: remove any None keys
        clean_row = {k: v for k, v in row.items() if k is not None and k in fieldnames}

        # Ensure columns exist in row
        if "created_at" not in clean_row:
            clean_row["created_at"] = ""
        if "completed_at" not in clean_row:
            clean_row["completed_at"] = ""

        # Update created_at if empty
        if not clean_row["created_at"]:
            md_date = get_md_creation_date(backlog_id)
            if md_date:
                clean_row["created_at"] = md_date
                updated_count += 1
                print(f"  {backlog_id}: created_at = {md_date} (from MD file)")
            else:
                fallback = get_fallback_date(backlog_id)
                clean_row["created_at"] = fallback
                updated_count += 1
                print(f"  {backlog_id}: created_at = {fallback} (fallback)")

        # Update completed_at if empty and item is completed
        status = clean_row.get("status", "").lower()
        if not clean_row["completed_at"] and status in ("completed", "done"):
            sprint = clean_row.get("sprint", "")
            variance = clean_row.get("variance", "")
            completed_date = get_completed_date(backlog_id, status, sprint, variance)
            if completed_date:
                clean_row["completed_at"] = completed_date
                updated_count += 1
                print(f"  {backlog_id}: completed_at = {completed_date}")

        cleaned_rows.append(clean_row)

    # Write updated CSV
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(cleaned_rows)

    print(f"\nUpdated {updated_count} date fields")
    print(f"CSV saved to: {CSV_PATH}")


def main():
    """Main entry point."""
    print("Updating backlog dates from git history...\n")
    os.chdir(BACKLOG_DIR.parent.parent.parent)  # Change to repo root
    update_csv()


if __name__ == "__main__":
    main()
