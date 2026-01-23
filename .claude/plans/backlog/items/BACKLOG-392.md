# BACKLOG-392: Desktop - Bulk Submit UI (List Page)

**Priority:** P1 (Should Have)
**Category:** ui / desktop
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~20K

---

## Summary

Add bulk submission capability to the transaction list page, allowing agents to submit multiple transactions for broker review at once.

---

## Problem Statement

Agents may have multiple completed audits ready for broker review. Submitting them one by one is tedious. A bulk submission feature lets agents:
1. Select multiple transactions from the list
2. Submit all selected in one action
3. See submission status for each in the list

---

## Proposed Solution

### Transaction List Enhancements

#### Status Column

Add a "Submission" column to the transaction list:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ □ | Address              | Type | Status | Submission      | Messages | ▼ │
├────────────────────────────────────────────────────────────────────────────┤
│ □ | 123 Oak Street       | Sale | Closed | ✓ Approved      | 15       |   │
│ ■ | 456 Maple Ave        | Buy  | Active | ⚠ Changes Req   | 12       |   │
│ ■ | 789 Pine Road        | Sale | Closed | — Not Submitted | 20       |   │
│ □ | 321 Elm Court        | Sale | Closed | ● Under Review  | 25       |   │
└────────────────────────────────────────────────────────────────────────────┘

Selected: 2 transactions                    [Submit Selected for Review]
```

#### Bulk Action Bar

When transactions are selected, show a bulk action bar:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 2 transactions selected                                                     │
│                                                                             │
│ [Submit for Review]  [Export]  [Delete]  [Clear Selection]                 │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Selection Rules

Only allow selecting transactions that are:
- `not_submitted` - Can submit
- `needs_changes` - Can resubmit
- `rejected` - Can resubmit (after fixes)

Disable selection (or show warning) for:
- `submitted` - Already pending
- `under_review` - Being reviewed
- `approved` - Already complete

### Bulk Submit Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Submit 3 Transactions for Review                  │
│─────────────────────────────────────────────────────────────────────│
│                                                                      │
│  The following transactions will be submitted:                       │
│                                                                      │
│  1. 456 Maple Ave, Santa Monica         (Resubmission)              │
│     • 12 messages, 5 attachments                                     │
│                                                                      │
│  2. 789 Pine Road, Beverly Hills        (New)                       │
│     • 20 messages, 12 attachments                                    │
│                                                                      │
│  3. 555 Cedar Lane, Pasadena            (New)                       │
│     • 8 messages, 3 attachments                                      │
│                                                                      │
│  Total: 40 messages, 20 attachments (52.4 MB)                       │
│                                                                      │
│  □ Export local copies before submitting                            │
│    □ Remember my choice                                             │
│                                                                      │
│  [Cancel]                                      [Submit All]          │
└─────────────────────────────────────────────────────────────────────┘
```

### Progress Modal

Show progress for each transaction:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Submitting Transactions...                        │
│─────────────────────────────────────────────────────────────────────│
│                                                                      │
│  456 Maple Ave        [████████████████████] ✓ Complete             │
│  789 Pine Road        [██████████░░░░░░░░░░] 50% - Uploading...     │
│  555 Cedar Lane       [░░░░░░░░░░░░░░░░░░░░] Waiting...             │
│                                                                      │
│  Overall: 1 of 3 complete                                           │
│                                                                      │
│  [Cancel Remaining]                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Results Summary

After completion:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Submission Complete                               │
│─────────────────────────────────────────────────────────────────────│
│                                                                      │
│  ✓ 456 Maple Ave        - Submitted successfully                    │
│  ✓ 789 Pine Road        - Submitted successfully                    │
│  ✗ 555 Cedar Lane       - Failed (network error)                    │
│                                                                      │
│  2 of 3 transactions submitted.                                     │
│                                                                      │
│  [Retry Failed]                                         [Close]      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/Transactions.tsx` | Add selection, status column |
| `src/components/BulkActionBar.tsx` | Extend with submission action |
| `src/components/BulkSubmitModal.tsx` | New modal component |
| `src/components/SubmissionProgressModal.tsx` | New progress component |
| `src/hooks/useBulkSubmit.ts` | New hook for batch operations |

---

## Dependencies

- BACKLOG-390: Local schema changes (status fields)
- BACKLOG-391: Single submit UI (shares components)
- BACKLOG-393: Attachment upload service
- BACKLOG-394: Transaction push service

---

## Acceptance Criteria

- [ ] Submission status column visible in transaction list
- [ ] Checkbox selection available for eligible transactions
- [ ] Bulk action bar appears when transactions selected
- [ ] Cannot select already-submitted transactions (or shows warning)
- [ ] Confirmation modal shows all selected transactions
- [ ] Progress modal shows individual progress
- [ ] Failed submissions can be retried
- [ ] Status updates in list after completion
- [ ] Cancel stops remaining submissions

---

## Technical Notes

### Sequential vs Parallel

For reliability, submit transactions **sequentially** (not parallel):
- Easier progress tracking
- Simpler error handling
- Less likely to hit rate limits
- User can cancel cleanly between items

### Error Recovery

If one submission fails:
1. Continue with remaining
2. Track failures separately
3. Allow retry of just the failed ones
4. Don't rollback successful submissions

### List Performance

With status column added:
- Use existing virtualization (if any)
- Status badge is lightweight component
- Don't fetch full submission details for list

---

## Testing Plan

1. Test selection behavior for different statuses
2. Test bulk action bar visibility
3. Test confirmation modal content
4. Test progress tracking accuracy
5. Test partial failure handling
6. Test retry functionality
7. Test cancel during submission
8. Test list updates after completion

---

## Related Items

- BACKLOG-390: Local Schema Changes (dependency)
- BACKLOG-391: Submit UI Detail Page (shares patterns)
- BACKLOG-393: Attachment Upload Service (dependency)
- BACKLOG-394: Transaction Push Service (dependency)
- SPRINT-050: B2B Broker Portal Demo
