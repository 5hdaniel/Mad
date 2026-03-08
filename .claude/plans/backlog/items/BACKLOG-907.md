# BACKLOG-907: Impersonation Bypasses Role-Based Nav Visibility

## Status: Pending | Priority: Medium | Area: ui

## Summary

During impersonation, the `user` object is null (since the admin is not authenticated as the target user), so role checks in the dashboard layout show incorrect navigation items. If impersonating an `it_admin` user, the admin might see dashboard/submissions nav items that the `it_admin` role does not actually have access to, or miss items they should see.

## Current Behavior

- During impersonation, `user` is null
- Role-based nav checks fail or show default nav items
- Nav does not match what the target user would actually see
- Related to BACKLOG-898 (read-only views)

## Expected Behavior

- Resolve the target user's role during impersonation
- Use target user's role for nav visibility checks
- Admin sees exactly the same nav items the target user would see
- Write actions still blocked per impersonation guards

## Files to Change

- `broker-portal/app/dashboard/layout.tsx` -- resolve target user role during impersonation

## Estimate

~4K tokens

## Related

- BACKLOG-898 (read-only Users/Settings during impersonation)

## Source

SR Engineer code review of Sprint 116 (Finding 10, 2026-03-07)
