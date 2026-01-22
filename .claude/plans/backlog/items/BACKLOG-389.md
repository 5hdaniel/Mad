# BACKLOG-389: Main Transactions Page Scroll Not Working

**Created**: 2026-01-22
**Priority**: Critical
**Category**: Bug
**Status**: Closed
**Closed**: 2026-01-22
**Resolution**: Fixed via direct commits to develop (3 attempts)

## Resolution Notes

**Root Cause**: CSS flexbox nested container issue. `flex-1` children need `min-h-0` to allow `overflow-y-auto` to work properly.

**Fix Attempts**:
1. PR #520 - Fixed `Transactions.tsx` - Wrong file (app uses TransactionList)
2. Commit 612a362 - Fixed `AppShell.tsx` - Parent container, not root cause
3. Commit ac25ed0 - Fixed `TransactionList.tsx` - **Correct fix**
   - Changed `min-h-screen` to `h-screen overflow-hidden`
   - Added `min-h-0` to scrollable content area

**Lesson Learned**: Always trace component hierarchy to find which component is actually rendered. `AppModals.tsx` renders `TransactionList`, not `Transactions`.

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
