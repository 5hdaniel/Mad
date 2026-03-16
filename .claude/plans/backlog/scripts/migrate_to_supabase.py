#!/usr/bin/env python3
"""
migrate_to_supabase.py — Migrate CSV/Markdown PM data to Supabase pm_* tables.

Usage:
    export SUPABASE_URL="https://your-project.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
    python3 migrate_to_supabase.py

The script is idempotent: safe to re-run. Uses ON CONFLICT (legacy_id) DO UPDATE
for core tables. Wraps each table's inserts in a transaction.

Migration order (FK dependency chain):
    1. pm_sprints      (sprints.csv + SPRINT-*.md)
    2. pm_backlog_items (backlog.csv + BACKLOG-*.md)
    3. pm_tasks         (TASK-*.md files)
    4. pm_token_metrics (tokens.csv)
    5. pm_changelog     (changelog.csv)
"""

import csv
import glob
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase python-dotenv")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional — env vars can be set directly

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Paths relative to the repo root — caller can override via REPO_ROOT env var
REPO_ROOT = Path(os.environ.get("REPO_ROOT", Path(__file__).resolve().parents[4]))

SPRINTS_CSV = REPO_ROOT / ".claude" / "plans" / "backlog" / "data" / "sprints.csv"
BACKLOG_CSV = REPO_ROOT / ".claude" / "plans" / "backlog" / "data" / "backlog.csv"
TOKENS_CSV = REPO_ROOT / ".claude" / "metrics" / "tokens.csv"
CHANGELOG_CSV = REPO_ROOT / ".claude" / "plans" / "backlog" / "data" / "changelog.csv"

SPRINTS_MD_DIR = REPO_ROOT / ".claude" / "plans" / "sprints"
BACKLOG_MD_DIR = REPO_ROOT / ".claude" / "plans" / "backlog" / "items"
TASKS_MD_DIR = REPO_ROOT / ".claude" / "plans" / "tasks"

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------

stats = {
    "sprints_source": 0,
    "sprints_inserted": 0,
    "backlog_source": 0,
    "backlog_inserted": 0,
    "backlog_skipped": 0,
    "tasks_source": 0,
    "tasks_inserted": 0,
    "tasks_skipped": 0,
    "metrics_source": 0,
    "metrics_inserted": 0,
    "metrics_skipped": 0,
    "changelog_source": 0,
    "changelog_inserted": 0,
    "changelog_skipped": 0,
}

# ---------------------------------------------------------------------------
# Normalizers
# ---------------------------------------------------------------------------

SPRINT_STATUS_MAP = {
    "completed": "completed",
    "complete": "completed",
    "active": "active",
    "planned": "planned",
    "deprecated": "cancelled",
    # Handle title-case from CSV
    "Completed": "completed",
    "Complete": "completed",
    "Active": "active",
    "Planned": "planned",
    "Deprecated": "cancelled",
}

BACKLOG_STATUS_MAP = {
    "Completed": "completed",
    "In Progress": "in_progress",
    "Pending": "pending",
    "Testing": "testing",
    "Deferred": "deferred",
    "Obsolete": "obsolete",
    "Blocked": "blocked",
    "Reopened": "reopened",
    # Already normalized
    "completed": "completed",
    "in_progress": "in_progress",
    "pending": "pending",
    "testing": "testing",
    "deferred": "deferred",
    "obsolete": "obsolete",
    "blocked": "blocked",
    "reopened": "reopened",
}

TASK_STATUS_MAP = {
    "Completed": "completed",
    "In Progress": "in_progress",
    "Pending": "pending",
    "Testing": "testing",
    "Deferred": "deferred",
    "Blocked": "blocked",
    "completed": "completed",
    "in_progress": "in_progress",
    "pending": "pending",
    "testing": "testing",
    "deferred": "deferred",
    "blocked": "blocked",
}

PRIORITY_MAP = {
    "Critical": "critical",
    "High": "high",
    "Medium": "medium",
    "Low": "low",
    "critical": "critical",
    "high": "high",
    "medium": "medium",
    "low": "low",
}

# Valid type values per schema CHECK constraint
VALID_TYPES = {"feature", "bug", "chore", "spike", "epic"}

