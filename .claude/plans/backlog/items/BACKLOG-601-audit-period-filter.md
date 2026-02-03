# BACKLOG-601: Audit Period Filter Checkbox Not Working - Invalid Date

## Summary

The checkbox to filter messages by audit period doesn't work. When enabled, no messages are filtered because the date comparison always fails due to Invalid Date.

## Problem

The filter checkbox is supposed to show only messages within the transaction's audit period (start date to end date). However, when the checkbox is checked, the filtering silently fails and shows all messages regardless.

## Root Cause

`new Date(auditStartDate)` returns Invalid Date (NaN) when the date string format is incompatible. When comparing dates, `NaN < anyDate` and `NaN > anyDate` both return false, so all messages pass through the filter.

## Technical Details

```javascript
// Current code (broken)
const startDate = new Date(auditStartDate);  // Returns Invalid Date
const messageDate = new Date(message.sent_at);
if (messageDate >= startDate && messageDate <= endDate) { ... }
// NaN >= anything = false, so filter fails
```

```javascript
// Fixed code
const startDate = new Date(auditStartDate);
if (isNaN(startDate.getTime())) {
  // Handle invalid date - either skip filtering or log error
}
```

## Files to Modify

1. `src/components/transaction/TransactionMessagesTab.tsx` (lines ~151-152)
   - Add date validation with `isNaN(d.getTime())` check
   - Handle invalid date case gracefully

2. `src/components/transaction/ConversationViewModal.tsx`
   - Same date validation pattern

## Acceptance Criteria

- [ ] Filter checkbox actually filters messages by audit period
- [ ] Invalid dates are handled gracefully (not silently ignored)
- [ ] Diagnostic logging added to track date parsing issues
- [ ] Messages outside audit period are hidden when checkbox is enabled
- [ ] Messages inside audit period are shown when checkbox is enabled

## Priority

**HIGH** - User-facing bug affecting core filtering functionality

## Estimated Tokens

~10K (moderate complexity - date handling + testing)

## Created

2026-02-02 (discovered during SPRINT-068 testing)
