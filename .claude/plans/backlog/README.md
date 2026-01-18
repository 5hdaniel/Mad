# Backlog Management System

This directory contains the project backlog in a queryable CSV-based format.

## Quick Start

### Find open high-priority items
```bash
python scripts/queries.py priority high --status pending
```

### Get sprint items
```bash
python scripts/queries.py sprint SPRINT-042
```

### Validate data integrity
```bash
python scripts/validate.py
```

---

## Directory Structure

```
backlog/
├── README.md              # This file
├── INDEX-archive.md       # Archived original INDEX.md (read-only reference)
├── data/
│   ├── backlog.csv        # Main backlog table (source of truth)
│   ├── sprints.csv        # Sprint history
│   ├── changelog.csv      # Change audit trail
│   └── SCHEMA.md          # Column definitions and valid values
├── scripts/
│   ├── queries.py         # Query interface
│   └── validate.py        # Schema validation
└── items/                 # Individual BACKLOG-XXX.md detail files
```

---

## Status Flow

```
pending → in-progress → testing → completed
                           ↓
                       reopened → in-progress → ...
```

**CRITICAL:** Code merged = `testing`. Only mark `completed` after user verifies.

| Status | Description |
|--------|-------------|
| `pending` | Not started, in backlog |
| `in-progress` | Currently being worked on |
| `testing` | Code merged, awaiting user verification |
| `completed` | Done AND verified by user |
| `blocked` | Waiting on external dependency |
| `deferred` | Postponed to future sprint |
| `obsolete` | No longer relevant |
| `reopened` | Failed user testing, needs more work |

---

## Priority Levels

| Priority | When to Use |
|----------|-------------|
| `critical` | Security issues, data loss, blocking bugs |
| `high` | Important features, significant bugs |
| `medium` | Normal priority work |
| `low` | Nice-to-have, polish items |

---

## Working with the Backlog

### Adding a New Item

1. Create `items/BACKLOG-XXX.md` with item details
2. Add row to `data/backlog.csv`
3. Run `python scripts/validate.py` to verify
4. Commit both files

### Updating Status

1. Edit `data/backlog.csv` to change status
2. Optionally add entry to `data/changelog.csv`
3. Run validation
4. Commit

### Querying

See `scripts/queries.py --help` for all options, or use the skill:
```
.claude/skills/backlog-management/csv-reference.md
```

---

## For Agents

Use pandas or stdlib csv to query backlog.csv directly:

```python
import csv

def get_open_items():
    with open('.claude/plans/backlog/data/backlog.csv') as f:
        return [r for r in csv.DictReader(f) if r['status'] == 'pending']
```

This is more token-efficient than reading the full INDEX-archive.md.

---

## Related Documentation

- **Schema**: `data/SCHEMA.md` - Column definitions
- **Skill**: `.claude/skills/backlog-management/SKILL.md` - Agent workflows
- **Sprints**: `.claude/plans/sprints/` - Sprint plan files
