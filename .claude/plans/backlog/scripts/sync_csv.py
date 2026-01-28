#!/usr/bin/env python3
"""
Sync Backlog CSV with Markdown Files

Finds backlog markdown files that are missing from the CSV and adds them.
Also validates existing entries.

Usage:
    python sync_csv.py          # Check and report
    python sync_csv.py --fix    # Auto-add missing items
"""

import argparse
import csv
import os
import re
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
ITEMS_DIR = SCRIPT_DIR.parent / 'items'
CSV_FILE = DATA_DIR / 'backlog.csv'

VALID_STATUSES = {
    'Pending', 'In Progress', 'Implemented', 'Testing',
    'Completed', 'Blocked', 'Deferred', 'Obsolete'
}

VALID_PRIORITIES = {'Critical', 'High', 'Medium', 'Low'}


def extract_metadata(md_path: Path) -> dict:
    """Extract metadata from backlog markdown file."""
    content = md_path.read_text(encoding='utf-8')

    metadata = {
        'id': md_path.stem,
        'title': '',
        'category': 'feature',
        'priority': 'Medium',
        'status': 'Pending',
        'sprint': '-',
        'est_tokens': '-',
        'actual_tokens': '-',
        'variance': '-',
        'created_at': datetime.now().strftime('%Y-%m-%d'),
        'completed_at': '',
        'file': f'[{md_path.name}](items/{md_path.name})'
    }

    # Extract title from first heading
    title_match = re.search(r'^#\s+BACKLOG-\d+[:\s]+(.+)$', content, re.MULTILINE)
    if title_match:
        metadata['title'] = title_match.group(1).strip()
    else:
        # Try alternate format
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if title_match:
            title = title_match.group(1).strip()
            # Remove BACKLOG-XXX prefix if present
            title = re.sub(r'^BACKLOG-\d+[:\s]*', '', title)
            metadata['title'] = title

    # Extract priority
    priority_match = re.search(r'\*\*Priority\*\*[:\s]+(\w+)', content, re.IGNORECASE)
    if priority_match:
        priority = priority_match.group(1).strip()
        if priority in VALID_PRIORITIES:
            metadata['priority'] = priority

    # Extract category
    category_match = re.search(r'\*\*Category\*\*[:\s]+(.+?)(?:\n|\*\*)', content, re.IGNORECASE)
    if category_match:
        metadata['category'] = category_match.group(1).strip().lower().split('/')[0].strip()

    # Extract status
    status_match = re.search(r'\*\*Status\*\*[:\s]+(\w+)', content, re.IGNORECASE)
    if status_match:
        status = status_match.group(1).strip()
        if status in VALID_STATUSES:
            metadata['status'] = status

    # Extract sprint
    sprint_match = re.search(r'\*\*Sprint\*\*[:\s]+(SPRINT-\d+|\-)', content, re.IGNORECASE)
    if sprint_match:
        metadata['sprint'] = sprint_match.group(1).strip()

    # Extract estimate
    est_match = re.search(r'\*\*Estimate\*\*[:\s]+(.+?)(?:\n|\*\*)', content, re.IGNORECASE)
    if est_match:
        metadata['est_tokens'] = est_match.group(1).strip()

    return metadata


def load_csv() -> dict:
    """Load existing CSV entries into a dict keyed by ID."""
    entries = {}
    if CSV_FILE.exists():
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                entries[row['id']] = row
    return entries


def find_markdown_files() -> list:
    """Find all backlog markdown files."""
    return sorted(ITEMS_DIR.glob('BACKLOG-*.md'))


def check_sync():
    """Check if CSV is in sync with markdown files."""
    csv_entries = load_csv()
    md_files = find_markdown_files()

    csv_ids = set(csv_entries.keys())
    md_ids = {f.stem for f in md_files}

    missing_from_csv = md_ids - csv_ids
    orphaned_in_csv = csv_ids - md_ids

    # Check for invalid statuses
    invalid_statuses = []
    for id_, entry in csv_entries.items():
        if entry.get('status') and entry['status'] not in VALID_STATUSES:
            invalid_statuses.append((id_, entry['status']))

    return {
        'csv_count': len(csv_ids),
        'md_count': len(md_ids),
        'missing_from_csv': sorted(missing_from_csv),
        'orphaned_in_csv': sorted(orphaned_in_csv),
        'invalid_statuses': invalid_statuses,
        'in_sync': len(missing_from_csv) == 0 and len(invalid_statuses) == 0
    }


def fix_csv(missing_ids: list):
    """Add missing items to CSV."""
    if not missing_ids:
        return

    # Load existing
    existing = load_csv()

    # Get fieldnames from existing
    fieldnames = ['id', 'title', 'category', 'priority', 'status', 'sprint',
                  'est_tokens', 'actual_tokens', 'variance', 'created_at',
                  'completed_at', 'file']

    # Add missing
    for id_ in missing_ids:
        md_path = ITEMS_DIR / f'{id_}.md'
        if md_path.exists():
            metadata = extract_metadata(md_path)
            existing[id_] = metadata

    # Write back sorted
    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for id_ in sorted(existing.keys(), key=lambda x: int(re.search(r'\d+', x).group())):
            writer.writerow(existing[id_])


def main():
    parser = argparse.ArgumentParser(description='Sync backlog CSV with markdown files')
    parser.add_argument('--fix', action='store_true', help='Auto-add missing items')
    args = parser.parse_args()

    result = check_sync()

    print(f"\n{'='*50}")
    print("BACKLOG CSV SYNC CHECK")
    print(f"{'='*50}\n")

    print(f"Markdown files: {result['md_count']}")
    print(f"CSV entries:    {result['csv_count']}")

    if result['missing_from_csv']:
        print(f"\n❌ Missing from CSV ({len(result['missing_from_csv'])}):")
        for id_ in result['missing_from_csv']:
            print(f"   - {id_}")

    if result['orphaned_in_csv']:
        print(f"\n⚠️  In CSV but no markdown ({len(result['orphaned_in_csv'])}):")
        for id_ in result['orphaned_in_csv']:
            print(f"   - {id_}")

    if result['invalid_statuses']:
        print(f"\n❌ Invalid status values:")
        for id_, status in result['invalid_statuses']:
            print(f"   - {id_}: '{status}'")

    if result['in_sync']:
        print("\n✅ CSV is in sync with markdown files")
    else:
        print("\n❌ CSV is OUT OF SYNC")

        if args.fix and result['missing_from_csv']:
            print("\nFixing...")
            fix_csv(result['missing_from_csv'])
            print(f"Added {len(result['missing_from_csv'])} items to CSV")
            print("Run generate_dashboard.py to update the dashboard")
        elif result['missing_from_csv']:
            print("\nRun with --fix to add missing items")

    print()
    return 0 if result['in_sync'] else 1


if __name__ == '__main__':
    exit(main())
