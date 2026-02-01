# Add Backlog Item Workflow

## When to Use

Use this workflow when adding a new feature request, bug report, or task to the backlog.

---

## Steps

### 1. Determine Next ID

```bash
# Find the highest existing ID
tail -1 .claude/plans/backlog/data/backlog.csv | cut -d',' -f1
```

Or use Python:
```python
import csv
with open('.claude/plans/backlog/data/backlog.csv') as f:
    items = list(csv.DictReader(f))
    last_id = int(items[-1]['id'].replace('BACKLOG-', ''))
    next_id = f"BACKLOG-{last_id + 1:03d}"
```

### 2. Create Detail File

Create `.claude/plans/backlog/items/BACKLOG-XXX.md`:

```markdown
# BACKLOG-XXX: Title Here

## Problem Statement
What issue does this address?

## Proposed Solution
How should it be solved?

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
Any implementation details or constraints.

## Dependencies
List any blocking items (BACKLOG-XXX).
```

### 3. Add CSV Row

Append to `.claude/plans/backlog/data/backlog.csv`:

```csv
BACKLOG-XXX,Title Here,category,priority,pending,-,~15K,-,-,2026-01-17,-,BACKLOG-XXX.md
```

**CRITICAL: Column Order Must Be Exact**

| Position | Column | Valid Values | Example |
|----------|--------|--------------|---------|
| 1 | id | BACKLOG-XXX | BACKLOG-579 |
| 2 | title | Brief description | Fix sync error |
| 3 | category | bug/feature/enhancement/refactor/tech-debt/test/docs/infra/security/schema/service/ui/ipc/config | enhancement |
| 4 | priority | critical/high/medium/low | high |
| 5 | status | pending/in-progress/testing/completed/blocked/deferred/obsolete/reopened | pending |
| 6 | sprint | SPRINT-XXX or - | SPRINT-067 |
| 7 | est_tokens | ~XK or - | ~15K |
| 8 | actual_tokens | Actual value or - | - |
| 9 | variance | Calculated or - | - |
| 10 | created_at | YYYY-MM-DD | 2026-01-17 |
| 11 | completed_at | YYYY-MM-DD or - | - |
| 12 | file | BACKLOG-XXX.md | BACKLOG-579.md |

> **Warning:** Getting columns out of order causes CI validation failures. The most common mistake is swapping category/priority/status. Always double-check position 3-5.

### 4. Validate

```bash
python .claude/plans/backlog/scripts/validate.py
```

### 5. Log Change (Optional)

For significant items, add to changelog.csv:

```csv
2026-01-17,create,Added BACKLOG-XXX: Title,BACKLOG-XXX
```

---

## Example

Adding a new sync feature:

```bash
# 1. Check last ID
echo "Last ID: $(tail -1 .claude/plans/backlog/data/backlog.csv | cut -d',' -f1)"

# 2. Create detail file
cat > .claude/plans/backlog/items/BACKLOG-303.md << 'EOF'
# BACKLOG-303: Add Retry Logic to Sync

## Problem Statement
Sync operations fail silently on network errors.

## Proposed Solution
Add exponential backoff retry with max 3 attempts.

## Acceptance Criteria
- [ ] Retry on transient network errors
- [ ] Exponential backoff (1s, 2s, 4s)
- [ ] Log retry attempts
- [ ] Surface permanent failures to UI
EOF

# 3. Add to CSV
echo 'BACKLOG-303,Add Retry Logic to Sync,feature,medium,pending,-,~15K,-,-,[BACKLOG-303.md]' >> .claude/plans/backlog/data/backlog.csv

# 4. Validate
python .claude/plans/backlog/scripts/validate.py
```
