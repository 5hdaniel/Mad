# Task TASK-552: Update Base schema.sql

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Update the base schema.sql file to include all columns and constraints from migrations, ensuring fresh installs get the complete schema.

## Non-Goals

- Do NOT create new migrations (that was TASK-551)
- Do NOT change TypeScript types (that was TASK-550)
- Do NOT add columns that don't exist in migrations
- Do NOT change runtime behavior

## Deliverables

1. Update: `electron/database/schema.sql` - Include all migrated columns

## Acceptance Criteria

- [ ] `schema.sql` includes `detection_status`, `detection_confidence`, `detected_at` columns
- [ ] `schema.sql` CHECK constraints include `archived` status if used
- [ ] `schema.sql` includes all SPRINT-050 columns (`submission_status`, `submission_id`, etc.)
- [ ] Fresh installs create tables matching migrated databases
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Step 1: Review All Migrations

Compile a list of all schema changes from migrations:

```bash
ls -la electron/database/migrations/
cat electron/database/migrations/*.sql
```

### Step 2: Update schema.sql

Add any columns present in migrations but missing from base schema.

Expected additions to `transactions` table:

```sql
-- AI Detection columns (from migration XXXX)
detection_status TEXT,
detection_confidence REAL,
detected_at TEXT,

-- Submission columns (from SPRINT-050)
submission_status TEXT DEFAULT 'not_submitted',
submission_id TEXT,
submitted_at TEXT,
last_review_notes TEXT,
```

### Step 3: Verify CHECK Constraints

Ensure status CHECK constraint includes all valid values:

```sql
-- Example (verify actual values from TypeScript)
CHECK (status IN ('pending', 'active', 'closed', 'archived'))
```

### Important Details

- Base schema is used for fresh installs ONLY
- Existing installations use migrations
- Both must result in identical schemas

## Integration Notes

- Depends on: TASK-550 (types), TASK-551 (migration)
- Used by: Fresh installs, development setup

## Do / Don't

### Do:
- Match column definitions exactly with migrations
- Preserve column order for readability
- Add comments for each column group
- Verify against TypeScript types

### Don't:
- Add columns not in migrations
- Change existing column definitions arbitrarily
- Remove any columns
- Modify table creation order (dependencies matter)

## When to Stop and Ask

- If base schema has columns not in migrations (inconsistency)
- If CHECK constraints conflict between schema and types
- If you're unsure about column default values

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests
- Existing tests: Must continue to pass

### Coverage

- Coverage impact: No change

### Integration / Feature Tests

- Required scenarios:
  - Delete local database, restart app - fresh schema created
  - Verify fresh schema has all expected columns

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `chore(schema): update base schema.sql with all migration columns`
- **Labels**: `schema`, `database`
- **Depends on**: TASK-551 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~8K-12K

**Token Cap:** 48K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 1 schema file | +5K |
| Code volume | ~30 lines SQL | +3K |
| Test complexity | Manual verify | +2K |

**Confidence:** High

**Similar past tasks:** Base schema updates in SPRINT-003

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/database/schema.sql

Columns added:
- [ ] detection_status
- [ ] detection_confidence
- [ ] detected_at
- [ ] (others as discovered)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Fresh database created with all columns
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL

### Merge Information

**PR Number:** #XXX
**Merged To:** develop
