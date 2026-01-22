# BACKLOG-389: Main Transactions Page Scroll Not Working

**Created**: 2026-01-22
**Priority**: Critical
**Category**: Bug
**Status**: Closed
**Closed**: 2026-01-22
**Resolution**: Fixed via PR #520

---

## Problem

The main transactions page scroll is broken. Users can only see ~3 transactions and cannot scroll to see the rest. This completely blocks access to transactions beyond the visible area.

## Expected Behavior

- Page should scroll vertically to show all transactions
- Scroll should work with mouse wheel, trackpad, and scrollbar

## Likely Cause

CSS overflow issue - either:
1. Parent container has `overflow: hidden`
2. Missing `overflow-y: auto` or `overflow-y: scroll`
3. Height constraint preventing scroll
4. Recent change broke the layout

## Files to Check

- `src/components/Transactions.tsx`
- `src/components/TransactionList.tsx`
- Parent layout components

## Acceptance Criteria

- [ ] Can scroll through all transactions on main page
- [ ] Works with mouse wheel and trackpad
- [ ] No layout regression
