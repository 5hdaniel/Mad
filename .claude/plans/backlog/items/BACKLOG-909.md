# BACKLOG-909: markAsUnderReview Fire-and-Forget With No Error Handling

## Status: Pending | Priority: Medium | Area: service

## Summary

The `markAsUnderReview` call in the submission detail page is fire-and-forget -- called without `await` and with no error logging or handling. If the Supabase update fails, the submission silently remains in its previous status while the UI shows it as "under review".

## Current Behavior

- `markAsUnderReview()` called without await
- No try/catch or .catch() handler
- Supabase update failure is completely silent
- UI may show inconsistent state

## Expected Behavior

- Add error logging at minimum (console.error or structured logging)
- Consider awaiting the call to ensure status update succeeds before rendering
- Handle failure gracefully (show error toast or retry)

## Files to Change

- `broker-portal/app/dashboard/submissions/[id]/page.tsx` -- add error handling

## Source

SR Engineer code review of Sprint 116 (Finding 13, 2026-03-07)