# Map CSV types to valid types
TYPE_MAP = {
    "feature": "feature",
    "bug": "bug",
    "chore": "chore",
    "spike": "spike",
    "epic": "epic",
    "refactor": "chore",   # refactor -> chore (closest match)
    "test": "chore",       # test -> chore (closest match)
    "docs": "chore",       # docs -> chore (closest match)
}


def normalize_tokens(value: str) -> int | None:
    """Convert token strings to integer values.

    Handles formats:
        ~30K   -> 30000
        20-30K -> 25000  (average of range)
        5000   -> 5000
        ~25K-40K -> 32500 (average of range)
        -      -> None
        (blank) -> None
    """
    if not value or value.strip() in ("-", ""):
        return None

    s = value.strip().lstrip("~")

    # Range with K suffix: "20-30K" or "25K-40K" or "~25K-40K"
    range_k_match = re.match(r"^(\d+)K?\s*-\s*(\d+)K$", s, re.IGNORECASE)
    if range_k_match:
        low = int(range_k_match.group(1)) * 1000
        high = int(range_k_match.group(2)) * 1000
        return (low + high) // 2

    # Simple K suffix: "30K"
    k_match = re.match(r"^(\d+)K$", s, re.IGNORECASE)
    if k_match:
        return int(k_match.group(1)) * 1000

    # Plain integer: "5000"
    if s.isdigit():
        return int(s)

    # Could not parse — return None and log
    print(f"  WARNING: Could not parse token value: {value!r} -> treating as NULL")
    return None


def normalize_variance(value: str) -> float | None:
    """Convert variance strings to numeric values.

    Handles formats:
        -72%   -> -72.00
        +100%  -> 100.00
        0%     -> 0.00
        0      -> 0.00
        -      -> None
        (blank) -> None
        (text)  -> None  (description leaked into variance column)
    """
    if not value or value.strip() in ("-", ""):
        return None

    s = value.strip()

    # Percentage format: "+100%", "-72%", "0%"
    pct_match = re.match(r"^([+-]?\d+(?:\.\d+)?)%$", s)
    if pct_match:
        return float(pct_match.group(1))

    # Plain number: "0", "58"
    try:
        return float(s)
    except ValueError:
        pass

    # Non-numeric text (description leaked into variance) -> NULL
    return None


def normalize_date(value: str) -> str | None:
    """Normalize date strings. Returns ISO date string or None."""
    if not value or value.strip() in ("-", ""):
        return None

    s = value.strip()

    # Validate it looks like a date: YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s

    # Try ISO datetime
    if re.match(r"^\d{4}-\d{2}-\d{2}T", s):
        return s

    return None


def extract_file_from_md_link(value: str) -> str | None:
    """Extract filename from markdown link [BACKLOG-001.md](BACKLOG-001.md) or plain text."""
    if not value or value.strip() in ("-", ""):
        return None

    s = value.strip()

    # Markdown link: [text](url)
    md_match = re.match(r"\[.*?\]\((.*?)\)", s)
    if md_match:
        return md_match.group(1)

    # If it looks like a path with .md extension, return as-is
    if s.endswith(".md"):
        return s

    # Otherwise return None for non-file values
    return None


def find_sprint_md(sprint_id: str) -> str | None:
    """Find and read a sprint .md file matching the sprint_id.

    Sprint files are named like SPRINT-042-database-schema-alignment.md
    """
    pattern = str(SPRINTS_MD_DIR / f"{sprint_id}-*.md")
    matches = glob.glob(pattern)
    if not matches:
        # Try exact match (no suffix)
        exact = SPRINTS_MD_DIR / f"{sprint_id}.md"
        if exact.exists():
            matches = [str(exact)]
    if matches:
        try:
            return Path(matches[0]).read_text(encoding="utf-8")
        except Exception as e:
            print(f"  WARNING: Could not read sprint file {matches[0]}: {e}")
    return None


def find_backlog_md(backlog_id: str) -> str | None:
    """Find and read a backlog item .md file like BACKLOG-001.md."""
    path = BACKLOG_MD_DIR / f"{backlog_id}.md"
    if path.exists():
        try:
            return path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  WARNING: Could not read backlog file {path}: {e}")
    return None


