# TASK-1159: Reduce Transactions.tsx State Complexity

**Backlog ID:** BACKLOG-237
**Sprint:** Standalone Task (State Refactor)
**Phase:** 1 - State Extraction
**Branch:** `feature/BACKLOG-237-reduce-transactions-state`
**Worktree:** `../Mad-BACKLOG-237-state-refactor`
**Estimated Turns:** 8-12
**Estimated Tokens:** ~60K

---

## Objective

Refactor `Transactions.tsx` to use existing extracted hooks and create one new hook for modal state management. The component currently has 17 useState hooks, many of which duplicate logic already available in extracted hooks that exist but are NOT being used.

---

## Context

The `Transactions.tsx` component has accumulated significant state complexity with 17 useState hooks. Hooks have already been extracted to `src/components/transaction/hooks/` but the component does not use them:

**Existing hooks (NOT used by Transactions.tsx):**
1. `useTransactionList` - handles transactions, loading, error, filtering
2. `useTransactionScan` - handles scanning, scanProgress
3. `useBulkActions` - handles isBulkDeleting, isBulkExporting, isBulkUpdating + handlers

**Current useState in Transactions.tsx (17 total):**

| State | Lines | Should Be In |
|-------|-------|--------------|
| `transactions` | 92 | `useTransactionList` |
| `loading` | 93 | `useTransactionList` |
| `scanning` | 94 | `useTransactionScan` |
| `scanProgress` | 95 | `useTransactionScan` |
| `searchQuery` | 96 | Keep in component (UI state) |
| `selectedTransaction` | 97-98 | Keep or `useTransactionModals` (new) |
| `error` | 99 | `useTransactionList` |
| `statusFilter` | 100-102 | Keep in component (UI state) |
| `showAuditCreate` | 103 | `useTransactionModals` (new) |
| `quickExportTransaction` | 104-105 | `useTransactionModals` (new) |
| `quickExportSuccess` | 106-108 | `useTransactionModals` (new) |
| `showBulkDeleteConfirm` | 121 | `useTransactionModals` (new) |
| `showBulkExportModal` | 122 | `useTransactionModals` (new) |
| `isBulkDeleting` | 123 | `useBulkActions` |
| `isBulkExporting` | 124 | `useBulkActions` |
| `isBulkUpdating` | 125 | `useBulkActions` |
| `bulkActionSuccess` | 126-128 | `useBulkActions` or `useTransactionModals` |
| `selectionMode` | 129 | Keep in component (UI state) |

**Target state after refactor:**
- 4-6 useState hooks remaining in component (searchQuery, statusFilter, selectionMode, selectedTransaction)
- All other state managed by custom hooks

---

## Requirements

### Must Do:

1. **Use `useTransactionList` hook** (already exists)
   - Import from `../transaction/hooks`
   - Replace local transactions, loading, error, and filtering logic
   - Use `refetch` callback where `loadTransactions` is currently called
   - File: `src/components/transaction/hooks/useTransactionList.ts`

2. **Use `useTransactionScan` hook** (already exists)
   - Import from `../transaction/hooks`
   - Replace local scanning, scanProgress, startScan, stopScan logic
   - Remove duplicate IPC listener setup (lines 135-147)
   - File: `src/components/transaction/hooks/useTransactionScan.ts`

3. **Use `useBulkActions` hook** (already exists)
   - Import from `../transaction/hooks`
   - Replace local isBulkDeleting, isBulkExporting, isBulkUpdating states
   - Replace handleBulkDelete, handleBulkExport, handleBulkStatusChange handlers
   - Provide required callbacks to hook
   - File: `src/components/transaction/hooks/useBulkActions.ts`

4. **Create new `useTransactionModals` hook**
   - Create at `src/components/transaction/hooks/useTransactionModals.ts`
   - Manage: showAuditCreate, quickExportTransaction, quickExportSuccess, showBulkDeleteConfirm, showBulkExportModal
   - Export from barrel file `src/components/transaction/hooks/index.ts`

5. **Update barrel export**
   - Add `useTransactionModals` to `src/components/transaction/hooks/index.ts`

### Must NOT Do:

- DO NOT change any component behavior (pure refactor)
- DO NOT modify the existing hooks (useTransactionList, useTransactionScan, useBulkActions)
- DO NOT change the UI or styling
- DO NOT add new features
- DO NOT modify other components that use Transactions.tsx

---

## Acceptance Criteria

- [ ] `Transactions.tsx` uses `useTransactionList` hook instead of local transactions/loading/error state
- [ ] `Transactions.tsx` uses `useTransactionScan` hook instead of local scanning/progress state
- [ ] `Transactions.tsx` uses `useBulkActions` hook instead of local bulk action state
- [ ] New `useTransactionModals` hook created and used for modal states
- [ ] Component has 4-6 useState hooks (down from 17)
- [ ] `useTransactionModals` exported from hooks barrel
- [ ] All existing functionality works identically
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] All tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)

---

## Files to Modify

- `src/components/Transactions.tsx` - Main refactor target
- `src/components/transaction/hooks/useTransactionModals.ts` - **CREATE NEW**
- `src/components/transaction/hooks/index.ts` - Add new hook export

## Files to Read (for context)

- `src/components/transaction/hooks/useTransactionList.ts` - Existing hook to use
- `src/components/transaction/hooks/useTransactionScan.ts` - Existing hook to use
- `src/components/transaction/hooks/useBulkActions.ts` - Existing hook to use

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests needed (pure refactor)
- **Existing tests to verify:** All current Transactions tests must pass unchanged
- **Smoke test:** Verify transactions page loads, filtering works, bulk actions work

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `refactor(transactions): reduce state complexity using extracted hooks`
- **Branch:** `feature/BACKLOG-237-reduce-transactions-state`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Switched to worktree: ../Mad-BACKLOG-237-state-refactor
- [ ] On branch: feature/BACKLOG-237-reduce-transactions-state
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

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

- **Before**: 17 useState hooks in Transactions.tsx
- **After**: [state after]
- **Actual Turns**: X (Est: 8-12)
- **Actual Tokens**: ~XK (Est: ~60K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Existing hooks need modification to support this refactor
- Tests fail after refactor (behavior changed unintentionally)
- You discover hooks are missing functionality needed by Transactions.tsx
- Type errors cannot be resolved without changing hook signatures
