# BACKLOG-914: Self-Impersonation Button Hidden Instead of Disabled With Tooltip

## Status: Pending | Priority: Low | Area: ui

## Summary

When viewing your own user profile in the admin portal, the `isOwnProfile` check causes the ImpersonateButton component to return null silently. The user gets no feedback about why the button is missing. A disabled button with a tooltip ("Cannot impersonate yourself") would be more informative.

## Current Behavior

- `isOwnProfile` check returns null (button completely hidden)
- No user feedback explaining why impersonation is unavailable
- Could be confusing for new admins

## Expected Behavior

- Show disabled button with tooltip: "Cannot impersonate yourself"
- Consistent with other disabled-action patterns in the admin portal

## Files to Change

- `admin-portal/app/dashboard/users/[id]/components/ImpersonateButton.tsx` -- show disabled button with tooltip

## Source

SR Engineer code review of Sprint 116 (Finding 18, 2026-03-07)
