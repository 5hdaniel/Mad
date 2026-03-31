# Add Backlog Item Workflow

## Source of Truth

**Supabase `pm_backlog_items` table is the ONLY source of truth.** Do NOT write to CSV files.

---

## Steps

### 1. Check for Duplicates

```sql
SELECT item_number, title, status FROM pm_backlog_items
WHERE title ILIKE '%keyword%' OR title ILIKE '%other keyword%';
```

### 2. Create the Item

Use the Supabase MCP `execute_sql` tool:

```sql
INSERT INTO pm_backlog_items (item_number, title, type, area, priority, status, description)
VALUES (
  (SELECT MAX(item_number) + 1 FROM pm_backlog_items),
  'Title Here',
  'feature',        -- feature/bug/refactor/chore/test/spike/epic
  'admin-portal',   -- area tag
  'medium',         -- critical/high/medium/low
  'pending',
  'Description of the item and acceptance criteria.'
);
```

### 3. Assign to Sprint (Optional)

```sql
UPDATE pm_backlog_items
SET sprint_id = '<sprint-uuid>'
WHERE item_number = <number>;
```

### 4. Link Related Items (Optional)

```sql
INSERT INTO pm_task_links (source_id, target_id, link_type)
VALUES ('<new-item-uuid>', '<related-item-uuid>', 'related_to');
```

---

## Valid Values

| Column | Valid Values |
|--------|-------------|
| type | feature, bug, refactor, chore, test, spike, epic |
| priority | critical, high, medium, low |
| status | pending, in_progress, testing, completed, blocked, deferred, obsolete, reopened |
| link_type | related_to, blocks, depends_on, duplicates |
