# BACKLOG-393: Audit Period Filter Dates Should Include Year

**Created**: 2026-01-22
**Priority**: Medium
**Category**: UI/UX
**Status**: In Progress

---

## Problem

The audit period filter message in the Messages tab shows dates without the year:
```
Showing 2251 of 2640 messages within Aug 31 - Jan 27
```

This is confusing because it's unclear which year the dates refer to, especially when the range spans across years.

## Solution

Include the year in the date format:
```
Showing 2251 of 2640 messages within Aug 31, 2025 - Jan 27, 2026
```

## Files to Modify

- Likely in `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` or related component

## Acceptance Criteria

- [ ] Audit period filter message shows full dates with year
- [ ] Format: "Month Day, Year" (e.g., "Aug 31, 2025")
