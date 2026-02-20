# TASK-2006: Repo Hygiene Quick Wins

**Backlog IDs:** BACKLOG-724, BACKLOG-727, BACKLOG-731, BACKLOG-732
**Sprint:** SPRINT-087
**Phase:** Phase 1 - Code Cleanup
**Branch:** `chore/task-2006-repo-hygiene`
**Estimated Tokens:** ~2K

---

## Objective

Bundle four trivial hygiene fixes into a single task: delete an empty artifact file, fix backlog CSV casing, update .gitignore, and consolidate duplicate backlog items. Each is too small for its own task but together they remove several red flags visible in the repo root.

---

## Context

A due diligence assessment flagged these issues:
1. **electron/schema.sql** is a 0-byte file at the repo root of electron/. The real schema lives at `electron/database/schema.sql`. The empty file is confusing.
2. **backlog.csv** has 36 rows with lowercase status values (`pending`, `completed`, `testing`, `deferred`) and 1 with invalid status `Blocked`. The CI `Validate Backlog Data` check enforces title-case.
3. **mad.db** and **backlog-dashboard.html** appear as untracked files in the repo root. They are local artifacts that should be gitignored.
4. **~20 duplicate backlog items** around contacts and test coverage that could be consolidated.

---

## Requirements

### Must Do:

1. **Delete** `electron/schema.sql` (the 0-byte file). Verify `electron/database/schema.sql` still exists (do NOT delete that one).

2. **Fix backlog CSV casing.** In `.claude/plans/backlog/data/backlog.csv`:
   - Change all lowercase `pending` to `Pending`
   - Change all lowercase `completed` to `Completed`
   - Change all lowercase `testing` to `Testing`
   - Change all lowercase `deferred` to `Deferred`
   - Change `Blocked` to `Deferred` (Blocked is not a valid status; valid: Pending, In Progress, Testing, Completed, Deferred, Obsolete)

3. **Add to `.gitignore`** (at the end, with a comment section):
   ```
   # Local database and generated artifacts
   mad.db
   backlog-dashboard.html
   ```

4. **Consolidate duplicate backlog items.** Review and mark as `Obsolete` any items that are clearly duplicates of other items. Add a note in the variance/notes column pointing to the surviving item. Focus on:
   - Contact-related duplicates: BACKLOG-143, 145, 165 (duplicate contacts)
   - Contact UX duplicates: BACKLOG-418, 463
   - Test coverage items that overlap with BACKLOG-273

   Do NOT delete rows from the CSV. Mark duplicates as `Obsolete` with a note like: `Duplicate of BACKLOG-XXX`

### Must NOT Do:
- Do NOT delete `electron/database/schema.sql` (the real one)
- Do NOT modify any code files (this is data/config only)
- Do NOT change the structure or column order of backlog.csv
- Do NOT remove any backlog rows -- only change status to Obsolete
- Do NOT consolidate items where you are unsure -- when in doubt, leave them

---

## Acceptance Criteria

- [ ] `electron/schema.sql` does not exist
- [ ] `electron/database/schema.sql` still exists and is unchanged
- [ ] No lowercase status values remain in backlog.csv (grep -c ',pending,\|,completed,\|,testing,\|,deferred,' returns 0)
- [ ] No `Blocked` status in backlog.csv
- [ ] `mad.db` is in .gitignore
- [ ] `backlog-dashboard.html` is in .gitignore
- [ ] Duplicate backlog items marked Obsolete with cross-reference note
- [ ] `Validate Backlog Data` CI check passes

---

## Files to Modify

- `electron/schema.sql` - DELETE this file
- `.claude/plans/backlog/data/backlog.csv` - Fix casing, consolidate duplicates
- `.gitignore` - Add mad.db and backlog-dashboard.html

## Files to Read (for context)

- `electron/database/schema.sql` - Verify this is the real schema (do NOT modify)
- `.github/workflows/backlog-validation.yml` - Understand valid statuses

---

## Testing Expectations

### Unit Tests
- **Required:** No
- **New tests to write:** None
- **Existing tests to update:** None

### CI Requirements
- [ ] Backlog validation workflow passes
- [ ] No other CI jobs affected

---

## PR Preparation

- **Title:** `chore: repo hygiene - delete empty schema.sql, fix CSV casing, update gitignore`
- **Branch:** `chore/task-2006-repo-hygiene`
- **Target:** `develop`

---

## PM Status Updates

PM updates ALL three locations at each transition (engineer does NOT update status):

| When | Status | Where |
|------|--------|-------|
| Engineer assigned | → `In Progress` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR created + CI passes | → `Testing` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |
| PR merged | → `Completed` | backlog.csv + BACKLOG-XXX.md (if exists) + SPRINT-087.md |

**Backlog IDs to update:** BACKLOG-724, BACKLOG-727, BACKLOG-731, BACKLOG-732

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-19*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] electron/schema.sql deleted
- [ ] Backlog CSV casing fixed
- [ ] .gitignore updated
- [ ] Duplicate backlog items consolidated
- [ ] Type check passes (npm run type-check)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: ~2K)
- **PR**: https://github.com/5hdaniel/Mad/pull/882

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- You find that `electron/schema.sql` is NOT empty (has content)
- The backlog CSV has structural issues beyond casing
- You are unsure whether two backlog items are duplicates
- Any CI check fails after your changes
