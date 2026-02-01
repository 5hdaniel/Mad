# Task TASK-1214: Add ACID Transaction Wrappers

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See `.claude/docs/shared/pr-lifecycle.md`.

---

## Goal

Add transaction wrappers to critical database operations to ensure ACID compliance and prevent partial writes.

## Non-Goals

- Do NOT change query logic (that's Phase 6)
- Do NOT remove columns (that's Phase 7)
- Do NOT refactor the functions beyond adding transaction wrappers
- Do NOT add wrappers to read-only operations

## Deliverables

1. Update: `electron/services/db/communicationDbService.ts` - Wrap write operations
2. Update: `electron/services/db/transactionContactDbService.ts` - Wrap write operations
3. Update: Any other db services with multi-statement writes (from audit)

## Acceptance Criteria

- [ ] `createCommunicationReference()` wrapped in transaction
- [ ] `createThreadCommunicationReference()` wrapped in transaction
- [ ] `assignContactToTransaction()` wrapped in transaction
- [ ] Any other multi-statement writes wrapped
- [ ] All existing tests pass
- [ ] No behavioral changes (pure wrapper addition)

## Implementation Notes

### Pattern for Wrapping

```typescript
// Before
function createSomething(db: Database, params: Params): Result {
  db.prepare('INSERT INTO table1 ...').run(params);
  db.prepare('INSERT INTO table2 ...').run(params);
  return result;
}

// After
function createSomething(db: Database, params: Params): Result {
  return db.transaction(() => {
    db.prepare('INSERT INTO table1 ...').run(params);
    db.prepare('INSERT INTO table2 ...').run(params);
    return result;
  })();
}
```

### Functions to Wrap (from BACKLOG-506)

Check these functions and wrap if they have multiple statements:

1. `communicationDbService.createCommunicationReference()`
2. `communicationDbService.createThreadCommunicationReference()`
3. `transactionContactDbService.assignContactToTransaction()`

### How to Identify Multi-Statement Writes

Search for functions that:
- Call `db.prepare(...).run()` more than once
- Or call other db functions that write

## Integration Notes

- Depends on: TASK-1213
- This is preparation for safer future changes
- Should not change any behavior

## Do / Don't

### Do:

- Only wrap functions with multiple write statements
- Keep the wrapper minimal - just add transaction
- Test that rollback works on error

### Don't:

- Don't wrap read-only operations
- Don't change the function logic
- Don't wrap already-wrapped functions

## When to Stop and Ask

- If a function is already wrapped in a transaction
- If wrapping causes test failures
- If unclear whether a function needs wrapping

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests (behavioral equivalence)
- Existing tests must pass

### Integration / Feature Tests

- Manual verification that write operations still work

### CI Requirements

- [ ] All checks pass

## PR Preparation

- **Title**: `refactor(db): add ACID transaction wrappers`
- **Labels**: `database`, `refactor`
- **Depends on**: TASK-1213

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~10K-12K

**Token Cap:** 48K

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Functions to wrap | ~5 functions | +8K |
| Testing | Verify each function | +4K |

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
Functions wrapped:
- [ ] createCommunicationReference
- [ ] createThreadCommunicationReference
- [ ] assignContactToTransaction
- [ ] (list others found)

Verification:
- [ ] npm run type-check passes
- [ ] npm test passes
- [ ] Manual test: create communication reference
- [ ] Manual test: link contact to transaction
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary

**Transaction Wrapping Correct:** PASS / FAIL
**No Logic Changes:** PASS / FAIL

### Merge Verification (MANDATORY)

- [ ] Merge verified: state shows `MERGED`

---

## User Testing Gate

**AFTER this task merges, user must test:**

- [ ] App starts normally
- [ ] Link an email to a transaction
- [ ] Link a contact to a transaction
- [ ] Create a new audit

**If all tests pass, user approves proceeding to TASK-1215.**
