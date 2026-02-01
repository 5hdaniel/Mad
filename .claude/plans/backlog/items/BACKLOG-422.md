# BACKLOG-422: Broker Portal - Review Actions Not Working

**Created**: 2026-01-22
**Status**: Ready
**Priority**: P0 (Critical)
**Category**: Bug Fix
**Sprint**: SPRINT-050
**Estimate**: ~20K tokens

---

## Problem

Review actions on the broker portal are not functioning:

1. **Reject Submission**: Clicking "Yes" on the confirmation dialog does nothing
2. **Request Changes**: Shows error "Failed to submit review. Please try again."

## Symptoms

### Reject Flow
- Broker clicks "Reject"
- Confirmation dialog appears
- Clicking "Yes, Reject Submission" does nothing
- Dialog stays open, no status change

### Request Changes Flow
- Broker clicks "Request Changes"
- Enters feedback text
- Clicks submit
- Error: "Failed to submit review. Please try again."

## Investigation Needed

1. Check browser console for errors
2. Check network tab for failed API requests
3. Verify Supabase RLS allows broker to UPDATE submissions
4. Check if `reviewed_by`, `reviewed_at`, `review_notes` columns exist
5. Verify the update query in the portal

## Likely Causes

- RLS policy blocking UPDATE for brokers
- Missing broker role in organization_members
- Column name mismatch between code and schema
- Supabase client not authenticated properly

## Files to Check

- `broker-portal/app/dashboard/submissions/[id]/page.tsx`
- `broker-portal/components/ReviewActions.tsx`
- `broker-portal/lib/supabase.ts`
- `supabase/migrations/20260122_b2b_broker_portal.sql` (RLS policies)

## Acceptance Criteria

- [ ] Reject action updates submission status to 'rejected'
- [ ] Request Changes action updates status to 'needs_changes' with notes
- [ ] Approve action updates status to 'approved'
- [ ] Agent sees updated status on desktop app

## Related

- BACKLOG-419: Audit and Restore RLS Policies
- BACKLOG-400: Portal - Review Actions (original implementation)
