# Task TASK-1213: Drop transaction_participants Table

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Drop the unused `transaction_participants` table since `transaction_contacts` provides the same functionality with more flexibility.

## Non-Goals

- Do NOT modify any code that still references this table (verify it's truly unused first)
- Do NOT remove any other tables
- Do NOT make changes to `transaction_contacts`

## Deliverables

1. Update: `electron/database/schema.sql` - Remove table definition
2. Update: `electron/services/databaseService.ts` - Add migration to drop table

## Acceptance Criteria

- [ ] Verified no code references `transaction_participants` (search confirms)
- [ ] Table is dropped in migration
- [ ] Schema file no longer contains table definition
- [ ] All existing tests pass
- [ ] App works normally

## Implementation Notes

### Pre-Implementation Verification

Before implementing, verify the table is truly unused:

```bash
# Search for any references
grep -rn "transaction_participants" --include="*.ts" --include="*.tsx" electron/ src/

# Expected: No results (or only in migration/schema)
```

If references are found, STOP and report to PM.

### Migration

```typescript
// Migration XX: Drop unused transaction_participants table
{
  const currentVersion = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (currentVersion.user_version < XX) {
    log('Running migration XX: Drop transaction_participants table');
    db.transaction(() => {
      db.exec(`DROP TABLE IF EXISTS transaction_participants`);
      db.exec(`PRAGMA user_version = XX`);
    })();
    log('Migration XX complete');
  }
}
```

### Schema Update

Remove the `CREATE TABLE transaction_participants` block from `schema.sql`.

## Integration Notes

- Depends on: TASK-1212
- This is a cleanup - removes unused table
- No code changes needed if table is truly unused

## Do / Don't

### Do:

- Verify table is unused before proceeding
- Use `DROP TABLE IF EXISTS` for safety
- Remove from schema.sql as well as add migration

### Don't:

- Don't drop if any code still references it
- Don't assume it's unused - verify

## When to Stop and Ask

- If ANY code references `transaction_participants`
- If migration fails

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (table should be unused)
- Existing tests must pass

### CI Requirements

- [ ] All checks pass

## PR Preparation

- **Title**: `refactor(db): drop unused transaction_participants table`
- **Labels**: `database`, `cleanup`
- **Depends on**: TASK-1212

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~5K-8K

**Token Cap:** 32K

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Verification | Search for references | +3K |
| Migration | Simple drop | +2K |
| Schema update | Remove definition | +2K |

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
Verification:
- [ ] grep confirms no code references
- [ ] Table is actually unused

Files modified:
- [ ] electron/database/schema.sql
- [ ] electron/services/databaseService.ts

Testing:
- [ ] npm run type-check passes
- [ ] npm test passes
- [ ] App starts normally
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Verification Complete:** PASS / FAIL
**Schema Change Valid:** PASS / FAIL

### Merge Verification (MANDATORY)

- [ ] Merge verified: state shows `MERGED`

---

## User Testing Gate

**AFTER this task merges, user must test:**

- [ ] App starts normally
- [ ] Contact management works
- [ ] Transaction contact linking works

**If all tests pass, user approves proceeding to TASK-1214.**