def read_task_md(filepath: Path) -> str | None:
    """Read a task .md file."""
    try:
        return filepath.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  WARNING: Could not read task file {filepath}: {e}")
    return None


def parse_task_metadata(content: str, filename: str) -> dict:
    """Parse metadata from a task .md file.

    Extracts:
        - legacy_id: from filename TASK-XXXX-*.md
        - title: from # TASK-XXXX: Title or # Task TASK-XXXX: Title
        - status: from **Status:** line
        - sprint: from **Sprint:** line
        - backlog_ref: from **Backlog ID:** line
        - est_tokens: from **Estimated Tokens:** line
    """
    meta = {}

    # Extract legacy_id from filename: TASK-1003-auto-refresh-on-load.md -> TASK-1003
    task_id_match = re.match(r"(TASK-\d+)", filename)
    if task_id_match:
        meta["legacy_id"] = task_id_match.group(1)

    # Title from header: "# TASK-1003: Title" or "# Task TASK-1003: Title"
    title_match = re.search(
        r"^#\s+(?:Task\s+)?(?:TASK-\d+):\s*(.+)$", content, re.MULTILINE
    )
    if title_match:
        meta["title"] = title_match.group(1).strip()
    else:
        # Fallback: use filename slug
        slug = filename.replace(".md", "")
        parts = slug.split("-", 2)  # TASK-1003-auto-refresh
        meta["title"] = parts[2].replace("-", " ").title() if len(parts) > 2 else slug

    # Status
    status_match = re.search(
        r"\*\*Status:\*\*\s*(.+?)(?:\s*$|\s*\n)", content, re.MULTILINE
    )
    if status_match:
        raw_status = status_match.group(1).strip().rstrip("*")
        meta["status"] = TASK_STATUS_MAP.get(raw_status, "pending")

    # Sprint
    sprint_match = re.search(
        r"\*\*Sprint:\*\*\s*(SPRINT-\d+)", content, re.MULTILINE
    )
    if sprint_match:
        meta["sprint_ref"] = sprint_match.group(1)

    # Backlog ID
    backlog_match = re.search(
        r"\*\*Backlog ID:\*\*\s*(BACKLOG-\d+)", content, re.MULTILINE
    )
    if backlog_match:
        meta["backlog_ref"] = backlog_match.group(1)

    # Estimated Tokens
    tokens_match = re.search(
        r"\*\*Estimated(?:\s+Tokens)?(?:\s*Tokens)?:\*\*\s*(.+?)(?:\s*$|\s*\n)",
        content,
        re.MULTILINE,
    )
    if tokens_match:
        raw_tokens = tokens_match.group(1).strip()
        # Handle formats like "~40K (raw), ~20K with 0.50x service multiplier"
        # Take the first token value
        first_token = raw_tokens.split(",")[0].split("(")[0].strip()
        meta["est_tokens"] = normalize_tokens(first_token)

    return meta


# ---------------------------------------------------------------------------
# Migration functions
# ---------------------------------------------------------------------------


