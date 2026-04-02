# Sprint Planning Workflow

## Source of Truth

**Supabase `pm_sprints` and `pm_backlog_items` tables are the ONLY source of truth.** Do NOT write to CSV files.

---

## Planning a New Sprint

### 1. Review Available Items

```sql
SELECT item_number, title, type, priority, area, est_tokens
FROM pm_backlog_items
WHERE status = 'pending'
ORDER BY
  CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
  created_at;
```

### 2. Create the Sprint

```sql
INSERT INTO pm_sprints (name, goal, status, start_date)
VALUES ('Sprint Name', 'Sprint goal description', 'planned', CURRENT_DATE)
RETURNING id, name;
```

### 3. Assign Items to Sprint

```sql
UPDATE pm_backlog_items
SET sprint_id = '<sprint-uuid>', status = 'pending'
WHERE item_number IN (<number1>, <number2>, <number3>);
```

---

## During Sprint

### Track Progress

```sql
SELECT item_number, title, status, priority
FROM pm_backlog_items
WHERE sprint_id = '<sprint-uuid>'
ORDER BY
  CASE status WHEN 'in_progress' THEN 0 WHEN 'testing' THEN 1 WHEN 'pending' THEN 2 WHEN 'completed' THEN 3 END;
```

### Update Status

```sql
UPDATE pm_backlog_items
SET status = 'in_progress'
WHERE item_number = <number>;
```

### Activate Sprint

```sql
UPDATE pm_sprints
SET status = 'active', start_date = CURRENT_DATE
WHERE id = '<sprint-uuid>';
```

---

## Closing a Sprint

### 1. Verify All Items

```sql
SELECT item_number, title, status
FROM pm_backlog_items
WHERE sprint_id = '<sprint-uuid>' AND status NOT IN ('completed', 'obsolete', 'deferred')
ORDER BY item_number;
```

### 2. Close Sprint

```sql
UPDATE pm_sprints
SET status = 'completed', end_date = CURRENT_DATE
WHERE id = '<sprint-uuid>';
```

---

## Sprint Velocity

```sql
SELECT s.name, s.status,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE i.status = 'completed') as completed,
  SUM(i.est_tokens) as est_total,
  SUM(i.actual_tokens) as actual_total
FROM pm_sprints s
JOIN pm_backlog_items i ON i.sprint_id = s.id
GROUP BY s.id, s.name, s.status
ORDER BY s.created_at DESC
LIMIT 10;
```

---

## Merge Safety Rules

1. **One feature per PR** — Don't bundle unrelated changes
2. **Tests before merge** — CI must pass
3. **No direct commits** — All work through branches
4. **Review required** — SR Engineer approval for significant PRs
