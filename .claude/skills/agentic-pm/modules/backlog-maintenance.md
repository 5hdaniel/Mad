# Backlog Maintenance Module

This module covers backlog cleanup, task archiving, and housekeeping procedures.

---

## Task Archiving

### When to Archive

Archive tasks when:
- A sprint is fully completed and merged
- All tasks in the sprint have status "Completed"
- The sprint retrospective (if any) is complete

### Archive Structure

```
.claude/plans/tasks/
  archive/
    SPRINT-001/
      TASK-101-*.md
      TASK-102-*.md
      ...
    SPRINT-002/
      ...
  TASK-600-*.md  (current sprint - active)
  TASK-601-*.md
  ...
```

### Archive Procedure

1. **Identify completed sprints**
   ```bash
   # Check sprint files for completion status
   ls .claude/plans/sprints/
   ```

2. **Create archive folder**
   ```bash
   mkdir -p .claude/plans/tasks/archive/SPRINT-XXX
   ```

3. **Move completed task files**
   ```bash
   # Move all tasks from that sprint
   mv .claude/plans/tasks/TASK-1XX-*.md .claude/plans/tasks/archive/SPRINT-001/
   ```

4. **Update INDEX.md**
   - Mark sprint as archived
   - Add archive location reference

### Task Number Ranges by Sprint

| Sprint | Task Range | Status |
|--------|------------|--------|
| SPRINT-001 | TASK-101 - TASK-116 | Archived |
| SPRINT-002 | TASK-201 - TASK-2XX | Archived |
| SPRINT-003 | TASK-301 - TASK-324 | Archived |
| SPRINT-004 | TASK-401 - TASK-414 | Archived |
| SPRINT-005 | TASK-501 - TASK-512 | Archived |
| SPRINT-006 | - | - |
| SPRINT-007 | - | - |
| SPRINT-008 | TASK-513 - TASK-521 | Archived |
| SPRINT-009 | TASK-600 - TASK-617 | Active |

---

## Backlog Cleanup

### Stale Item Detection

Items are considered stale if:
- No activity for 30+ days
- Blocked with no resolution path
- Superseded by other work

### Cleanup Actions

1. **Review stale items** - Determine if still relevant
2. **Update or close** - Refresh requirements or mark as won't-do
3. **Re-prioritize** - Move to appropriate sprint or backlog

---

## TODO Extraction

When reviewing code, extract inline TODOs to backlog:

```bash
# Find TODOs in codebase
grep -rn "TODO\|FIXME\|HACK" src/ electron/ --include="*.ts" --include="*.tsx"
```

For each significant TODO:
1. Create backlog item with reference to source location
2. Link to original TODO in code
3. Prioritize based on impact

---

## Integration with Sprint Lifecycle

| Sprint Phase | Maintenance Action |
|--------------|-------------------|
| Sprint Start | Clear old archive if >3 sprints old |
| Sprint End | Archive completed tasks |
| Retrospective | Update estimation accuracy data |

---

## Sprint Status Verification (MANDATORY)

**Problem:** Sprint files can become stale if not updated after PRs merge. This leads to incorrect status reports.

**Rule:** Before reporting sprint status, ALWAYS verify against GitHub PRs.

### Verification Procedure

```bash
# 1. Get task IDs from sprint file (e.g., TASK-700 to TASK-706)

# 2. Check actual PR status for those tasks
gh pr list --state all --limit 20 | grep -E "(700|701|702|703|704|705|706)"

# 3. If PRs are merged but sprint file shows "Pending", update the sprint file
```

### When to Verify

| Situation | Action |
|-----------|--------|
| User asks "where are we with sprint X?" | Verify against PRs first |
| Sprint file shows "Planning" or "Active" | Check if PRs are merged |
| Generating retrospective | Confirm all status matches PRs |

### Why This Matters

SPRINT-010 was fully merged on 2025-12-29 but sprint file still showed "Planning" on 2026-01-01. This led to incorrect status reports because the file was trusted without verification.

**Trust, but verify.** The source of truth is GitHub, not the markdown files.
