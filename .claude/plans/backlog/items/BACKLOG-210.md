# BACKLOG-210: Contacts Still Not Pre-Populating in Edit Transaction (TASK-995 Incomplete)

**Created**: 2026-01-12
**Priority**: High
**Category**: Bug Fix
**Status**: In Sprint (SPRINT-033, TASK-1030)

---

## Description

When editing an existing transaction, the contact assignments are NOT pre-populating in the edit form. This is the same issue as BACKLOG-171/TASK-995, but the fix (PR #357) did not fully resolve the problem.

**What works:**
- Transaction details (address, type, dates) correctly pre-fill
- The edit form renders correctly

**What does NOT work:**
- Contact assignments do NOT appear when editing a transaction
- User must re-select all contacts even though they exist in the database

## Previous Fix Attempt

**TASK-995 / PR #357** (merged 2026-01-09) changed role priority:
```typescript
// Before
const role = assignment.specific_role || assignment.role;
// After
const role = assignment.role || assignment.specific_role;
```

This fix was intended to align with AUDIT_WORKFLOW_STEPS constants but did not resolve the issue.

## Investigation Areas

1. **Database data** - Check if `role` field is populated in `transaction_contacts` table
2. **Role value mismatch** - Compare saved role values vs AUDIT_WORKFLOW_STEPS keys
3. **API response** - Verify `getTransactionDetails` returns `contact_assignments` with data
4. **UI grouping logic** - Verify `loadContactAssignments()` correctly groups and sets state

## Files to Investigate

| File | Purpose |
|------|---------|
| `src/components/transaction/components/EditTransactionModal.tsx` | Edit modal with `loadContactAssignments()` |
| `electron/services/transactionService.ts:1082` | `getTransactionDetails()` |
| `electron/services/db/transactionContactDbService.ts:158` | `getTransactionContactsWithRoles()` |
| Database: `transaction_contacts` table | Check actual stored data |

## Debug Steps

1. Add console.log in `loadContactAssignments()` to see API response
2. Check database directly for a transaction's contact assignments
3. Verify role values in database match AUDIT_WORKFLOW_STEPS keys

## Acceptance Criteria

- [ ] When editing a transaction, existing contacts appear in their assigned roles
- [ ] All role types populate correctly (buyer, seller, agents, lender, title, etc.)
- [ ] Modifying and saving contacts works correctly
- [ ] No regression in new transaction creation

## Related

- **BACKLOG-171**: Original issue report
- **TASK-995**: First fix attempt (incomplete)
- **PR #357**: Merged fix that didn't fully resolve the issue
