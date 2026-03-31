# Backlog Management System

## Source of Truth

**Supabase `pm_backlog_items` table is the ONLY source of truth.**

All backlog operations (create, update, query) MUST use Supabase via MCP `execute_sql`. The CSV files in `data/` are a **legacy archive** frozen at ~BACKLOG-967 and must NOT be modified.

---

## How to Query

Use the Supabase MCP tool:

```sql
-- Find open high-priority items
SELECT item_number, title, priority, area
FROM pm_backlog_items
WHERE status = 'pending' AND priority IN ('critical', 'high')
ORDER BY item_number;

-- Get sprint items
SELECT item_number, title, status
FROM pm_backlog_items
WHERE sprint_id = '<sprint-uuid>';

-- Search by keyword
SELECT item_number, title, status
FROM pm_backlog_items
WHERE title ILIKE '%keyword%';
```

---

## Status Flow

```
pending → in_progress → testing → completed
                          ↓
                      reopened → in_progress → ...
```

**CRITICAL:** Code merged = `testing`. Only mark `completed` after user verifies.

---

## Directory Structure (Legacy Archive)

```
backlog/
├── README.md              # This file
├── data/
│   ├── backlog.csv        # LEGACY ARCHIVE — do NOT modify
│   ├── sprints.csv        # LEGACY ARCHIVE — do NOT modify
│   ├── changelog.csv      # LEGACY ARCHIVE — do NOT modify
│   └── SCHEMA.md          # Column definitions (legacy reference)
├── scripts/               # Legacy scripts (read CSV, not Supabase)
└── items/                 # Legacy BACKLOG-XXX.md detail files
```

---

## Related Documentation

- **Skill**: `.claude/skills/backlog-management/SKILL.md` — Agent workflows
- **Query Reference**: `.claude/skills/backlog-management/csv-reference.md` — Supabase query patterns
- **PM Module UI**: `admin.keeprcompliance.com/dashboard/pm/backlog` — Web UI