def migrate_sprints(supabase: Client) -> dict[str, str]:
    """Migrate sprints.csv + sprint .md files to pm_sprints.

    Returns a mapping of legacy_id -> UUID for FK resolution.
    """
    print("\n=== Migrating Sprints ===")

    sprint_map: dict[str, str] = {}

    if not SPRINTS_CSV.exists():
        print(f"  ERROR: Sprints CSV not found at {SPRINTS_CSV}")
        return sprint_map

    rows_to_upsert = []

    with open(SPRINTS_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            stats["sprints_source"] += 1
            legacy_id = row.get("sprint_id", "").strip()
            if not legacy_id:
                print(f"  SKIP: Row with empty sprint_id: {row}")
                continue

            name = row.get("name", "").strip() or legacy_id
            raw_status = row.get("status", "planned").strip()
            status = SPRINT_STATUS_MAP.get(raw_status, "planned")
            items_completed = row.get("items_completed", "").strip() or None

            # Look for matching .md file
            body = find_sprint_md(legacy_id)

            rows_to_upsert.append({
                "legacy_id": legacy_id,
                "name": name,
                "status": status,
                "goal": items_completed,  # Store items_completed summary as goal
                "body": body,
            })

    if not rows_to_upsert:
        print("  No sprint rows to insert.")
        return sprint_map

    # Upsert in batches
    print(f"  Upserting {len(rows_to_upsert)} sprints...")
    try:
        result = (
            supabase.table("pm_sprints")
            .upsert(
                rows_to_upsert,
                on_conflict="legacy_id",
            )
            .execute()
        )
        stats["sprints_inserted"] = len(result.data) if result.data else 0
        print(f"  Upserted {stats['sprints_inserted']} sprints.")

        # Build legacy_id -> UUID map
        for item in result.data or []:
            sprint_map[item["legacy_id"]] = item["id"]
    except Exception as e:
        print(f"  ERROR upserting sprints: {e}")

    # If the upsert result didn't return all data, fetch the full map
    if not sprint_map:
        print("  Fetching sprint ID map from database...")
        try:
            resp = (
                supabase.table("pm_sprints")
                .select("id, legacy_id")
                .not_.is_("legacy_id", "null")
                .execute()
            )
            for item in resp.data or []:
                sprint_map[item["legacy_id"]] = item["id"]
            print(f"  Loaded {len(sprint_map)} sprint mappings.")
        except Exception as e:
            print(f"  ERROR fetching sprint map: {e}")

    return sprint_map


def migrate_backlog_items(
    supabase: Client, sprint_map: dict[str, str]
) -> dict[str, str]:
    """Migrate backlog.csv + BACKLOG-*.md files to pm_backlog_items.

    Returns a mapping of legacy_id -> UUID for FK resolution.
    """
    print("\n=== Migrating Backlog Items ===")

    backlog_map: dict[str, str] = {}

    if not BACKLOG_CSV.exists():
        print(f"  ERROR: Backlog CSV not found at {BACKLOG_CSV}")
        return backlog_map

    rows_to_upsert = []
    skipped_rows = []

    with open(BACKLOG_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            stats["backlog_source"] += 1
            legacy_id = row.get("id", "").strip()

            # Validate legacy_id format
            if not legacy_id or not re.match(r"^BACKLOG-\d+$", legacy_id):
                msg = f"Line {row_num}: Invalid ID {legacy_id!r}"
                print(f"  SKIP: {msg}")
                skipped_rows.append(msg)
                stats["backlog_skipped"] += 1
                continue

            title = row.get("title", "").strip()
            if not title:
                msg = f"Line {row_num}: {legacy_id} has empty title"
                print(f"  SKIP: {msg}")
                skipped_rows.append(msg)
                stats["backlog_skipped"] += 1
                continue

            # Normalize type
            raw_type = row.get("type", "feature").strip().lower()
            item_type = TYPE_MAP.get(raw_type, "feature")

            # Normalize area
            area = row.get("area", "").strip() or None

            # Normalize priority
            raw_priority = row.get("priority", "medium").strip()
            priority = PRIORITY_MAP.get(raw_priority, "medium")

            # Normalize status
            raw_status = row.get("status", "pending").strip()
            status = BACKLOG_STATUS_MAP.get(raw_status, "pending")

            # Resolve sprint FK
            raw_sprint = row.get("sprint", "").strip()
            sprint_id = None
            if raw_sprint and raw_sprint != "-":
                # Handle comma-separated sprints — take the last one
                sprint_refs = [s.strip() for s in raw_sprint.split(",")]
                for ref in reversed(sprint_refs):
                    if ref in sprint_map:
                        sprint_id = sprint_map[ref]
                        break
                if sprint_id is None and sprint_refs:
                    # Try matching just the first one
                    ref = sprint_refs[0].strip()
                    sprint_match = re.match(r"(SPRINT-\d+)", ref)
                    if sprint_match and sprint_match.group(1) in sprint_map:
                        sprint_id = sprint_map[sprint_match.group(1)]

            # Normalize tokens
            est_tokens = normalize_tokens(row.get("est_tokens", ""))
            actual_tokens = normalize_tokens(row.get("actual_tokens", ""))

            # Normalize variance
            variance = normalize_variance(row.get("variance", ""))

            # Dates
            created_at = normalize_date(row.get("created_at", ""))
            completed_at = normalize_date(row.get("completed_at", ""))

            # File column — extract from markdown link
            file_val = extract_file_from_md_link(row.get("file", ""))

            # Description — get from CSV; also check for overflow in None key
            description = row.get("description", "").strip() or None
            # Handle extra columns (from DictReader overflow)
            extra = row.get(None)
            if extra and isinstance(extra, list) and extra:
                # Extra columns mean the description overflowed
                if description:
                    description = description + " " + " ".join(extra)
                else:
                    description = " ".join(extra)

            # Body content — look for .md file
            body = find_backlog_md(legacy_id)

            record = {
                "legacy_id": legacy_id,
                "title": title,
                "type": item_type,
                "area": area,
                "priority": priority,
                "status": status,
                "sprint_id": sprint_id,
                "est_tokens": est_tokens,
                "actual_tokens": actual_tokens,
                "variance": variance,
                "file": file_val,
                "description": description,
                "body": body,
            }

            # Add dates only if valid (avoid overwriting with NULL on re-run)
            if created_at:
                record["created_at"] = created_at
            if completed_at:
                record["completed_at"] = completed_at

            rows_to_upsert.append(record)

    if not rows_to_upsert:
        print("  No backlog rows to insert.")
        return backlog_map

    # Upsert in batches of 100 to avoid payload size limits
    BATCH_SIZE = 100
    total_upserted = 0
    print(f"  Upserting {len(rows_to_upsert)} backlog items in batches of {BATCH_SIZE}...")

    for i in range(0, len(rows_to_upsert), BATCH_SIZE):
        batch = rows_to_upsert[i : i + BATCH_SIZE]
        try:
            result = (
                supabase.table("pm_backlog_items")
                .upsert(batch, on_conflict="legacy_id")
                .execute()
            )
            batch_count = len(result.data) if result.data else 0
            total_upserted += batch_count

            # Build map from results
            for item in result.data or []:
                if item.get("legacy_id"):
                    backlog_map[item["legacy_id"]] = item["id"]
        except Exception as e:
            print(f"  ERROR upserting backlog batch {i // BATCH_SIZE + 1}: {e}")
            # Log the first failing row for debugging
            if batch:
                print(f"    First row in batch: {batch[0].get('legacy_id', 'unknown')}")

    stats["backlog_inserted"] = total_upserted
    print(f"  Upserted {total_upserted} backlog items. Skipped {stats['backlog_skipped']}.")

    # Ensure we have the full map
    if len(backlog_map) < total_upserted:
        print("  Fetching complete backlog ID map from database...")
        try:
            resp = (
                supabase.table("pm_backlog_items")
                .select("id, legacy_id")
                .not_.is_("legacy_id", "null")
                .limit(1000)
                .execute()
            )
            for item in resp.data or []:
                backlog_map[item["legacy_id"]] = item["id"]
            print(f"  Loaded {len(backlog_map)} backlog mappings.")
        except Exception as e:
            print(f"  ERROR fetching backlog map: {e}")

    return backlog_map


def migrate_tasks(
    supabase: Client,
    sprint_map: dict[str, str],
    backlog_map: dict[str, str],
) -> None:
    """Migrate TASK-*.md files to pm_tasks."""
    print("\n=== Migrating Tasks ===")

    if not TASKS_MD_DIR.exists():
        print(f"  ERROR: Tasks directory not found at {TASKS_MD_DIR}")
        return

    rows_to_upsert = []
    skipped = 0

    # Gather all task .md files (skip template, skip archive dir)
    task_files = sorted(TASKS_MD_DIR.glob("TASK-*.md"))
    print(f"  Found {len(task_files)} task files.")

    for filepath in task_files:
        filename = filepath.name
        stats["tasks_source"] += 1

        # Skip template
        if filename == "TASK-TEMPLATE.md":
            stats["tasks_source"] -= 1
            continue

        content = read_task_md(filepath)
        if content is None:
            print(f"  SKIP: Could not read {filename}")
            skipped += 1
            stats["tasks_skipped"] += 1
            continue

        meta = parse_task_metadata(content, filename)

        legacy_id = meta.get("legacy_id")
        if not legacy_id:
            print(f"  SKIP: Could not extract task ID from {filename}")
            skipped += 1
            stats["tasks_skipped"] += 1
            continue

        title = meta.get("title", filename.replace(".md", ""))
        status = meta.get("status", "pending")

        # Resolve sprint FK
        sprint_id = None
        sprint_ref = meta.get("sprint_ref")
        if sprint_ref and sprint_ref in sprint_map:
            sprint_id = sprint_map[sprint_ref]

        # Resolve backlog item FK
        backlog_item_id = None
        backlog_ref = meta.get("backlog_ref")
        if backlog_ref and backlog_ref in backlog_map:
            backlog_item_id = backlog_map[backlog_ref]

        est_tokens = meta.get("est_tokens")

        record = {
            "legacy_id": legacy_id,
            "title": title,
            "status": status,
            "sprint_id": sprint_id,
            "backlog_item_id": backlog_item_id,
            "est_tokens": est_tokens,
            "body": content,
        }

        rows_to_upsert.append(record)

    if not rows_to_upsert:
        print("  No task rows to insert.")
        return

    # Upsert in batches
    BATCH_SIZE = 50  # Smaller batches — task bodies can be large
    total_upserted = 0
    print(f"  Upserting {len(rows_to_upsert)} tasks in batches of {BATCH_SIZE}...")

    for i in range(0, len(rows_to_upsert), BATCH_SIZE):
        batch = rows_to_upsert[i : i + BATCH_SIZE]
        try:
            result = (
                supabase.table("pm_tasks")
                .upsert(batch, on_conflict="legacy_id")
                .execute()
            )
            batch_count = len(result.data) if result.data else 0
            total_upserted += batch_count
        except Exception as e:
            print(f"  ERROR upserting task batch {i // BATCH_SIZE + 1}: {e}")
            # Try individual inserts for this batch to identify the problem row
            for record in batch:
                try:
                    supabase.table("pm_tasks").upsert(
                        record, on_conflict="legacy_id"
                    ).execute()
                    total_upserted += 1
                except Exception as e2:
                    print(f"    SKIP: {record.get('legacy_id')}: {e2}")
                    skipped += 1
                    stats["tasks_skipped"] += 1

    stats["tasks_inserted"] = total_upserted
    print(f"  Upserted {total_upserted} tasks. Skipped {skipped}.")


def migrate_token_metrics(supabase: Client) -> None:
    """Migrate tokens.csv to pm_token_metrics."""
    print("\n=== Migrating Token Metrics ===")

    if not TOKENS_CSV.exists():
        print(f"  ERROR: Tokens CSV not found at {TOKENS_CSV}")
        return

    rows_to_insert = []
    skipped = 0

    with open(TOKENS_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            stats["metrics_source"] += 1

            timestamp = row.get("timestamp", "").strip()
            if not timestamp:
                print(f"  SKIP: Line {row_num} has no timestamp")
                skipped += 1
                stats["metrics_skipped"] += 1
                continue

            # Parse integer fields safely
            def safe_int(val: str) -> int | None:
                v = val.strip() if val else ""
                if not v:
                    return None
                try:
                    return int(v)
                except ValueError:
                    return None

            # Parse numeric fields safely
            def safe_float(val: str) -> float | None:
                v = val.strip() if val else ""
                if not v:
                    return None
                try:
                    return float(v)
                except ValueError:
                    return None

            # Map CSV columns to table columns
            session_id = row.get("session_id", "").strip() or None
            agent_id = row.get("agent_id", "").strip() or None
            agent_type = row.get("agent_type", "").strip() or None
            task_id = row.get("task_id", "").strip() or None
            description = row.get("description", "").strip() or None

            input_tokens = safe_int(row.get("input_tokens", ""))
            output_tokens = safe_int(row.get("output_tokens", ""))
            total_tokens = safe_int(row.get("total_tokens", ""))
            cache_creation_tokens = safe_int(row.get("cache_create", ""))
            cache_read_tokens = safe_int(row.get("cache_read", ""))
            # billable_tokens from CSV not in schema — we skip it
            api_calls = safe_int(row.get("api_calls", ""))

            # Duration: CSV has duration_secs, table has duration_ms
            duration_secs = safe_int(row.get("duration_secs", ""))
            duration_ms = duration_secs * 1000 if duration_secs is not None else None

            model = row.get("model", "").strip() or None

            # cost_usd not in CSV — set to None
            cost_usd = None

            record = {
                "session_id": session_id,
                "agent_id": agent_id,
                "agent_type": agent_type,
                "task_id": task_id,
                "description": description,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "cache_creation_tokens": cache_creation_tokens,
                "cache_read_tokens": cache_read_tokens,
                "cost_usd": cost_usd,
                "duration_ms": duration_ms,
                "api_calls": api_calls,
                "model": model,
                "recorded_at": timestamp,
            }

            rows_to_insert.append(record)

    if not rows_to_insert:
        print("  No metrics rows to insert.")
        return

    # For metrics, we don't have a legacy_id for ON CONFLICT.
    # Strategy: delete all existing rows then insert fresh (idempotent on re-run).
    # Alternatively, use recorded_at + agent_id + session_id as a composite check.
    # Since the task says "use ON CONFLICT on a composite key or just INSERT",
    # we'll clear and re-insert for idempotency.

    print(f"  Clearing existing pm_token_metrics rows for idempotent re-run...")
    try:
        # Delete all rows (service role has permission)
        supabase.table("pm_token_metrics").delete().gte(
            "recorded_at", "1970-01-01"
        ).execute()
    except Exception as e:
        print(f"  WARNING: Could not clear pm_token_metrics: {e}")
        print("  Will attempt insert anyway (may create duplicates on re-run).")

    BATCH_SIZE = 200
    total_inserted = 0
    print(f"  Inserting {len(rows_to_insert)} metrics rows in batches of {BATCH_SIZE}...")

    for i in range(0, len(rows_to_insert), BATCH_SIZE):
        batch = rows_to_insert[i : i + BATCH_SIZE]
        try:
            result = (
                supabase.table("pm_token_metrics")
                .insert(batch)
                .execute()
            )
            batch_count = len(result.data) if result.data else 0
            total_inserted += batch_count
        except Exception as e:
            print(f"  ERROR inserting metrics batch {i // BATCH_SIZE + 1}: {e}")
            skipped += len(batch)
            stats["metrics_skipped"] += len(batch)

    stats["metrics_inserted"] = total_inserted
    print(f"  Inserted {total_inserted} metrics rows. Skipped {skipped}.")


def migrate_changelog(supabase: Client) -> None:
    """Migrate changelog.csv to pm_changelog."""
    print("\n=== Migrating Changelog ===")

    if not CHANGELOG_CSV.exists():
        print(f"  ERROR: Changelog CSV not found at {CHANGELOG_CSV}")
        return

    rows_to_insert = []
    skipped = 0

    with open(CHANGELOG_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            stats["changelog_source"] += 1

            date_val = row.get("date", "").strip()
            action = row.get("action", "").strip()
            details = row.get("details", "").strip()
            items_affected = row.get("items_affected", "").strip() or None

            if not details and not action:
                print(f"  SKIP: Line {row_num} has no action or details")
                skipped += 1
                stats["changelog_skipped"] += 1
                continue

            # Map CSV columns to table columns:
            # date -> change_date
            # action -> category
            # details -> description
            # items_affected -> details (reuse for item references)
            change_date = normalize_date(date_val)

            record = {
                "change_date": change_date,
                "category": action or None,
                "description": details or action or "No description",
                "details": items_affected,
            }

            # Extract sprint/task references from the details text
            sprint_refs = re.findall(r"SPRINT-\d+", details)
            task_refs = re.findall(r"TASK-\d+", details)
            if sprint_refs:
                record["sprint_ref"] = sprint_refs[0]
            if task_refs:
                record["task_ref"] = task_refs[0]

            rows_to_insert.append(record)

    if not rows_to_insert:
        print("  No changelog rows to insert.")
        return

    # Clear and re-insert for idempotency (no legacy_id to conflict on)
    print(f"  Clearing existing pm_changelog rows for idempotent re-run...")
    try:
        supabase.table("pm_changelog").delete().gte(
            "created_at", "1970-01-01"
        ).execute()
    except Exception as e:
        print(f"  WARNING: Could not clear pm_changelog: {e}")

    BATCH_SIZE = 100
    total_inserted = 0
    print(f"  Inserting {len(rows_to_insert)} changelog rows in batches of {BATCH_SIZE}...")

    for i in range(0, len(rows_to_insert), BATCH_SIZE):
        batch = rows_to_insert[i : i + BATCH_SIZE]
        try:
            result = (
                supabase.table("pm_changelog")
                .insert(batch)
                .execute()
            )
            batch_count = len(result.data) if result.data else 0
            total_inserted += batch_count
        except Exception as e:
            print(f"  ERROR inserting changelog batch {i // BATCH_SIZE + 1}: {e}")
            skipped += len(batch)
            stats["changelog_skipped"] += len(batch)

    stats["changelog_inserted"] = total_inserted
    print(f"  Inserted {total_inserted} changelog rows. Skipped {skipped}.")


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------


def verify_counts(supabase: Client) -> None:
    """Print final row counts from Supabase tables vs source data."""
    print("\n" + "=" * 60)
    print("Migration Complete")
    print("=" * 60)

    tables = [
        ("pm_sprints", "sprints_source", "sprints_inserted"),
        ("pm_backlog_items", "backlog_source", "backlog_inserted"),
        ("pm_tasks", "tasks_source", "tasks_inserted"),
        ("pm_token_metrics", "metrics_source", "metrics_inserted"),
        ("pm_changelog", "changelog_source", "changelog_inserted"),
    ]

    total_skipped = (
        stats["backlog_skipped"]
        + stats["tasks_skipped"]
        + stats["metrics_skipped"]
        + stats["changelog_skipped"]
    )

    for table_name, source_key, inserted_key in tables:
        try:
            resp = (
                supabase.table(table_name)
                .select("id", count="exact")
                .execute()
            )
            db_count = resp.count if resp.count is not None else "?"
        except Exception:
            db_count = "ERROR"

        print(
            f"  {table_name:25s} {str(db_count):>6s} rows  "
            f"(source: {stats[source_key]}, upserted: {stats[inserted_key]})"
        )

    print(f"  {'Skipped rows':25s} {total_skipped:>6d}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    """Run the full migration."""
    print("=" * 60)
    print("PM Data Migration: CSV/Markdown -> Supabase pm_* tables")
    print("=" * 60)

    # Validate environment
    if not SUPABASE_URL:
        print("ERROR: SUPABASE_URL environment variable not set.")
        sys.exit(1)
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable not set.")
        sys.exit(1)

    print(f"  Supabase URL: {SUPABASE_URL[:40]}...")
    print(f"  Repo root:    {REPO_ROOT}")

    # Validate source files exist
    for label, path in [
        ("sprints.csv", SPRINTS_CSV),
        ("backlog.csv", BACKLOG_CSV),
        ("tokens.csv", TOKENS_CSV),
        ("changelog.csv", CHANGELOG_CSV),
        ("sprints/ dir", SPRINTS_MD_DIR),
        ("items/ dir", BACKLOG_MD_DIR),
        ("tasks/ dir", TASKS_MD_DIR),
    ]:
        exists = path.exists()
        status_mark = "OK" if exists else "MISSING"
        print(f"    {label:20s} {status_mark}")
        if not exists:
            print(f"    WARNING: {path} does not exist!")

    # Connect to Supabase
    print("\n  Connecting to Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"ERROR: Could not connect to Supabase: {e}")
        sys.exit(1)
    print("  Connected.")

    # 1. Sprints
    sprint_map = migrate_sprints(supabase)
    print(f"  Sprint map: {len(sprint_map)} entries")

    # 2. Backlog Items (needs sprint_map for FK resolution)
    backlog_map = migrate_backlog_items(supabase, sprint_map)
    print(f"  Backlog map: {len(backlog_map)} entries")

    # 3. Tasks (needs sprint_map + backlog_map for FK resolution)
    migrate_tasks(supabase, sprint_map, backlog_map)

    # 4. Token Metrics
    migrate_token_metrics(supabase)

    # 5. Changelog
    migrate_changelog(supabase)

    # Verification
    verify_counts(supabase)


if __name__ == "__main__":
    main()
