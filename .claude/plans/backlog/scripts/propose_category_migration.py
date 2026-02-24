#!/usr/bin/env python3
"""
Propose Category Migration: category → type + area

Generates a review CSV where each backlog item gets a proposed `type` and `area`
based on its current `category` and `title`. A human reviews and corrects before
the migration is applied.

Usage:
    python propose_category_migration.py                     # Generate review CSV
    python propose_category_migration.py --apply review.csv  # Apply reviewed CSV

Type values:  bug, feature, chore, refactor, test, docs
Area values:  ui, electron, infra, service, security, schema, ipc
"""

import argparse
import csv
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
BACKLOG_FILE = DATA_DIR / 'backlog.csv'

VALID_TYPES = {'bug', 'feature', 'chore', 'refactor', 'test', 'docs'}
VALID_AREAS = {'ui', 'electron', 'infra', 'service', 'security', 'schema', 'ipc'}

# Map old category → proposed type
CATEGORY_TO_TYPE = {
    'bug': 'bug',
    'bugfix': 'bug',
    'bug fix': 'bug',
    'fix': 'bug',
    'ux-bug': 'bug',
    'feature': 'feature',
    'enhancement': 'feature',
    'refactor': 'refactor',
    'refactoring': 'refactor',
    'tech-debt': 'refactor',
    'technical debt': 'refactor',
    'cleanup': 'chore',
    'config': 'chore',
    'test': 'test',
    'testing': 'test',
    'qa': 'test',
    'docs': 'docs',
    'infra': 'chore',
    'infrastructure': 'chore',
    'security': 'bug',
    'schema': 'chore',
    'service': 'feature',
    'ui': 'feature',
    'ux': 'feature',
    'ux redesign': 'feature',
    'performance': 'refactor',
    'optimization': 'refactor',
    'architecture': 'refactor',
    'auth': 'feature',
    'data': 'chore',
    'data integrity': 'bug',
    'type-safety': 'refactor',
}

# Map old category → proposed area (high confidence)
CATEGORY_TO_AREA = {
    'ui': 'ui',
    'ux': 'ui',
    'ux redesign': 'ui',
    'ux-bug': 'ui',
    'infra': 'infra',
    'infrastructure': 'infra',
    'config': 'infra',
    'security': 'security',
    'schema': 'schema',
    'ipc': 'ipc',
    'auth': 'service',
}

# Title keywords → area (used when category doesn't map to area)
TITLE_AREA_PATTERNS = [
    (r'\b(electron|main process|preload|native|sqlite|ipc|better-sqlite)\b', 'electron'),
    (r'\b(ui|button|modal|dialog|screen|page|component|css|style|layout|theme|dark mode|responsive)\b', 'ui'),
    (r'\b(ci|cd|pipeline|build|deploy|vercel|github action|eslint|lint|jest|coverage|webpack|vite)\b', 'infra'),
    (r'\b(security|auth|encrypt|token|session|jwt|oauth|safeStorage|keychain|credential)\b', 'security'),
    (r'\b(schema|migration|table|column|index|database|db|supabase|rls|row level)\b', 'schema'),
    (r'\b(ipc|handler|bridge|preload|channel)\b', 'ipc'),
    (r'\b(api|service|sync|graph|gmail|import|export|contact|email|message|attachment)\b', 'service'),
]


def propose_type(category: str, title: str) -> tuple[str, str]:
    """Propose a type based on category and title. Returns (type, confidence)."""
    cat = category.strip().lower()

    # Direct category mapping
    if cat in CATEGORY_TO_TYPE:
        return CATEGORY_TO_TYPE[cat], 'high'

    # Fallback: guess from title
    title_lower = title.lower()
    if any(w in title_lower for w in ['fix', 'bug', 'broken', 'crash', 'error', 'fail']):
        return 'bug', 'medium'
    if any(w in title_lower for w in ['add', 'new', 'create', 'implement', 'support']):
        return 'feature', 'medium'
    if any(w in title_lower for w in ['refactor', 'extract', 'move', 'rename', 'split', 'consolidate']):
        return 'refactor', 'medium'
    if any(w in title_lower for w in ['test', 'coverage', 'spec']):
        return 'test', 'medium'
    if any(w in title_lower for w in ['doc', 'readme', 'comment']):
        return 'docs', 'medium'

    return 'chore', 'low'


def propose_area(category: str, title: str) -> tuple[str, str]:
    """Propose an area based on category and title. Returns (area, confidence)."""
    cat = category.strip().lower()

    # Direct category mapping
    if cat in CATEGORY_TO_AREA:
        return CATEGORY_TO_AREA[cat], 'high'

    # Title keyword matching
    title_lower = title.lower()
    for pattern, area in TITLE_AREA_PATTERNS:
        if re.search(pattern, title_lower, re.IGNORECASE):
            return area, 'medium'

    # Fallback based on category
    if cat in ('service', 'auth', 'data', 'data integrity'):
        return 'service', 'medium'
    if cat in ('bug', 'bugfix', 'bug fix', 'fix'):
        # Bugs could be anywhere — need human review
        return 'service', 'low'
    if cat in ('feature', 'enhancement'):
        return 'service', 'low'
    if cat in ('refactor', 'refactoring', 'tech-debt', 'technical debt', 'cleanup',
               'performance', 'optimization', 'architecture', 'type-safety'):
        return 'service', 'low'

    return 'service', 'low'


