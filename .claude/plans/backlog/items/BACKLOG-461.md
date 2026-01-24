# BACKLOG-461: "Under Review" Status When Broker Opens Submission

**Created**: 2026-01-23
**Status**: Ready
**Priority**: P1 (High)
**Category**: Feature / Status Sync
**Sprint**: -
**Estimate**: ~15K tokens

---

## Problem

Currently, when a broker opens a submission for review, the agent's desktop app may still show "Submitted" status. The user expects the status to change to "Under Review" immediately when the broker starts reviewing.

## User Story

**As a** real estate agent
**I want** to see "Under Review" status when my broker is actively reviewing my submission
**So that** I know my submission is being processed

## Current Behavior (if any)

Status progression may be:
1. `not_submitted`
2. `submitted`
3. `approved` / `rejected` / `changes_requested`

Missing: `under_review` intermediate state

## Expected Behavior

Status progression:
1. `not_submitted` - Agent hasn't submitted
2. `submitted` - Agent clicked Submit
3. `under_review` - Broker opened the submission
4. `approved` / `rejected` / `changes_requested` - Broker took action

## Implementation

### Portal Side (Trigger)

When broker opens submission detail view:
```typescript
// broker-portal/app/submissions/[id]/page.tsx
useEffect(() => {
  // Mark as under review when broker views
  await markAsUnderReview(submissionId);
}, [submissionId]);
```

### Supabase Side

```sql
-- Update submission status
UPDATE transaction_submissions
SET status = 'under_review', reviewed_at = NOW()
WHERE id = $1 AND status = 'submitted';
```

### Desktop Side (Sync)

Existing status sync (BACKLOG-395) should pick up the change on next poll/refresh.

## Files to Modify

| File | Change |
|------|--------|
| `broker-portal/app/submissions/[id]/page.tsx` | Trigger status update on view |
| `broker-portal/lib/submissions.ts` | Add `markAsUnderReview()` function |
| `supabase/migrations/XXXX_add_under_review_status.sql` | Ensure status enum includes `under_review` |
| `src/types/transaction.ts` | Add `under_review` to submission status enum |

## Status Enum Update

```typescript
type SubmissionStatus =
  | 'not_submitted'
  | 'submitted'
  | 'under_review'  // NEW
  | 'approved'
  | 'rejected'
  | 'changes_requested';
```

## Acceptance Criteria

- [ ] When broker opens submission, status changes to `under_review`
- [ ] Agent's desktop app shows "Under Review" after sync
- [ ] Status only changes if current status is `submitted`
- [ ] Multiple broker views don't reset status after action taken
- [ ] TypeScript compiles
- [ ] Tests pass

## Edge Cases

- Broker opens then closes without action -> stays `under_review`
- Multiple brokers open same submission -> first open triggers change
- Re-submission after changes requested -> goes back to `submitted`

## Dependencies

- BACKLOG-395: Desktop - Status Sync
- BACKLOG-400: Portal - Review Actions

## Related

- BACKLOG-460: Dashboard Notifications (uses this status)
