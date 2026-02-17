# TASK-2000: Fix getTransactionDetails Return Type and Extract Business Logic

**Backlog:** BACKLOG-716
**Sprint:** SPRINT-085
**Status:** In Progress
**Priority:** High
**Category:** refactor / types
**Estimated Tokens:** ~15K (refactor x0.5 multiplier applied)
**Token Cap:** ~60K (4x)

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. See CLAUDE.md for the full 15-step workflow.

---

## Goal

Fix the `getTransactionDetails` handler return type to include `communications` and `contact_assignments` fields (eliminating 5+ `as any` casts downstream), and extract any remaining inline business logic (backfill helpers, attachment counting, raw SQL queries) from the newly split handler files into proper service methods.

## Non-Goals

- Do NOT re-split handler files (TASK-1999 already did that)
- Do NOT change the `wrapHandler()` utility (TASK-2002)
- Do NOT touch `system-handlers.ts` or `contact-handlers.ts`
- Do NOT change IPC response shapes for any handler except `transactions:get-details` (which is getting a more accurate type, not a behavior change)

## Prerequisites

**Depends on:** TASK-1999 (split transaction-handlers) must be merged first. This task works on the new split handler files.

## Deliverables

### Files to Modify

| File | Change |
|------|--------|
| `electron/handlers/transactionCrudHandlers.ts` | Fix `getTransactionDetails` return type; extract inline logic |
| `electron/services/transactionService.ts` (or appropriate service) | Add typed return interface for transaction details |
| Component files with `as any` casts on transaction details | Remove casts now that types are correct |

### Type Fix: getTransactionDetails

The current `TransactionResponse` interface uses `transaction?: Transaction | any` which forces downstream code to cast. The `transactions:get-details` handler returns a transaction object that includes:
- All `Transaction` fields
- `communications: Communication[]`
- `contact_assignments: ContactAssignment[]`

Create a proper `TransactionDetails` interface:

```typescript
interface TransactionDetails extends Transaction {
  communications: Communication[];
  contact_assignments: ContactAssignment[];
}
```

Update the handler and `TransactionResponse` to use this type, then remove `as any` casts in components that consume transaction details.

### Business Logic Extraction

Scan the newly split handler files (from TASK-1999) for any remaining inline business logic that should live in service files:

1. **Attachment counting logic** -- if inline SQL counts are in handlers, extract to a service method
2. **Backfill logic** -- if backfill orchestration is inline, extract to service
3. **Raw SQL queries** -- any `dbAll()`/`dbGet()`/`dbRun()` calls directly in handlers should be wrapped in service methods

## Acceptance Criteria

- [ ] `TransactionDetails` interface exists with `communications` and `contact_assignments` typed
- [ ] `transactions:get-details` handler uses `TransactionDetails` return type
- [ ] All `as any` casts in component code that were due to missing transaction detail types are removed
- [ ] No raw `dbAll()`/`dbGet()`/`dbRun()` calls remain in the CRUD handler file (delegated to services)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No behavioral changes

## Do / Don't Guidelines

### DO:
- Create the `TransactionDetails` type in the appropriate shared types file
- Remove `as any` casts one at a time, verifying type-check after each
- Check all consumers of `getTransactionDetails` response for casts to remove

### DON'T:
- Change the actual data returned by the handler -- only the TypeScript type
- Add `as any` to make type-check pass -- fix the actual types
- Modify handler files beyond the ones from TASK-1999's output

## Stop-and-Ask Triggers

- If the split handler files from TASK-1999 do not exist, STOP -- dependency not merged
- If removing an `as any` causes a cascade of type errors in unrelated code, STOP and flag scope

## Testing Expectations

- No new tests required -- this is type-level refactoring
- All existing tests must pass unchanged
- `npm run type-check` is the primary validation

## PR Preparation

**Title:** `refactor: fix getTransactionDetails return type and extract inline business logic`
**Labels:** refactor, types
**Base:** develop

---

## Implementation Summary

| Field | Value |
|-------|-------|
| **Agent ID** | engineer-task-2000 |
| **Branch** | refactor/task-2000-transaction-handler-types |
| **PR** | TBD |
| **Files Changed** | 10 |
| **Tests Added** | 0 (type-level refactoring) |
| **Issues/Blockers** | None |

### Changes Made

1. **Consolidated `TransactionResponse` interface** into `electron/types/handlerTypes.ts` -- removed 3 duplicate definitions from handler files
2. **Exported `TransactionWithDetails`** from `transactionService.ts` and `AuditedTransactionData` for proper downstream typing
3. **Removed `as any` casts** in:
   - `transactionCrudHandlers.ts` -- replaced `validatedData as any` with `validatedData as AuditedTransactionData`
   - `transactionExportHandlers.ts` -- removed 4x `(details as any).communications` casts (type already correct via `TransactionWithDetails`)
   - `emailSyncHandlers.ts` -- removed 2x `(transactionDetails as any).contact_assignments` casts
   - `useTransactionDetails.ts` -- removed 2x `window.api.transactions as any` casts
   - `AttachMessagesModal.tsx` -- removed 3x `(window.api.transactions as any)` casts
4. **Extracted 4 raw SQL queries** from `emailSyncHandlers.ts` into service methods:
   - `getContactEmailsForTransaction()` in contactDbService
   - `getEmailsByContactId()` in contactDbService
   - `resolveContactEmailsByQuery()` in contactDbService
   - Replaced inline `dbGet` with existing `countEmailsByUser()` from emailDbService
5. **Fixed `getCommunications` type** in `window.d.ts` to include `transaction?` wrapper (matching actual handler response shape)
6. **Fixed `updateTransaction` handler** -- was returning `void` as `transaction` field; now correctly omits it
