# BACKLOG-415: Submit Modal Shows Wrong Message Count

**Created**: 2026-01-22
**Status**: Ready
**Priority**: P1 (High)
**Category**: Bug Fix
**Sprint**: SPRINT-050 (Polish)
**Estimate**: ~5K tokens

---

## Problem

The Submit for Review modal shows 0 messages even when the transaction has linked messages. The modal calculates count from `emailCommunications.length + textMessages.length` which may be empty if communications aren't fetched properly.

## Root Cause

The modal uses dynamically calculated counts from fetched arrays:
```tsx
messageCount={emailCommunications.length + textMessages.length}
```

But the TransactionCard uses stored counts:
```tsx
const textCount = transaction.text_thread_count || 0;
const emailCount = transaction.email_count || 0;
```

This inconsistency means the card shows correct counts but the modal shows 0.

## Solution

Update the Submit for Review modal to use stored counts from the transaction record instead of calculating from the communications array.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/TransactionDetails.tsx` | Change `messageCount` prop to use `transaction.text_thread_count + transaction.email_count` |

## Acceptance Criteria

- [ ] Submit modal shows correct message count matching transaction card
- [ ] Works for both text-only and email-only transactions
- [ ] Works for transactions with both types

## Related

- BACKLOG-414: Submission Service Not Including Text Messages
- SPRINT-050: B2B Broker Portal Demo
