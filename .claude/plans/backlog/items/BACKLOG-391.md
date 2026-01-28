# BACKLOG-391: Desktop - Submit for Review UI (Detail Page)

**Priority:** P0 (Critical)
**Category:** ui / desktop
**Created:** 2026-01-22
**Status:** Pending
**Sprint:** SPRINT-050
**Estimated Tokens:** ~25K

---

## Summary

Add a "Submit for Review" button and workflow to the transaction detail page, allowing agents to submit individual transactions to the broker portal for compliance review.

---

## Problem Statement

Currently, transaction data stays entirely local on the agent's machine. For B2B broker compliance, agents need to:
1. Submit completed audits to their broker for review
2. See the current submission status
3. View broker feedback when changes are requested
4. Resubmit after making corrections

---

## Proposed Solution

### UI Changes

#### Transaction Detail Header

Add submission status badge and action button to the transaction detail header:

```
┌─────────────────────────────────────────────────────────────────────┐
│  123 Oak Street, Los Angeles, CA                                    │
│  Transaction: Sale | Status: Closed                                 │
│                                                                     │
│  ┌──────────────────┐   ┌──────────────────────────────────────┐   │
│  │ Submission:      │   │ [Submit for Review]     [Edit] [Export] │
│  │ Not Submitted    │   │ (or [View Submission] if submitted)    │
│  └──────────────────┘   └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Status Badge Colors

| Status | Color | Icon |
|--------|-------|------|
| `not_submitted` | Gray | - |
| `submitted` | Blue | Clock |
| `under_review` | Yellow | Eye |
| `needs_changes` | Orange | Warning |
| `resubmitted` | Blue | Refresh |
| `approved` | Green | Check |
| `rejected` | Red | X |

#### Submit Modal

When clicking "Submit for Review":

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Submit Transaction for Review                     │
│─────────────────────────────────────────────────────────────────────│
│                                                                      │
│  Property: 123 Oak Street, Los Angeles, CA                          │
│                                                                      │
│  This submission will include:                                       │
│  • 15 email messages                                                 │
│  • 8 text messages                                                   │
│  • 12 attachments (34.2 MB)                                         │
│                                                                      │
│  ⚠️  Your broker will be able to view all communications            │
│     and documents attached to this transaction.                      │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │ □ Export a local copy before submitting                    │      │
│  │   □ Remember my choice                                     │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                      │
│  [Cancel]                                      [Submit for Review]   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Review Notes Display

When status is `needs_changes`, show broker feedback prominently:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  Changes Requested by Broker                                    │
│─────────────────────────────────────────────────────────────────────│
│  "Missing inspection report. Please upload and resubmit."           │
│                                                                      │
│  Reviewed by: Carol (Broker) on Jan 21, 2026                        │
│                                                                      │
│  [Resubmit for Review]                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Validation Before Submit

Check before allowing submission:
1. Transaction has at least one contact assigned
2. Transaction has a property address
3. Transaction has start date set
4. At least one message or attachment attached

### Submit Flow

1. User clicks "Submit for Review"
2. Show confirmation modal with summary
3. If "export local copy" checked, trigger export first
4. Call submission service (BACKLOG-394)
5. Show progress indicator
6. Update local `submission_status` to `submitted`
7. Show success message

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/transactionDetailsModule/TransactionDetailsTab.tsx` | Add status badge, submit button |
| `src/components/transactionDetailsModule/components/SubmitForReviewModal.tsx` | New modal component |
| `src/components/transactionDetailsModule/components/ReviewNotesPanel.tsx` | New component for broker feedback |
| `src/components/transactionDetailsModule/components/SubmissionStatusBadge.tsx` | New badge component |
| `src/hooks/useSubmitForReview.ts` | New hook for submission logic |

---

## Dependencies

- BACKLOG-390: Local schema changes (submission_status fields)
- BACKLOG-393: Attachment upload service (uploads files first)
- BACKLOG-394: Transaction push service (actually submits)

---

## Acceptance Criteria

- [ ] "Submit for Review" button visible on transaction detail
- [ ] Button disabled with tooltip if validation fails
- [ ] Confirmation modal shows accurate counts
- [ ] Export option works before submission
- [ ] "Remember my choice" persists preference
- [ ] Progress indicator during upload
- [ ] Status badge updates after submission
- [ ] Review notes display when status is `needs_changes`
- [ ] "Resubmit" option available after changes requested
- [ ] Status colors match design spec

---

## Technical Notes

### Organization Context

The submission needs the user's organization ID. This should come from:
1. User's organization membership (stored after login)
2. Or: Fetch from Supabase on first submission

For demo, can store org_id in user preferences after first successful auth.

### Error Handling

| Error | User Message | Action |
|-------|--------------|--------|
| Network offline | "No internet connection" | Retry button |
| Upload failed | "Upload failed. Retry?" | Retry/Cancel |
| Auth expired | "Session expired" | Re-authenticate |
| Already submitted | "Transaction already under review" | Show status |

### State Management

Use local React state for modal, but persist submission status to database immediately after successful submit.

---

## UI Mockups

### Status Badge States

```
[ Not Submitted ]    - gray background
[ Submitted ]        - blue background, clock icon
[ Under Review ]     - yellow background, eye icon  
[ Changes Requested ] - orange background, warning icon
[ Approved ✓ ]       - green background, check icon
[ Rejected ✗ ]       - red background, x icon
```

### Button State Logic

```typescript
const getButtonConfig = (status: SubmissionStatus) => {
  switch (status) {
    case 'not_submitted':
      return { text: 'Submit for Review', disabled: false };
    case 'submitted':
    case 'under_review':
      return { text: 'View Submission', disabled: false };
    case 'needs_changes':
      return { text: 'Resubmit for Review', disabled: false };
    case 'approved':
    case 'rejected':
      return { text: 'View Submission', disabled: false };
    case 'resubmitted':
      return { text: 'View Submission', disabled: false };
  }
};
```

---

## Testing Plan

1. Test button visibility on transaction detail
2. Test validation prevents submit when missing required data
3. Test confirmation modal content accuracy
4. Test export before submit option
5. Test progress indicator during upload
6. Test status updates after success
7. Test error handling for network failures
8. Test review notes display
9. Test resubmit flow

---

## Related Items

- BACKLOG-390: Local Schema Changes (dependency)
- BACKLOG-392: Bulk Submit UI (similar pattern)
- BACKLOG-393: Attachment Upload Service (dependency)
- BACKLOG-394: Transaction Push Service (dependency)
- BACKLOG-395: Status Sync (updates status)
- SPRINT-050: B2B Broker Portal Demo
