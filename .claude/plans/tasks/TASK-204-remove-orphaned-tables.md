# Task TASK-204: Remove Orphaned Database Tables

## Goal

Remove the unused `extraction_metrics` and `user_feedback` tables from the database, along with their associated indexes and triggers.

## Non-Goals

- Do NOT remove any other tables
- Do NOT modify the `ClassificationFeedback` interface (future replacement)
- Do NOT implement new feedback functionality
- Do NOT change any active database operations

## Deliverables

1. New file: `electron/database/migrations/remove_orphaned_tables.sql`
2. Update: `electron/services/databaseService.ts` (add removal migration)
3. Documentation: Update any schema docs that reference these tables

## Acceptance Criteria

- [ ] Codebase audit confirms no active usage of tables
- [ ] `extraction_metrics` table dropped
- [ ] `user_feedback` table dropped
- [ ] Associated indexes dropped
- [ ] Associated triggers dropped
- [ ] Migration runs cleanly on existing databases
- [ ] Application starts without errors
- [ ] All tests pass

## Implementation Notes

### Pre-Implementation Audit (CRITICAL)

Before writing any migration code, you MUST:

1. **Search for table references:**
```bash
# In project root:
grep -r "extraction_metrics" --include="*.ts" --include="*.tsx" --include="*.sql"
grep -r "user_feedback" --include="*.ts" --include="*.tsx" --include="*.sql"
```

2. **Distinguish active vs deprecated:**
   - `UserFeedback` TypeScript interface = OK (deprecated type, can remain)
   - `user_feedback` SQL table reference = STOP (find and evaluate usage)

3. **Check for data:**
```sql
SELECT COUNT(*) FROM extraction_metrics;
SELECT COUNT(*) FROM user_feedback;
```

If either returns > 0, STOP and ask PM about data preservation.

### Migration Script

```sql
-- Migration: remove_orphaned_tables.sql
-- This migration removes unused tables from legacy feature attempts

-- ============================================
-- STEP 1: Drop indexes (must come before table drop)
-- ============================================

DROP INDEX IF EXISTS idx_extraction_metrics_user_id;
DROP INDEX IF EXISTS idx_extraction_metrics_field;
DROP INDEX IF EXISTS idx_user_feedback_user_id;
DROP INDEX IF EXISTS idx_user_feedback_transaction_id;
DROP INDEX IF EXISTS idx_user_feedback_field_name;
DROP INDEX IF EXISTS idx_user_feedback_type;

-- ============================================
-- STEP 2: Drop triggers
-- ============================================

DROP TRIGGER IF EXISTS update_extraction_metrics_timestamp;

-- ============================================
-- STEP 3: Drop tables
-- ============================================

DROP TABLE IF EXISTS extraction_metrics;
DROP TABLE IF EXISTS user_feedback;

-- ============================================
-- VERIFICATION (run manually, not in migration)
-- ============================================
-- SELECT name FROM sqlite_master WHERE type='table' AND name IN ('extraction_metrics', 'user_feedback');
-- Should return empty result
```

### Database Service Update

Add migration check in `databaseService.ts`:

```typescript
// Migration X: Remove orphaned tables
const orphanedTablesExist = this._get<{ name: string }>(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='extraction_metrics'`
);
if (orphanedTablesExist) {
  await logService.debug(
    "Removing orphaned extraction_metrics and user_feedback tables",
    "DatabaseService"
  );

  // Drop indexes first
  this._run(`DROP INDEX IF EXISTS idx_extraction_metrics_user_id`);
  this._run(`DROP INDEX IF EXISTS idx_extraction_metrics_field`);
  this._run(`DROP INDEX IF EXISTS idx_user_feedback_user_id`);
  this._run(`DROP INDEX IF EXISTS idx_user_feedback_transaction_id`);
  this._run(`DROP INDEX IF EXISTS idx_user_feedback_field_name`);
  this._run(`DROP INDEX IF EXISTS idx_user_feedback_type`);

  // Drop trigger
  this._run(`DROP TRIGGER IF EXISTS update_extraction_metrics_timestamp`);

  // Drop tables
  this._run(`DROP TABLE IF EXISTS extraction_metrics`);
  this._run(`DROP TABLE IF EXISTS user_feedback`);

  await logService.info(
    "Successfully removed orphaned tables",
    "DatabaseService"
  );
}
```

## Integration Notes

- Imports from: None
- Exports to: None
- Used by: None (that's why we're removing them)
- **Depends on**: TASK-202 and TASK-203 MUST be completed first
  - Reason: Verify schema fixes work before removing any tables
- Sequential with: Cannot run in parallel with other schema changes

## Do / Don't

### Do:
- Run codebase audit FIRST
- Test migration on dev database before PR
- Keep TypeScript interfaces (deprecated, but harmless)
- Log the removal for debugging

### Don't:
- Skip the usage audit
- Remove tables without checking for data
- Remove the `UserFeedback` or `ClassificationFeedback` TypeScript types
- Run migration in production without backup

## SR Engineer Review Notes

**Review Date:** 2025-12-16 | **Status:** APPROVED

> **Note on Index Names:** The task file lists specific index names (e.g., `idx_extraction_metrics_user_id`). Verify these match the actual schema before executing DROP statements. If indexes don't exist with these names, `DROP INDEX IF EXISTS` will safely no-op, but it's better to verify the actual names first.

## When to Stop and Ask

- If ANY active SQL references to these tables are found
- If either table contains data (COUNT > 0)
- If foreign key constraints block the drop
- If migration causes cascade deletions to other tables

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests needed
- This is a removal operation
- Existing tests should continue to pass

### Integration Tests

- Required: Manual verification
- Start application after migration
- Verify no database errors in logs
- Verify all existing features still work

### Pre-Migration Verification

- [ ] `grep` search shows no active SQL usage
- [ ] Table row counts are 0 (or data documented)
- [ ] Migration runs on test database

### Post-Migration Verification

- [ ] Application starts without error
- [ ] No "table not found" errors in logs
- [ ] All existing tests pass

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `chore(database): remove orphaned extraction_metrics and user_feedback tables`
- **Labels**: `database`, `cleanup`, `tech-debt`
- **Depends on**: TASK-202, TASK-203 (schema fixes must be merged first)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Pre-Implementation Audit Results

```
Codebase Search Results:
- extraction_metrics references: [list files/lines]
- user_feedback SQL references: [list files/lines]
- UserFeedback type references: [list files - OK if only types]

Table Data Check:
- extraction_metrics row count: X
- user_feedback row count: X
```

### Checklist

```
Audit completed:
- [ ] Codebase grep for table names
- [ ] Row count check
- [ ] No active usage confirmed

Migration:
- [ ] Migration script created
- [ ] Tested on dev database
- [ ] databaseService.ts updated

Verification:
- [ ] Application starts
- [ ] No database errors
- [ ] All tests pass
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Audit findings:**
<Document what the codebase search found>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>
