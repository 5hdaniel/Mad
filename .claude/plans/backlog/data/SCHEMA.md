# Backlog Data Schema

This document defines the schema for all CSV files in the backlog data system.

## backlog.csv

The main backlog table. Source of truth for all items.

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | string | Yes | Unique identifier (BACKLOG-XXX) |
| `title` | string | Yes | Brief description of the item |
| `type` | enum | Yes | Kind of work (see valid values below) |
| `area` | enum | Yes | System area affected (see valid values below) |
| `priority` | enum | Yes | Importance level |
| `status` | enum | Yes | Current state |
| `sprint` | string | No | Sprint assignment (SPRINT-XXX or -) |
| `est_tokens` | string | No | Estimated tokens (e.g., "~30K") |
| `actual_tokens` | string | No | Actual tokens used |
| `variance` | string | No | Percentage difference from estimate |
| `created_at` | date | No | Date item was created (YYYY-MM-DD) |
| `completed_at` | date | No | Date item was completed (YYYY-MM-DD) |
| `file` | string | No | Link to detail file (BACKLOG-XXX.md) |
| `description` | string | No | Short description (fallback when no .md file) |

### Valid Values

**type:**
- `bug` - Something broken that needs fixing
- `feature` - New functionality or enhancement to existing feature
- `chore` - Maintenance, config, cleanup, infrastructure work
- `refactor` - Code restructuring without behavior change
- `test` - Testing improvements
- `docs` - Documentation

**area:**
- `ui` - User interface, components, styling, UX
- `electron` - Main process, preload, native modules, desktop-specific
- `infra` - CI/CD, build, deploy, tooling, config
- `service` - Backend services, APIs, sync, data processing
- `security` - Auth, encryption, tokens, permissions
- `schema` - Database schema, migrations, RLS
- `ipc` - IPC layer, handler bridges between main/renderer

**priority:**
- `critical` - Must be done immediately
- `high` - Important, do soon
- `medium` - Normal priority
- `low` - Nice to have

**status:**
- `pending` - Not started
- `in-progress` - Currently being worked on
- `testing` - Code merged, awaiting user verification
- `completed` - Done AND verified by user
- `blocked` - Waiting on something
- `deferred` - Postponed
- `obsolete` - No longer relevant
- `reopened` - Failed testing, needs more work

---

## sprints.csv

Sprint history and status tracking.

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `sprint_id` | string | Yes | Sprint identifier (SPRINT-XXX) |
| `name` | string | Yes | Sprint name |
| `status` | enum | Yes | Sprint state |
| `items_completed` | string | No | Summary of completed items |

### Valid Values

**status:**
- `planning` - Being planned
- `active` - Currently in progress
- `complete` - Finished
- `deprecated` - Cancelled/replaced

---

## changelog.csv

Audit trail of key changes.

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `date` | date | Yes | Date of change (YYYY-MM-DD) |
| `action` | enum | Yes | Type of change |
| `details` | string | Yes | Description of what changed |
| `items_affected` | string | No | Semicolon-separated BACKLOG-XXX IDs |

### Valid Values

**action:**
- `create` - New item created
- `complete` - Item completed
- `status_change` - Status updated
- `assign` - Assigned to sprint
- `merge` - PR merged
- `incident` - Problem occurred
- `lesson` - Lesson learned documented
- `update` - General update

---

## Relationships

```
backlog.csv
    └── file → items/BACKLOG-XXX.md (1:1)
    └── sprint → sprints.csv.sprint_id (N:1)

changelog.csv
    └── items_affected → backlog.csv.id (N:M)
```

---

## Usage Examples

### Python (stdlib csv)
```python
import csv

with open('.claude/plans/backlog/data/backlog.csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row['priority'] == 'critical' and row['status'] == 'pending':
            print(f"{row['id']}: {row['title']}")
```

### Bash (grep)
```bash
# Find all high priority pending items
grep ",high,pending," .claude/plans/backlog/data/backlog.csv

# Count items by status (column 6)
cut -d',' -f6 .claude/plans/backlog/data/backlog.csv | sort | uniq -c
```
