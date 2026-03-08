# BACKLOG-898: Impersonation Should Show Read-Only Views of Users and Settings Tabs

## Status: Pending | Priority: High | Area: ui

## Summary

During impersonation, the Users and Settings nav links are completely hidden (`!isImpersonating` guard in `layout.tsx` line 90). Direct URL access to `/dashboard/users` and `/dashboard/settings` redirects back to `/dashboard`.

The support user should be able to **see** these pages (to match the target user's experience) but all write actions should be blocked:

- Users page: view user list, but "Invite User", "Remove", "Change Role" buttons disabled/hidden
- Settings page: view current settings, but all form fields disabled, save buttons hidden

## Current Behavior

- Nav links hidden during impersonation
- Direct URL access redirects to `/dashboard`

## Expected Behavior

- Nav links visible during impersonation (same as target user would see)
- Pages render in read-only mode — data visible, write controls disabled
- Attempting any write action shows "Read-only during support session" message

## Files to Change

- `broker-portal/app/dashboard/layout.tsx` — remove `!isImpersonating` from nav guard (line 90)
- `broker-portal/app/dashboard/users/page.tsx` — remove redirect, add read-only rendering
- `broker-portal/app/dashboard/settings/page.tsx` — remove redirect, add read-only rendering
- `broker-portal/app/dashboard/settings/scim/page.tsx` — remove redirect, add read-only rendering
- Write action guards in `lib/impersonation-guards.ts` remain in place as server-side defense

## Source

QA testing of Sprint 116 (2026-03-07) — TEST-116-003 finding
