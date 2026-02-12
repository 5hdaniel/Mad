# BACKLOG-549: Investigate and consolidate TransactionToolbar vs TransactionsToolbar

## Status
- **Priority**: Medium
- **Status**: Pending
- **Category**: Refactoring
- **Created**: 2026-01-29

## Problem Statement

There are two nearly identical toolbar components in the codebase:
1. `TransactionToolbar.tsx` (singular) - used by `TransactionList.tsx`
2. `TransactionsToolbar.tsx` (plural) - used by `Transactions.tsx`

Both components have similar functionality:
- Status filter tabs (All, Active, Closed, etc.)
- Search input
- Edit/selection mode button
- New Transaction button
- Scan/Auto Detect button (AI addon gated)

## Investigation Needed

1. **Determine which pages are actively used**
   - Is `TransactionList.tsx` or `Transactions.tsx` the primary transaction list view?
   - Are both needed for different contexts?

2. **Compare component differences**
   - `TransactionToolbar.tsx` has more filter options (Pending Review, Rejected)
   - `TransactionToolbar.tsx` has status info tooltip
   - Different prop interfaces

3. **Plan consolidation**
   - If only one page is needed, delete the unused page and toolbar
   - If both are needed, extract shared logic to avoid duplication

## Files Involved

- `src/components/TransactionList.tsx` - uses `TransactionToolbar`
- `src/components/Transactions.tsx` - uses `TransactionsToolbar`
- `src/components/transaction/components/TransactionToolbar.tsx`
- `src/components/transaction/components/TransactionsToolbar.tsx`
- `src/components/transaction/components/index.ts` - exports both

## Acceptance Criteria

- [ ] Determine which transaction list page(s) are needed
- [ ] Consolidate to single toolbar or document why both are needed
- [ ] Remove any unused components
- [ ] Update barrel exports
