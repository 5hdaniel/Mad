#!/usr/bin/env python3
"""
Backlog Query Interface

Query the backlog CSV files from command line or import as a module.

Usage:
    python queries.py status pending           # Items by status
    python queries.py priority high            # Items by priority
    python queries.py sprint SPRINT-042        # Items in a sprint
    python queries.py type bug                  # Items by type
    python queries.py area ui                   # Items by area
    python queries.py search "sync"            # Search titles
    python queries.py stats                    # Summary statistics

Module usage:
    from queries import get_items_by_status, get_sprint_items, get_items_by_type, get_items_by_area
"""

import argparse
import csv
import sys
from pathlib import Path
from collections import Counter

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
BACKLOG_FILE = DATA_DIR / 'backlog.csv'
SPRINTS_FILE = DATA_DIR / 'sprints.csv'


def load_backlog() -> list[dict]:
    """Load all backlog items."""
    with open(BACKLOG_FILE, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def load_sprints() -> list[dict]:
    """Load all sprints."""
    with open(SPRINTS_FILE, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def normalize(value: str) -> str:
    """Normalize a value for comparison."""
    return value.lower().strip().replace('*', '').replace('_', '')


def get_items_by_status(status: str) -> list[dict]:
    """Get items matching a status."""
    status_norm = normalize(status)
    return [
        item for item in load_backlog()
        if normalize(item.get('status', '')) == status_norm
    ]


def get_items_by_priority(priority: str) -> list[dict]:
    """Get items matching a priority."""
    priority_norm = normalize(priority)
    return [
        item for item in load_backlog()
        if normalize(item.get('priority', '')) == priority_norm
    ]


def get_items_by_type(item_type: str) -> list[dict]:
    """Get items matching a type."""
    type_norm = normalize(item_type)
    return [
        item for item in load_backlog()
        if normalize(item.get('type', '')) == type_norm
    ]


def get_items_by_area(area: str) -> list[dict]:
    """Get items matching an area."""
    area_norm = normalize(area)
    return [
        item for item in load_backlog()
        if normalize(item.get('area', '')) == area_norm
    ]


def get_sprint_items(sprint_id: str) -> list[dict]:
    """Get items assigned to a sprint."""
    sprint_norm = normalize(sprint_id)
    return [
        item for item in load_backlog()
        if normalize(item.get('sprint', '')) == sprint_norm
    ]


def search_items(query: str) -> list[dict]:
    """Search items by title (case-insensitive)."""
    query_lower = query.lower()
    return [
        item for item in load_backlog()
        if query_lower in item.get('title', '').lower()
    ]


def get_open_items() -> list[dict]:
    """Get all non-completed items."""
    closed_statuses = {'completed', 'obsolete'}
    return [
        item for item in load_backlog()
        if normalize(item.get('status', '')) not in closed_statuses
    ]


def get_ready_items() -> list[dict]:
    """Get all pending items sorted by priority (for sprint planning)."""
    priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    items = [
        item for item in load_backlog()
        if normalize(item.get('status', '')) == 'pending'
        and normalize(item.get('sprint', '')) in ('', '-')
    ]
    return sorted(items, key=lambda x: priority_order.get(normalize(x.get('priority', '')), 99))


def get_statistics() -> dict:
    """Get summary statistics about the backlog."""
    items = load_backlog()
    sprints = load_sprints()

    status_counts = Counter(normalize(item.get('status', 'unknown')) for item in items)
    priority_counts = Counter(normalize(item.get('priority', 'unknown')) for item in items)
    type_counts = Counter(normalize(item.get('type', 'unknown')) for item in items)
    area_counts = Counter(normalize(item.get('area', 'unknown')) for item in items)

    sprint_status_counts = Counter(normalize(s.get('status', 'unknown')) for s in sprints)

    return {
        'total_items': len(items),
        'total_sprints': len(sprints),
        'by_status': dict(status_counts),
        'by_priority': dict(priority_counts),
        'by_type': dict(type_counts),
        'by_area': dict(area_counts),
        'sprints_by_status': dict(sprint_status_counts),
    }


def format_item(item: dict, verbose: bool = False) -> str:
    """Format an item for display."""
    base = f"{item['id']}: {item['title']}"
    if verbose:
        base += f"\n  Status: {item.get('status', '-')} | Priority: {item.get('priority', '-')} | Sprint: {item.get('sprint', '-')}"
    return base


def print_items(items: list[dict], verbose: bool = False):
    """Print a list of items."""
    if not items:
        print("No items found.")
        return

    print(f"Found {len(items)} item(s):\n")
    for item in items:
        print(format_item(item, verbose))
    print()


def print_stats(stats: dict):
    """Print statistics in a readable format."""
    print(f"Backlog Statistics")
    print(f"=" * 40)
    print(f"Total items: {stats['total_items']}")
    print(f"Total sprints: {stats['total_sprints']}")
    print()

    print("By Status:")
    for status, count in sorted(stats['by_status'].items(), key=lambda x: -x[1]):
        print(f"  {status}: {count}")
    print()

    print("By Priority:")
    for priority, count in sorted(stats['by_priority'].items(), key=lambda x: -x[1]):
        print(f"  {priority}: {count}")
    print()

    print("By Type:")
    for t, count in sorted(stats['by_type'].items(), key=lambda x: -x[1]):
        print(f"  {t}: {count}")
    print()

    print("By Area:")
    for a, count in sorted(stats['by_area'].items(), key=lambda x: -x[1]):
        print(f"  {a}: {count}")
    print()

    print("Sprints by Status:")
    for status, count in sorted(stats['sprints_by_status'].items(), key=lambda x: -x[1]):
        print(f"  {status}: {count}")


def main():
    parser = argparse.ArgumentParser(
        description='Query the backlog CSV files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python queries.py status pending
  python queries.py priority high --status pending
  python queries.py sprint SPRINT-042
  python queries.py search "sync"
  python queries.py stats
"""
    )

    parser.add_argument('query_type', choices=['status', 'priority', 'type', 'area', 'sprint', 'search', 'open', 'ready', 'stats'],
                        help='Type of query to run')
    parser.add_argument('value', nargs='?', help='Value to query for')
    parser.add_argument('--status', help='Filter by status (for priority/category queries)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Show more details')

    args = parser.parse_args()

    # Handle stats separately
    if args.query_type == 'stats':
        print_stats(get_statistics())
        return

    # Handle open items
    if args.query_type == 'open':
        items = get_open_items()
        print_items(items, args.verbose)
        return

    # Handle ready items (for sprint planning)
    if args.query_type == 'ready':
        items = get_ready_items()
        print(f"Ready for sprint planning ({len(items)} items, sorted by priority):\n")
        for item in items:
            priority = item.get('priority', '-')
            print(f"[{priority.upper():8}] {item['id']}: {item['title']}")
        return

    # Other queries require a value
    if not args.value:
        print(f"Error: {args.query_type} query requires a value", file=sys.stderr)
        sys.exit(1)

    # Run the appropriate query
    if args.query_type == 'status':
        items = get_items_by_status(args.value)
    elif args.query_type == 'priority':
        items = get_items_by_priority(args.value)
        if args.status:
            items = [i for i in items if normalize(i.get('status', '')) == normalize(args.status)]
    elif args.query_type == 'type':
        items = get_items_by_type(args.value)
        if args.status:
            items = [i for i in items if normalize(i.get('status', '')) == normalize(args.status)]
    elif args.query_type == 'area':
        items = get_items_by_area(args.value)
        if args.status:
            items = [i for i in items if normalize(i.get('status', '')) == normalize(args.status)]
    elif args.query_type == 'sprint':
        items = get_sprint_items(args.value)
    elif args.query_type == 'search':
        items = search_items(args.value)
    else:
        print(f"Unknown query type: {args.query_type}", file=sys.stderr)
        sys.exit(1)

    print_items(items, args.verbose)


if __name__ == '__main__':
    main()
