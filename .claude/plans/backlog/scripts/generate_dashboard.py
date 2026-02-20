#!/usr/bin/env python3
"""
Generate Interactive Backlog Dashboard

Creates an HTML dashboard with charts and filterable table.

Usage:
    python generate_dashboard.py                    # Generate dashboard.html
    python generate_dashboard.py --output report.html  # Custom output file
    python generate_dashboard.py --open             # Generate and open in browser
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data'
ITEMS_DIR = SCRIPT_DIR.parent / 'items'
TEMPLATE_FILE = SCRIPT_DIR.parent / 'dashboard.html'
BACKLOG_FILE = DATA_DIR / 'backlog.csv'


def extract_description(md_path: Path) -> str:
    """Extract a description from a markdown file, trying multiple heading patterns."""
    if not md_path.exists():
        return ''

    try:
        content = md_path.read_text(encoding='utf-8')
        # Try headings in priority order
        headings = ['Description', 'Summary', 'Problem Statement', 'Problem', 'Background', 'Overview']
        for heading in headings:
            match = re.search(
                rf'## {re.escape(heading)}\s*\n(.*?)(?=\n## |\Z)',
                content, re.DOTALL
            )
            if match:
                desc = match.group(1).strip()
                if desc:
                    if len(desc) > 500:
                        desc = desc[:500] + '...'
                    return desc
    except Exception:
        pass
    return ''


def load_backlog() -> list[dict]:
    """Load backlog data from CSV and enrich with descriptions."""
    with open(BACKLOG_FILE, newline='', encoding='utf-8') as f:
        items = list(csv.DictReader(f))

    # Add descriptions: prefer .md file, fall back to CSV description column
    for item in items:
        item_id = item.get('id', '')
        md_file = ITEMS_DIR / f'{item_id}.md'
        md_desc = extract_description(md_file)
        csv_desc = item.get('description', '').strip()
        item['description'] = md_desc or csv_desc

    return items


def generate_dashboard(output_path: Path):
    """Generate the dashboard HTML with injected data."""
    # Load backlog data
    backlog = load_backlog()

    # Convert to JSON
    backlog_json = json.dumps(backlog, indent=2)

    # Read template
    with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
        template = f.read()

    # Inject data
    html = template.replace('BACKLOG_DATA_PLACEHOLDER', backlog_json)

    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Dashboard generated: {output_path}")
    return output_path


def open_in_browser(path: Path):
    """Open the file in the default browser."""
    abs_path = path.resolve()

    if sys.platform == 'darwin':
        subprocess.run(['open', str(abs_path)])
    elif sys.platform == 'win32':
        os.startfile(str(abs_path))
    else:
        subprocess.run(['xdg-open', str(abs_path)])


def main():
    parser = argparse.ArgumentParser(description='Generate interactive backlog dashboard')
    parser.add_argument('--output', '-o', type=str, default=None,
                        help='Output file path (default: backlog-dashboard.html in current dir)')
    parser.add_argument('--open', action='store_true',
                        help='Open in browser after generating')
    args = parser.parse_args()

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = Path.cwd() / 'backlog-dashboard.html'

    # Generate dashboard
    generate_dashboard(output_path)

    # Open if requested
    if args.open:
        open_in_browser(output_path)
        print("Opened in browser")


if __name__ == '__main__':
    main()
