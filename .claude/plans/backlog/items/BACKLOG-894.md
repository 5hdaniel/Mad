# BACKLOG-894: Replace Service-Role Client with Scoped RLS for Impersonation

## Status: Pending | Priority: High | Area: security

## Summary

During impersonation, `getDataClient()` returns a `createServiceClient()` that bypasses ALL RLS policies. The `target_user_id` is only used for manual query filtering (e.g., `.eq('user_id', targetUserId)`), not RLS enforcement.

If any page forgets to filter by `targetUserId`, it could expose data from all users/organizations. The manual filtering is spread across multiple page files, each responsible for correctly applying the filter.

## Recommended Fix

Instead of the service-role client, use Postgres session variables:

1. Create a function that sets `SET LOCAL app.impersonated_user_id = <target_user_id>`
2. Add RLS policies that check `current_setting('app.impersonated_user_id', true)` as a fallback
3. This ensures even if a page forgets to filter, RLS still restricts data access

At minimum, add integration tests verifying every `getDataClient()` consumer filters by `targetUserId`.

## Files Affected

- `broker-portal/lib/impersonation-guards.ts` — `getDataClient()`
- `broker-portal/app/dashboard/page.tsx`
- `broker-portal/app/dashboard/submissions/page.tsx`
- `broker-portal/app/dashboard/submissions/[id]/page.tsx`
- All other dashboard pages using `getDataClient()`

## Source

SR Engineer security review of Sprint 116 (2026-03-07)
