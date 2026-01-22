# BACKLOG-388: Transaction Card Label Says "emails" but Should Say "email threads"

**Created**: 2026-01-22
**Priority**: Medium
**Category**: Bug/UI
**Status**: Closed
**Closed**: 2026-01-22
**Resolution**: Fixed via PR #519

---

## Problem

On the Transactions list page, the transaction cards show "X emails" but this is actually counting **email threads**. The count is correct, but the label is wrong.

### Current (Incorrect Label)

**Transaction Card:**
```
571 Dale Dr, Incline Village, NV 89451, USA
📧 6 emails    ← Wrong label, it's actually 6 threads
```

**Transaction Details (Correct):**
```
Email Threads (6)    ← Correctly labeled
```

## Fix

Change the label from "X emails" to "X email threads":

```html
<!-- Before -->
<span>6 emails</span>

<!-- After -->
<span>6 email threads</span>
```

## Acceptance Criteria

- [ ] Transaction card shows "X email threads" instead of "X emails"
- [ ] Consistent terminology between card and detail view
- [ ] Count remains the same (threads, not individual emails)

## Files Likely Affected

- `src/components/TransactionCard.tsx` or similar
- `src/components/TransactionList.tsx`

## Related

- Transaction details tabs use "Email Threads (X)" - should match
