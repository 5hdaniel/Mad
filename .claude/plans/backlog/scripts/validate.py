#!/usr/bin/env python3
"""
Backlog Data Validation Script

Validates schema integrity and consistency of backlog CSV files.
Run as part of CI to catch data issues before merge.

Usage:
    python validate.py           # Validate all
    python validate.py --fix     # Auto-fix minor issues (future)
"""

import csv
import sys
from pathlib import Path

# Valid enum values (case-insensitive, allow markdown formatting)
VALID_TYPES = {'bug', 'feature', 'chore', 'refactor', 'test', 'docs'}
VALID_AREAS = {'ui', 'electron', 'infra', 'service', 'security', 'schema', 'ipc'}
VALID_PRIORITIES = {'critical', 'high', 'medium', 'low'}
VALID_STATUSES = {
    'pending', 'in-progress', 'in progress', 'completed', 'blocked', 'deferred',
    'obsolete', 'reopened', 'testing', 'needs feature'  # needs feature is legacy
}
VALID_SPRINT_STATUSES = {'planning', 'planned', 'active', 'complete', 'completed', 'deprecated'}


def normalize(value: str) -> str:
    """Normalize a value for comparison (lowercase, strip markdown)."""
    return value.lower().strip().replace('*', '').replace('_', '')

# Paths
SCRIPT_DIR = Path(__file__).parent
BACKLOG_DIR = SCRIPT_DIR.parent
DATA_DIR = BACKLOG_DIR / 'data'
ITEMS_DIR = BACKLOG_DIR / 'items'


def validate_backlog() -> list:
    """Validate backlog.csv entries."""
    errors = []
    backlog_file = DATA_DIR / 'backlog.csv'

    if not backlog_file.exists():
        errors.append(f"Missing file: {backlog_file}")
        return errors

    with open(backlog_file, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader, start=2):
            item_id = row.get('id', f'row-{i}')

            # Required fields
            if not row.get('id'):
                errors.append(f"Line {i}: Missing id")
            if not row.get('title'):
                errors.append(f"{item_id}: Missing title")

            # Type validation
            item_type = row.get('type', '').strip()
            if item_type and normalize(item_type) not in VALID_TYPES and item_type != '-':
                errors.append(f"{item_id}: Invalid type '{item_type}'")

            # Area validation
            area = row.get('area', '').strip()
            if area and normalize(area) not in VALID_AREAS and area != '-':
                errors.append(f"{item_id}: Invalid area '{area}'")

            # Priority validation
            priority = row.get('priority', '').strip()
            if priority and normalize(priority) not in VALID_PRIORITIES and priority != '-':
                errors.append(f"{item_id}: Invalid priority '{priority}'")

            # Status validation
            status = row.get('status', '').strip()
            if status and normalize(status) not in VALID_STATUSES and status != '-':
                errors.append(f"{item_id}: Invalid status '{status}'")

            # File existence check (optional - many items may not have files yet)
            # file_ref = row.get('file', '').strip()
            # if file_ref and file_ref != '-':
            #     md_file = ITEMS_DIR / file_ref.replace('[', '').replace(']', '').split('(')[0]
            #     if not md_file.exists():
            #         errors.append(f"{item_id}: Missing detail file {file_ref}")

    return errors


def validate_sprints() -> list:
    """Validate sprints.csv entries."""
    errors = []
    sprints_file = DATA_DIR / 'sprints.csv'

    if not sprints_file.exists():
        errors.append(f"Missing file: {sprints_file}")
        return errors

    with open(sprints_file, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader, start=2):
            sprint_id = row.get('sprint_id', f'row-{i}')

            # Status validation
            status = row.get('status', '').strip()
            if status and normalize(status) not in VALID_SPRINT_STATUSES:
                errors.append(f"{sprint_id}: Invalid status '{status}'")

    return errors


def validate_changelog() -> list:
    """Validate changelog.csv entries."""
    errors = []
    changelog_file = DATA_DIR / 'changelog.csv'

    if not changelog_file.exists():
        # Changelog is optional
        return errors

    with open(changelog_file, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader, start=2):
            # Date format check
            date = row.get('date', '')
            if date and len(date) != 10:
                errors.append(f"Changelog line {i}: Invalid date format '{date}' (expected YYYY-MM-DD)")

    return errors


def main():
    """Run all validations."""
    print("Validating backlog data...")
    print(f"  Data dir: {DATA_DIR}")
    print(f"  Items dir: {ITEMS_DIR}")
    print()

    all_errors = []

    # Validate each file
    print("Checking backlog.csv...")
    errors = validate_backlog()
    all_errors.extend(errors)
    print(f"  Found {len(errors)} issues")

    print("Checking sprints.csv...")
    errors = validate_sprints()
    all_errors.extend(errors)
    print(f"  Found {len(errors)} issues")

    print("Checking changelog.csv...")
    errors = validate_changelog()
    all_errors.extend(errors)
    print(f"  Found {len(errors)} issues")

    print()

    if all_errors:
        print("VALIDATION FAILED")
        print("-" * 40)
        for error in all_errors[:20]:  # Show first 20
            print(f"  - {error}")
        if len(all_errors) > 20:
            print(f"  ... and {len(all_errors) - 20} more")
        sys.exit(1)
    else:
        print("VALIDATION PASSED")
        sys.exit(0)


if __name__ == '__main__':
    main()
