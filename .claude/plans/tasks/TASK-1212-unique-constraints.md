# Task TASK-1212: Add Unique Constraints to Communications Table

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Add unique constraints to the `communications` table to prevent duplicate thread links at the database level (defense in depth).

## Non-Goals

- Do NOT remove any columns yet (that's Phase 7)
- Do NOT modify any queries yet (that's Phase 6)
- Do NOT change application logic
- Do NOT add constraints that would break existing data

## Deliverables

1. Update: `electron/database/schema.sql` - Add unique index
2. Update: `electron/services/databaseService.ts` - Add migration
3. (If needed) Supabase migration for cloud schema alignment

## Acceptance Criteria

- [ ] Unique index prevents duplicate `(thread_id, transaction_id)` combinations
- [ ] Existing data is not affected (or duplicates cleaned first)
- [ ] Migration runs without errors on fresh database
- [ ] Migration runs without errors on existing database
- [ ] All existing tests pass
- [ ] App starts and works normally

## Implementation Notes

### Unique Index Definition

```sql
-- Prevent duplicate thread links
-- Only applies when thread_id is set and message_id is NULL (thread-level links)
CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_thread_txn_unique
  ON communications(thread_id, transaction_id)
  WHERE thread_id IS NOT NULL AND message_id IS NULL;
```

### Migration Number

Check current migration count in `databaseService.ts` and use next number.

### Handle Existing Duplicates

Before adding constraint, check for existing duplicates:

```sql
-- Check for duplicates
SELECT thread_id, transaction_id, COUNT(*) as cnt
FROM communications
WHERE thread_id IS NOT NULL AND message_id IS NULL
GROUP BY thread_id, transaction_id
HAVING COUNT(*) > 1;
```

If duplicates exist, add a cleanup step in migration:

```sql
-- Delete duplicates, keeping the oldest record
DELETE FROM communications
WHERE id NOT IN (
  SELECT MIN(id) FROM communications
  WHERE thread_id IS NOT NULL AND message_id IS NULL
  GROUP BY thread_id, transaction_id
);
```

### Migration Template

```typescript
// Migration XX: Add unique constraint for thread links
{
  const currentVersion = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (currentVersion.user_version < XX) {
    log('Running migration XX: Add unique constraint for thread links');
    db.transaction(() => {
      // Clean up any existing duplicates first
      db.exec(`
        DELETE FROM communications
        WHERE id NOT IN (
          SELECT MIN(id) FROM communications
          WHERE thread_id IS NOT NULL AND message_id IS NULL
          GROUP BY thread_id, transaction_id
        )
        AND thread_id IS NOT NULL AND message_id IS NULL;
      `);

      // Add unique index
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_thread_txn_unique
          ON communications(thread_id, transaction_id)
          WHERE thread_id IS NOT NULL AND message_id IS NULL;
      `);

      db.exec(`PRAGMA user_version = XX`);
    })();
    log('Migration XX complete');
  }
}
```

## Integration Notes

- Depends on: TASK-1210 (revert), TASK-1211 (audit approved)
- This change is additive and non-breaking
- Future phases depend on this being in place

## Do / Don't

### Do:

- Check for existing duplicates before adding constraint
- Use conditional index (WHERE clause) to only constrain thread-level links
- Test on both fresh and existing databases

### Don't:

- Don't add overly broad constraints that break existing patterns
- Don't skip duplicate cleanup if needed
- Don't assume existing data is clean

## When to Stop and Ask

- If more than 100 duplicate records exist (need user decision on cleanup)
- If migration fails with constraint violation
- If unclear what constitutes a "duplicate" in this context

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests needed for this migration
- Existing tests must pass

### Integration / Feature Tests

- Required: Manual test that app works after migration
- Verify no errors in database logs

### CI Requirements

- [ ] Unit tests pass
- [ ] Type checking passes
- [ ] Lint passes

## PR Preparation

- **Title**: `feat(db): add unique constraint for thread links`
- **Labels**: `database`, `schema`
- **Depends on**: TASK-1211

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~8K-10K

**Token Cap:** 40K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 files | +5K |
| Migration complexity | Low - additive only | +3K |
| Testing | Basic verification | +2K |

**Confidence:** High

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
- [ ] electron/services/databaseService.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Migration tested on fresh DB
- [ ] Migration tested on existing DB
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

**Variance:** PM Est ~10K vs Actual ~XK

### Notes

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Schema Change Valid:** PASS / FAIL

### Merge Verification (MANDATORY)

- [ ] PR merge command executed
- [ ] Merge verified: state shows `MERGED`
- [ ] Task can now be marked complete

---

## User Testing Gate

**AFTER this task merges, user must test:**

- [ ] App starts normally
- [ ] Creating a new transaction works
- [ ] Linking emails works
- [ ] Linking text threads works
- [ ] No new error messages

**If all tests pass, user approves proceeding to TASK-1213.**
