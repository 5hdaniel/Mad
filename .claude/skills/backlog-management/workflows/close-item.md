# Close Backlog Item Workflow

## Source of Truth

**Supabase `pm_backlog_items` table is the ONLY source of truth.** Do NOT write to CSV files.

---

## IMPORTANT: Status Flow

```
pending → in_progress → testing → completed
                          ↓
                      reopened → in_progress → testing → ...
```

**CRITICAL RULES:**
1. **NEVER mark "completed" until user has tested**
2. **NEVER create a new task for failed testing** — reopen the original
3. **Code merged = "testing"**, not "completed"

---

## Steps

### 1. After PR Merged (→ testing)

```sql
UPDATE pm_backlog_items
SET status = 'testing'
WHERE item_number = <number>;
```

### 2. After User Testing

**If user confirms it works:**
```sql
UPDATE pm_backlog_items
SET status = 'completed', completed_at = now()
WHERE item_number = <number>;
```

**If user finds issues (DO NOT create new task!):**
```sql
UPDATE pm_backlog_items
SET status = 'reopened'
WHERE item_number = <number>;
```

Then work on the SAME item again until it passes testing.

### 3. For Obsolete Items

```sql
UPDATE pm_backlog_items
SET status = 'obsolete', description = COALESCE(description, '') || ' — Reason: <why>'
WHERE item_number = <number>;
```

---

## Status Transitions

| From | To | When |
|------|----|------|
| pending | in_progress | Work started |
| pending | deferred | Postponed |
| pending | obsolete | No longer needed |
| in_progress | testing | PR merged |
| testing | completed | User verified |
| testing | reopened | User found issues |
| in_progress | blocked | Waiting on dependency |
| blocked | in_progress | Dependency resolved |
| deferred | pending | Ready to work |
