# TASK-605: Transactions.tsx Split

**Sprint:** SPRINT-009 - Codebase Standards Remediation
**Phase:** 4 - Component Refactors
**Priority:** HIGH
**Status:** Pending
**Depends On:** TASK-604
**Parallel With:** TASK-606, TASK-607

---

## Metrics Tracking (REQUIRED)

```markdown
## Engineer Metrics

**Task Start Time:** [timestamp]
**Task End Time:** [timestamp]

| Phase | Turns | Tokens (est.) | Time |
|-------|-------|---------------|------|
| Planning | - | - | - |
| Implementation | - | - | - |
| Debugging | - | - | - |
| **Total** | - | - | - |
```

---

## Objective

Split `src/components/Transactions.tsx` (2,614 lines) into smaller, focused components, reducing the main file to < 600 lines.

---

## Current State

`Transactions.tsx` contains:
- Transaction list rendering
- Filtering and search logic
- Bulk actions (delete, export, status change)
- Selection management
- Scanning/refresh logic
- Multiple modal dialogs
- Toast notifications

Note: SPRINT-008 already extracted some components to `src/components/transaction/`:
- `TransactionCard.tsx`
- `TransactionStatusWrapper.tsx`
- `TransactionToolbar.tsx`
- `useBulkActions.ts`
- `useTransactionList.ts`
- `useTransactionScan.ts`

---

## Requirements

### Must Do
1. Identify remaining extractable logic
2. Use service layer from TASK-604 (replace window.api calls)
3. Reduce Transactions.tsx to < 600 lines
4. Maintain all existing functionality

### Must NOT Do
- Change user-facing behavior
- Break existing tests
- Duplicate already-extracted components

---

## Extraction Targets

Review current file for:

| Component/Hook | Purpose | Target Location |
|----------------|---------|-----------------|
| Filter logic | Status/date filtering | `useTransactionFilters.ts` |
| Search logic | Transaction search | (may combine with filters) |
| Modal state | Dialog management | `useTransactionModals.ts` |
| Remaining UI components | Any inline JSX | `components/` |

---

## Implementation Approach

1. **Audit current state** - Check what SPRINT-008 already extracted
2. **Identify remaining bloat** - Find inline logic that can be extracted
3. **Replace window.api calls** - Use new service layer
4. **Extract remaining hooks** - Filter, search, modal logic
5. **Verify line count** - Must be < 600

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Transactions.tsx` | Reduce to < 600 lines |
| `src/components/transaction/hooks/` | Add new hooks if needed |
| `src/components/transaction/components/` | Add new components if needed |

---

## Testing Requirements

1. **Existing Tests**
   - All transaction tests pass
   - No behavior changes

2. **Manual Verification**
   - Transaction list renders correctly
   - Filtering works
   - Bulk actions work
   - All modals work

---

## Acceptance Criteria

- [ ] `Transactions.tsx` < 600 lines
- [ ] Uses service layer (no direct window.api calls)
- [ ] All existing tests pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] SR Engineer architecture review passed

---

## Branch

```
feature/TASK-605-transactions-split
```

---

## Handoff

After completing implementation:
1. Push branch (do NOT create PR)
2. Report metrics
3. SR Engineer will review and merge
