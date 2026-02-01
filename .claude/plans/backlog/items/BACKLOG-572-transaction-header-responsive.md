# BACKLOG-572: Transaction Header Responsive Improvements

## Summary
Prevent Export button from wrapping under X button by making header always use row layout.

## Problem
On narrower viewports, the Export button would wrap to a new line under the X close button, creating awkward layout.

## Solution
1. Changed from responsive column/row (`flex-col sm:flex-row`) to always row (`flex-row flex-nowrap`)
2. Split address into two lines (street / city, state, zip) to save horizontal space
3. Added `overflow-hidden` and `min-w-0` to title section so it truncates instead of pushing buttons
4. Buttons section has `flex-shrink-0` so it never shrinks
5. Simplified to single close button (removed mobile/desktop variants)

## Files Modified
- `src/components/transactionDetailsModule/components/TransactionHeader.tsx`

## Status
Completed - Sprint 066
