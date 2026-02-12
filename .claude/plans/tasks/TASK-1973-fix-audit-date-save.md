# TASK-1973: Fix Audit Date Not Saved from New Audit Flow

## Status: in_progress

## Type: Bug Fix

## Priority: High

## Description

When creating a new transaction/audit through the "Audit New Transaction" flow, the audit date (`started_at`) and end date (`closed_at`) are NOT being persisted to the database. The user enters dates in Step 1 of the wizard, but after creation the dates do not appear in the Transaction Details summary.

**Workaround (confirms the bug):** After creating the transaction, clicking "Edit Summary" then "Save" (without changing anything) correctly persists the dates. This is because the UPDATE path includes `started_at`/`closed_at` but the INSERT path does not.

## Root Cause Analysis (PM Investigation)

The bug is in `/Users/daniel/Documents/Mad/electron/services/db/transactionDbService.ts`, in the `createTransaction` function (line 69).

**The INSERT SQL statement is missing `started_at` and `closed_at` columns:**

```sql
-- CURRENT (broken): Only 11 columns
INSERT INTO transactions (
  id, user_id, property_address, property_street, property_city,
  property_state, property_zip, property_coordinates,
  transaction_type, status, closing_deadline
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**Should be (fixed): 13 columns including started_at and closed_at**

```sql
INSERT INTO transactions (
  id, user_id, property_address, property_street, property_city,
  property_state, property_zip, property_coordinates,
  transaction_type, status, closing_deadline, started_at, closed_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

**The params array also needs the two additional values:**

Currently (line 86-100), the params array has 11 entries. It needs:
```typescript
transactionData.started_at || null,
transactionData.closed_at || null,
```

### Data Flow Trace

1. **User enters dates** in `AddressVerificationStep.tsx` (Step 1 of wizard)
2. **Dates stored in state** via `useAuditTransaction.ts` hook `addressData.started_at` / `addressData.closed_at`
3. **Dates passed to handler** at Step 3 when `handleCreateTransaction()` calls `window.api.transactions.createAudited(userId, { ...addressData, contact_assignments })`
4. **Handler validates and forwards** `transaction-handlers.ts` line 538 calls `transactionService.createAuditedTransaction()`
5. **Service destructures dates** `transactionService.ts` line 1336-1338 extracts `started_at`, `closed_at`, `closing_deadline`
6. **Service passes to DB** line 1342 calls `databaseService.createTransaction({ ...including started_at, closed_at, closing_deadline })`
7. **BUG HERE**: `transactionDbService.ts` `createTransaction()` function (line 69) **ignores** `started_at` and `closed_at` - they are present in the `transactionData` parameter but are never included in the INSERT SQL or params array.

### Why the Edit Workaround Works

The `updateTransaction` function (line 296 in `transactionDbService.ts`) has `started_at` and `closed_at` in its `allowedFields` array (lines 309-310), so the update/edit path correctly writes these columns.

## Acceptance Criteria

1. When creating a new transaction through the "Audit New Transaction" flow, `started_at` is persisted to the database
2. When creating a new transaction, `closed_at` is persisted to the database (if provided)
3. The Transaction Details summary displays the audit dates immediately after creation (no need for "Edit Summary" workaround)
4. Existing tests continue to pass
5. Add a test case that verifies `started_at` and `closed_at` are included in the INSERT

## Files to Modify

### Primary Fix
- `electron/services/db/transactionDbService.ts` - Add `started_at` and `closed_at` to the INSERT SQL and params array in `createTransaction()` function

### Test Files
- `electron/services/__tests__/transactionService.test.ts` - Add/update test for createAuditedTransaction to verify dates are passed
- Or create a focused test in the relevant test file for `transactionDbService`

## Branch Information
- **Branch From:** develop
- **Branch Into:** develop
- **Branch Name:** fix/TASK-1973-audit-date-save
- **Worktree Path:** /Users/daniel/Documents/Mad-audit-date-fix

## Estimated Effort
- **Tokens:** ~5K (simple 2-line fix + test update)
- **Category:** Bug fix - missing columns in SQL INSERT

## Dependencies
- None

## Implementation Notes

This is a straightforward fix. The `createTransaction` function needs exactly two changes:
1. Add `, started_at, closed_at` to the column list in the INSERT SQL
2. Add `transactionData.started_at || null` and `transactionData.closed_at || null` to the params array

The `NewTransaction` type already includes these fields (via `Transaction` type at `electron/types/models.ts` lines 519-520). No type changes needed.
