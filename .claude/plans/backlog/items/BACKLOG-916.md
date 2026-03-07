# BACKLOG-916: getActiveDevices Not Impersonation-Aware

## Status: Pending | Priority: Low | Area: service

## Summary

The `getActiveDevices` read action in the broker portal fails silently during impersonation because there is no authenticated user. Currently unreachable since the Settings page is blocked during impersonation, but if BACKLOG-898 (read-only Settings) is implemented, this would become a visible issue.

## Current Behavior

- `getActiveDevices()` assumes an authenticated user exists
- During impersonation, auth user is null, action fails silently
- Currently unreachable because Settings page is blocked during impersonation

## Expected Behavior

- No immediate action required
- Document the dependency: if Settings becomes visible during impersonation (BACKLOG-898), this action needs impersonation awareness
- When implementing BACKLOG-898, either skip the devices section or resolve target user for the query

## Files to Change

- `broker-portal/lib/actions/getActiveDevices.ts` -- future: add impersonation awareness

## Related

- BACKLOG-898 (read-only Settings during impersonation)

## Source

SR Engineer code review of Sprint 116 (Finding 20, 2026-03-07)
