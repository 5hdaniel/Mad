# BACKLOG-216: Edit Contacts Still Not Pre-Populating (TASK-1030 Regression)

**Status:** Pending
**Priority:** HIGH
**Category:** bug/regression
**Created:** 2026-01-12
**Related Task:** TASK-1030 (merged PR #406)
**Related Backlog:** BACKLOG-210

---

## Problem Statement

When clicking "Edit" on an existing transaction, the contact assignments do NOT pre-populate in the edit form. Users must re-select all contacts even though they are saved in the database.

This is a potential regression or incomplete fix from TASK-1030 which was supposed to fix this exact issue.

---

## Symptoms

1. Create a new transaction with contacts assigned
2. Save the transaction
3. Click "Edit" on the transaction
4. Expected: Contact assignments should appear in the form
5. Actual: Contact fields are empty

---

## History

This is the **SECOND** report of this issue:

| Occurrence | Task | PR | Status |
|------------|------|-----|--------|
| First | TASK-995 | #357 | Incomplete fix |
| Second | TASK-1030 | #406 | Merged, but still reported |
| Third | This report | TBD | Investigation needed |

---

## Investigation Required

### 1. Verify TASK-1030 Fix Is Active

```typescript
// Check EditTransactionModal.tsx
// loadContactAssignments() should be called in useEffect
// Verify the function exists and runs on mount
```

### 2. Check API Response

Add logging to verify data is being returned:

```typescript
const details = await window.api.getTransactionDetails(transactionId);
console.log('contact_assignments:', details.contact_assignments);
// Should log array of assignments, not empty/undefined
```

### 3. Verify Database State

```sql
SELECT tc.*, c.name
FROM transaction_contacts tc
JOIN contacts c ON tc.contact_id = c.id
WHERE tc.transaction_id = '<test_transaction_id>'
```

### 4. Check Role Mapping

```typescript
// AUDIT_WORKFLOW_STEPS keys must match database role values
const expectedRoles = Object.keys(AUDIT_WORKFLOW_STEPS);
const actualRole = assignment.role;
console.log('Role match:', expectedRoles.includes(actualRole));
```

---

## Potential Root Causes

| Cause | Likelihood | Notes |
|-------|------------|-------|
| Fix not deployed | Low | PR #406 merged, but check branch |
| Race condition | Medium | Data loading before component mount |
| Role key mismatch | Medium | DB values don't match expected keys |
| API not returning assignments | Medium | Check getTransactionDetails query |
| UI state not updating | Medium | Check setState after data load |

---

## Acceptance Criteria

- [ ] When editing transaction, existing contacts appear in their assigned roles
- [ ] All role types populate correctly (buyer, seller, agents, etc.)
- [ ] Modifying and saving contacts works correctly
- [ ] Root cause documented
- [ ] No regression in new transaction creation
- [ ] Full test suite passes

---

## Related Items

| ID | Title | Relationship |
|----|-------|-------------|
| BACKLOG-210 | Contacts not pre-populating | Original issue |
| TASK-1030 | Fix pre-population | Merged fix (may have regression) |
| TASK-995 | First fix attempt | Previous incomplete fix |
| PR #406 | fix(transaction) | Merged PR to review |

---

## Estimated Effort

**Category:** fix/regression
**Estimated Tokens:** ~25K (investigation + fix)
**Token Cap:** 100K

---

## Changelog

- 2026-01-12: Created from user testing feedback (third occurrence)
