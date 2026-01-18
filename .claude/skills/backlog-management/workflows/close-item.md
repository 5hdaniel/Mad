# Close Backlog Item Workflow

## When to Use

Use this workflow when:
- A backlog item has been completed
- An item is no longer relevant (obsolete)
- An item needs to be reopened

---

## Steps

### 1. Verify Completion

Before marking complete:
- [ ] PR is merged
- [ ] Tests pass
- [ ] No known regressions
- [ ] User has validated (if applicable)

### 2. Update CSV Status

Edit `.claude/plans/backlog/data/backlog.csv`:

**For completed items:**
```csv
# Change status column from 'pending' to 'completed'
# Add actual_tokens and variance if tracked
BACKLOG-XXX,Title,category,priority,completed,SPRINT-XXX,~30K,28K,-7%,[BACKLOG-XXX.md]
```

**For obsolete items:**
```csv
BACKLOG-XXX,Title,category,priority,obsolete,-,-,-,-,[BACKLOG-XXX.md]
```

**For reopened items:**
```csv
BACKLOG-XXX,Title,category,priority,reopened,-,-,-,-,[BACKLOG-XXX.md]
```

### 3. Update Detail File (Optional)

Add completion notes to the BACKLOG-XXX.md file:

```markdown
## Completion Notes
- Completed in SPRINT-XXX
- PR #YYY
- Actual effort: 28K tokens
```

### 4. Log Change

Add to changelog.csv:

```csv
2026-01-17,complete,Completed BACKLOG-XXX via PR #YYY,BACKLOG-XXX
```

For reopened items:
```csv
2026-01-17,status_change,Reopened BACKLOG-XXX: reason here,BACKLOG-XXX
```

### 5. Validate

```bash
python .claude/plans/backlog/scripts/validate.py
```

---

## Bulk Close

When completing multiple items in a sprint:

```python
import csv

# Items to close
completed = ['BACKLOG-220', 'BACKLOG-221', 'BACKLOG-222']
sprint = 'SPRINT-042'

# Read, update, write
with open('.claude/plans/backlog/data/backlog.csv') as f:
    rows = list(csv.DictReader(f))

for row in rows:
    if row['id'] in completed:
        row['status'] = 'completed'
        row['sprint'] = sprint

# Write back
with open('.claude/plans/backlog/data/backlog.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
```

---

## Status Transitions

| From | To | When |
|------|----|------|
| pending | in-progress | Work started |
| pending | deferred | Postponed |
| pending | obsolete | No longer needed |
| in-progress | completed | Work done |
| in-progress | blocked | Waiting on dependency |
| completed | reopened | Bug found or incomplete |
| blocked | in-progress | Dependency resolved |
| deferred | pending | Ready to work |