def generate_review_csv(output_path: Path):
    """Generate a review CSV with proposed type and area for each item."""
    with open(BACKLOG_FILE, newline='', encoding='utf-8') as f:
        items = list(csv.DictReader(f))

    rows = []
    stats = {'high': 0, 'medium': 0, 'low': 0}

    for item in items:
        item_id = item.get('id', '')
        title = item.get('title', '')
        old_category = item.get('category', '')
        status = item.get('status', '')

        proposed_type, type_conf = propose_type(old_category, title)
        proposed_area, area_conf = propose_area(old_category, title)

        # Overall confidence = min of both
        conf_order = {'high': 2, 'medium': 1, 'low': 0}
        overall_conf = 'high' if min(conf_order[type_conf], conf_order[area_conf]) == 2 else \
                        'medium' if min(conf_order[type_conf], conf_order[area_conf]) == 1 else 'low'
        stats[overall_conf] += 1

        rows.append({
            'id': item_id,
            'title': title,
            'status': status,
            'old_category': old_category,
            'proposed_type': proposed_type,
            'proposed_area': proposed_area,
            'confidence': overall_conf,
            'final_type': '',  # Human fills this in (leave blank = accept proposal)
            'final_area': '',  # Human fills this in (leave blank = accept proposal)
            'notes': '',
        })

    # Sort: low confidence first so reviewer sees those first
    conf_sort = {'low': 0, 'medium': 1, 'high': 2}
    rows.sort(key=lambda r: (conf_sort[r['confidence']], r['id']))

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'id', 'title', 'status', 'old_category',
            'proposed_type', 'proposed_area', 'confidence',
            'final_type', 'final_area', 'notes'
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Review CSV generated: {output_path}")
    print(f"Total items: {len(rows)}")
    print(f"  High confidence:   {stats['high']}")
    print(f"  Medium confidence:  {stats['medium']}")
    print(f"  Low confidence:     {stats['low']}")
    print()
    print("Next steps:")
    print("  1. Open the CSV in a spreadsheet")
    print("  2. Review items sorted by confidence (low first)")
    print("  3. Fill in 'final_type' and 'final_area' where you disagree with proposals")
    print("  4. Leave blank to accept the proposed values")
    print(f"  5. Run: python {Path(__file__).name} --apply {output_path}")


def apply_review(review_path: Path):
    """Apply a reviewed CSV back to the backlog."""
    # Load review
    with open(review_path, newline='', encoding='utf-8') as f:
        reviews = {r['id']: r for r in csv.DictReader(f)}

    # Load backlog
    with open(BACKLOG_FILE, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        items = list(reader)

    # Check if type/area columns already exist
    if 'type' not in fieldnames or 'area' not in fieldnames:
        # Insert type and area after category (position 2), remove category
        cat_idx = fieldnames.index('category')
        new_fieldnames = fieldnames[:cat_idx] + ['type', 'area'] + fieldnames[cat_idx + 1:]
    else:
        new_fieldnames = fieldnames

    # Remove 'category' from field list if still present
    if 'category' in new_fieldnames:
        new_fieldnames = [f for f in new_fieldnames if f != 'category']

    applied = 0
    errors = []

    for item in items:
        item_id = item['id']
        review = reviews.get(item_id)

        if not review:
            errors.append(f"  {item_id}: not found in review CSV — keeping old category as-is")
            # Fallback: keep old category value in type, area = service
            item['type'] = item.get('category', 'chore')
            item['area'] = 'service'
            continue

        # Use final values if provided, otherwise use proposed
        final_type = review['final_type'].strip() or review['proposed_type'].strip()
        final_area = review['final_area'].strip() or review['proposed_area'].strip()

        # Validate
        if final_type not in VALID_TYPES:
            errors.append(f"  {item_id}: invalid type '{final_type}' — must be one of {VALID_TYPES}")
            continue
        if final_area not in VALID_AREAS:
            errors.append(f"  {item_id}: invalid area '{final_area}' — must be one of {VALID_AREAS}")
            continue

        item['type'] = final_type
        item['area'] = final_area
        applied += 1

    if errors:
        print("Errors found:")
        for e in errors:
            print(e)
        print()

    # Write updated backlog
    with open(BACKLOG_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=new_fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(items)

    print(f"Migration applied: {applied}/{len(items)} items updated")
    print(f"Column 'category' replaced with 'type' + 'area' in {BACKLOG_FILE}")
    print()
    print("Next steps:")
    print("  1. Update SCHEMA.md with new column definitions")
    print("  2. Update validate.py to check type/area instead of category")
    print("  3. Update queries.py if it filters by category")
    print("  4. Update generate_dashboard.py charts/filters")
    print("  5. Run: python validate.py to verify")


def main():
    parser = argparse.ArgumentParser(
        description='Propose or apply category → type + area migration'
    )
    parser.add_argument('--apply', type=str, default=None,
                        help='Apply a reviewed migration CSV back to backlog')
    parser.add_argument('--output', '-o', type=str, default=None,
                        help='Output file for review CSV (default: category-migration-review.csv)')
    args = parser.parse_args()

    if args.apply:
        apply_review(Path(args.apply))
    else:
        output = Path(args.output) if args.output else Path.cwd() / 'category-migration-review.csv'
        generate_review_csv(output)


if __name__ == '__main__':
    main()
