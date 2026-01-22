#!/usr/bin/env python3
"""
Backlog Analysis Report Generator

Generates a comprehensive analysis of the backlog state.

Usage:
    python analyze.py              # Full report
    python analyze.py --summary    # Quick summary only
    python analyze.py --json       # Output as JSON
"""

import argparse
import csv
import json
import sys
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
BACKLOG_FILE = DATA_DIR / 'backlog.csv'
SPRINTS_FILE = DATA_DIR / 'sprints.csv'
CHANGELOG_FILE = DATA_DIR / 'changelog.csv'


def load_backlog() -> list[dict]:
    with open(BACKLOG_FILE, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def load_sprints() -> list[dict]:
    with open(SPRINTS_FILE, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def load_changelog() -> list[dict]:
    if not CHANGELOG_FILE.exists():
        return []
    with open(CHANGELOG_FILE, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def normalize(value: str) -> str:
    return value.lower().strip().replace('*', '').replace('_', '')


def parse_tokens(value: str) -> int:
    """Parse token estimate string like '~30K' to integer."""
    if not value or value == '-':
        return 0
    value = value.replace('~', '').replace(',', '').upper().strip()

    # Handle ranges like '800-1.1M' - take the first value
    if '-' in value and not value.startswith('-'):
        value = value.split('-')[0]

    # Handle K suffix
    if 'K' in value:
        try:
            return int(float(value.replace('K', '')) * 1000)
        except ValueError:
            return 0

    # Handle M suffix
    if 'M' in value:
        try:
            return int(float(value.replace('M', '')) * 1000000)
        except ValueError:
            return 0

    try:
        return int(value)
    except ValueError:
        return 0


def analyze_backlog() -> dict:
    """Generate comprehensive backlog analysis."""
    items = load_backlog()
    sprints = load_sprints()
    changelog = load_changelog()

    # Basic counts
    total = len(items)

    # Status breakdown
    status_counts = Counter(normalize(item.get('status', 'unknown')) for item in items)

    # Priority breakdown
    priority_counts = Counter(normalize(item.get('priority', 'unknown')) for item in items)

    # Category breakdown
    category_counts = Counter(normalize(item.get('category', 'unknown')) for item in items)

    # Open items (not completed/obsolete)
    closed_statuses = {'completed', 'obsolete'}
    open_items = [i for i in items if normalize(i.get('status', '')) not in closed_statuses]
    open_count = len(open_items)

    # Priority breakdown for OPEN items only
    open_by_priority = Counter(normalize(item.get('priority', 'unknown')) for item in open_items)

    # Category breakdown for OPEN items only
    open_by_category = Counter(normalize(item.get('category', 'unknown')) for item in open_items)

    # Effort analysis (estimated tokens)
    items_with_estimates = [i for i in open_items if i.get('est_tokens', '-') != '-']
    items_without_estimates = [i for i in open_items if i.get('est_tokens', '-') == '-']

    total_estimated_tokens = sum(parse_tokens(i.get('est_tokens', '0')) for i in items_with_estimates)

    # Effort buckets
    effort_buckets = {'small (<20K)': 0, 'medium (20-50K)': 0, 'large (50-100K)': 0, 'xlarge (>100K)': 0}
    for item in items_with_estimates:
        tokens = parse_tokens(item.get('est_tokens', '0'))
        if tokens < 20000:
            effort_buckets['small (<20K)'] += 1
        elif tokens < 50000:
            effort_buckets['medium (20-50K)'] += 1
        elif tokens < 100000:
            effort_buckets['large (50-100K)'] += 1
        else:
            effort_buckets['xlarge (>100K)'] += 1

    # Sprint analysis
    sprint_status_counts = Counter(normalize(s.get('status', 'unknown')) for s in sprints)
    active_sprints = [s for s in sprints if normalize(s.get('status', '')) in ('active', 'planning')]

    # Items assigned to sprints
    items_in_sprints = [i for i in open_items if i.get('sprint', '-') != '-']
    items_unassigned = [i for i in open_items if i.get('sprint', '-') == '-']

    # High priority unassigned (attention needed)
    high_priority_unassigned = [
        i for i in items_unassigned
        if normalize(i.get('priority', '')) in ('critical', 'high')
    ]

    # Blocked items
    blocked_items = [i for i in items if normalize(i.get('status', '')) == 'blocked']

    # Testing items (awaiting verification)
    testing_items = [i for i in items if normalize(i.get('status', '')) == 'testing']

    # Reopened items (failed testing)
    reopened_items = [i for i in items if normalize(i.get('status', '')) == 'reopened']

    # Recently completed (from changelog)
    recent_completions = [
        c for c in changelog
        if c.get('action', '').lower() in ('complete', 'merge')
    ][-10:]  # Last 10

    # Velocity estimate (if we have actual tokens)
    items_with_actuals = [i for i in items if i.get('actual_tokens', '-') != '-']
    total_actual_tokens = sum(parse_tokens(i.get('actual_tokens', '0')) for i in items_with_actuals)

    return {
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_items': total,
            'open_items': open_count,
            'completed_items': status_counts.get('completed', 0),
            'obsolete_items': status_counts.get('obsolete', 0),
        },
        'status_breakdown': dict(status_counts),
        'priority_breakdown': {
            'all': dict(priority_counts),
            'open_only': dict(open_by_priority),
        },
        'category_breakdown': {
            'all': dict(category_counts),
            'open_only': dict(open_by_category),
        },
        'effort_analysis': {
            'items_with_estimates': len(items_with_estimates),
            'items_without_estimates': len(items_without_estimates),
            'total_estimated_tokens': total_estimated_tokens,
            'total_estimated_tokens_formatted': f"{total_estimated_tokens/1000:.0f}K",
            'effort_buckets': effort_buckets,
        },
        'sprint_health': {
            'total_sprints': len(sprints),
            'sprint_statuses': dict(sprint_status_counts),
            'active_sprints': [s['sprint_id'] for s in active_sprints],
            'items_in_sprints': len(items_in_sprints),
            'items_unassigned': len(items_unassigned),
        },
        'attention_needed': {
            'high_priority_unassigned': [
                {'id': i['id'], 'title': i['title'][:60], 'priority': i['priority']}
                for i in high_priority_unassigned[:10]
            ],
            'high_priority_unassigned_count': len(high_priority_unassigned),
            'blocked_items': [
                {'id': i['id'], 'title': i['title'][:60]}
                for i in blocked_items
            ],
            'testing_items': [
                {'id': i['id'], 'title': i['title'][:60]}
                for i in testing_items
            ],
            'reopened_items': [
                {'id': i['id'], 'title': i['title'][:60]}
                for i in reopened_items
            ],
        },
        'velocity': {
            'items_with_actuals': len(items_with_actuals),
            'total_actual_tokens': total_actual_tokens,
            'total_actual_tokens_formatted': f"{total_actual_tokens/1000:.0f}K" if total_actual_tokens else "N/A",
        },
        'recent_activity': {
            'recent_completions': [
                {'date': c.get('date', ''), 'details': c.get('details', '')[:60]}
                for c in recent_completions
            ],
        },
    }


def print_report(analysis: dict):
    """Print formatted report."""
    print("=" * 70)
    print("BACKLOG ANALYSIS REPORT")
    print(f"Generated: {analysis['generated_at']}")
    print("=" * 70)
    print()

    # Summary
    s = analysis['summary']
    print("## SUMMARY")
    print(f"  Total Items:     {s['total_items']}")
    print(f"  Open Items:      {s['open_items']}")
    print(f"  Completed:       {s['completed_items']}")
    print(f"  Obsolete:        {s['obsolete_items']}")
    print()

    # Status breakdown
    print("## STATUS BREAKDOWN")
    for status, count in sorted(analysis['status_breakdown'].items(), key=lambda x: -x[1]):
        pct = count / s['total_items'] * 100
        bar = "█" * int(pct / 5)
        print(f"  {status:15} {count:4} ({pct:5.1f}%) {bar}")
    print()

    # Priority breakdown (open only)
    print("## PRIORITY BREAKDOWN (Open Items Only)")
    priority_order = ['critical', 'high', 'medium', 'low']
    open_priority = analysis['priority_breakdown']['open_only']
    for priority in priority_order:
        count = open_priority.get(priority, 0)
        if count:
            pct = count / s['open_items'] * 100
            bar = "█" * int(pct / 5)
            print(f"  {priority:15} {count:4} ({pct:5.1f}%) {bar}")
    print()

    # Category breakdown (open only, top 10)
    print("## CATEGORY BREAKDOWN (Open Items, Top 10)")
    open_category = analysis['category_breakdown']['open_only']
    for category, count in sorted(open_category.items(), key=lambda x: -x[1])[:10]:
        pct = count / s['open_items'] * 100
        print(f"  {category:15} {count:4} ({pct:5.1f}%)")
    print()

    # Effort analysis
    e = analysis['effort_analysis']
    print("## EFFORT ANALYSIS")
    print(f"  Items with estimates:    {e['items_with_estimates']}")
    print(f"  Items without estimates: {e['items_without_estimates']}")
    print(f"  Total estimated effort:  {e['total_estimated_tokens_formatted']} tokens")
    print()
    print("  Effort Distribution:")
    for bucket, count in e['effort_buckets'].items():
        if count:
            print(f"    {bucket:20} {count:4}")
    print()

    # Sprint health
    sp = analysis['sprint_health']
    print("## SPRINT HEALTH")
    print(f"  Total Sprints:      {sp['total_sprints']}")
    print(f"  Active Sprints:     {', '.join(sp['active_sprints']) or 'None'}")
    print(f"  Items in Sprints:   {sp['items_in_sprints']}")
    print(f"  Items Unassigned:   {sp['items_unassigned']}")
    print()

    # Attention needed
    att = analysis['attention_needed']
    print("## ATTENTION NEEDED")
    print()

    if att['high_priority_unassigned']:
        print(f"  High Priority Unassigned ({att['high_priority_unassigned_count']} total):")
        for item in att['high_priority_unassigned'][:5]:
            print(f"    [{item['priority']:8}] {item['id']}: {item['title']}")
        if att['high_priority_unassigned_count'] > 5:
            print(f"    ... and {att['high_priority_unassigned_count'] - 5} more")
        print()

    if att['blocked_items']:
        print(f"  Blocked Items ({len(att['blocked_items'])}):")
        for item in att['blocked_items']:
            print(f"    {item['id']}: {item['title']}")
        print()

    if att['testing_items']:
        print(f"  Awaiting User Verification ({len(att['testing_items'])}):")
        for item in att['testing_items']:
            print(f"    {item['id']}: {item['title']}")
        print()

    if att['reopened_items']:
        print(f"  Reopened (Failed Testing) ({len(att['reopened_items'])}):")
        for item in att['reopened_items']:
            print(f"    {item['id']}: {item['title']}")
        print()

    # Velocity
    v = analysis['velocity']
    if v['items_with_actuals']:
        print("## VELOCITY")
        print(f"  Completed with tracking: {v['items_with_actuals']} items")
        print(f"  Total actual tokens:     {v['total_actual_tokens_formatted']}")
        print()

    print("=" * 70)
    print("END OF REPORT")
    print("=" * 70)


def print_summary(analysis: dict):
    """Print quick summary only."""
    s = analysis['summary']
    att = analysis['attention_needed']
    sp = analysis['sprint_health']

    print(f"Backlog: {s['open_items']} open ({s['completed_items']} completed)")
    print(f"Priority: {analysis['priority_breakdown']['open_only'].get('critical', 0)} critical, "
          f"{analysis['priority_breakdown']['open_only'].get('high', 0)} high")
    print(f"Sprints: {', '.join(sp['active_sprints']) or 'None active'}")

    if att['high_priority_unassigned_count']:
        print(f"⚠️  {att['high_priority_unassigned_count']} high-priority items unassigned")
    if att['blocked_items']:
        print(f"⚠️  {len(att['blocked_items'])} blocked items")
    if att['reopened_items']:
        print(f"⚠️  {len(att['reopened_items'])} reopened items need attention")


def main():
    parser = argparse.ArgumentParser(description='Generate backlog analysis report')
    parser.add_argument('--summary', action='store_true', help='Quick summary only')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    args = parser.parse_args()

    analysis = analyze_backlog()

    if args.json:
        print(json.dumps(analysis, indent=2))
    elif args.summary:
        print_summary(analysis)
    else:
        print_report(analysis)


if __name__ == '__main__':
    main()
