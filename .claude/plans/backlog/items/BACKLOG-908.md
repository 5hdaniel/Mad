# BACKLOG-908: Organization Lookup Duplicated Across 3 Pages

## Status: Pending | Priority: Medium | Area: service

## Summary

The same organization ID lookup pattern (checking impersonation session for target org, falling back to authenticated user's org) is duplicated across the dashboard page, submissions page, and submission detail page. This should be extracted into a shared helper function in `impersonation-guards.ts`.

## Current Behavior

- Same org_id resolution logic copied in 3 places
- Each copy slightly different in error handling
- Changes to impersonation org resolution require updating 3 files

## Expected Behavior

- Single `getTargetOrganizationId()` helper in `impersonation-guards.ts`
- All 3 pages call the shared helper
- Consistent error handling and fallback behavior

## Files to Change

- `broker-portal/lib/impersonation-guards.ts` -- add `getTargetOrganizationId()` helper
- `broker-portal/app/dashboard/page.tsx` -- use shared helper
- `broker-portal/app/dashboard/submissions/page.tsx` -- use shared helper
- `broker-portal/app/dashboard/submissions/[id]/page.tsx` -- use shared helper

## Source

SR Engineer code review of Sprint 116 (Finding 12, 2026-03-07)
