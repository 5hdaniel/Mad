# BACKLOG-451: Show "Submitted for Review" Date in Transaction Overview

**Priority:** P2 (Medium)
**Category:** feature / ui
**Created:** 2026-01-23
**Status:** Pending
**Estimated Tokens:** ~5K

---

## Summary

When a transaction has been submitted for broker review, display the submission date in the Overview tab alongside or instead of the export history.

---

## Problem Statement

Currently, when viewing a transaction that has been submitted for review:
- The Overview tab shows "Last exported: [date]" for exports
- There's no indication of when the transaction was submitted for broker review
- Users with team licenses can't export after submission, so the export history section may be irrelevant

---

## Proposed Solution

Add a "Submitted for Review" section in the Overview tab:

```tsx
{transaction.submitted_at && (
  <div className="submission-info">
    <span className="label">Submitted for Review:</span>
    <span className="date">{formatDate(transaction.submitted_at)}</span>
    {transaction.submitted_status && (
      <span className="status-badge">{transaction.submitted_status}</span>
    )}
  </div>
)}
```

### Display Logic

| State | Display |
|-------|---------|
| Not submitted | Show export options/history only |
| Submitted, pending review | "Submitted for Review: Jan 23, 2026 - Pending" |
| Submitted, approved | "Submitted for Review: Jan 23, 2026 - Approved" |
| Submitted, needs changes | "Submitted for Review: Jan 23, 2026 - Changes Requested" |

---

## Data Requirements

The `transactions` table should have:
- `submitted_at` - Timestamp of submission
- `submitted_status` - Current review status from broker

These may already exist or need to be synced from Supabase.

---

## Acceptance Criteria

- [ ] "Submitted for Review" date visible in Overview when transaction is submitted
- [ ] Status badge shows current review state
- [ ] Date formatted consistently with other dates in app
- [ ] Works with data synced from broker portal

---

## Related Items

- BACKLOG-XXX: Allow agents to export after submission (team license)
- SPRINT-050: B2B Broker Portal

