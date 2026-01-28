# BACKLOG-555: Test Offline Grace Period (24 Hours)

**Created**: 2026-01-27
**Priority**: P3
**Type**: Testing
**Sprint Origin**: SPRINT-062 (deferred from TASK-1508)

---

## Description

Verify that the offline grace period works correctly:
- License status is cached locally
- App continues to work for 24 hours without network
- After 24 hours, app requires re-validation
- Cache is refreshed on successful network connection

## Acceptance Criteria

- [ ] License cached locally after successful validation
- [ ] App works offline using cached license
- [ ] 24-hour expiry enforced on cache
- [ ] Expired cache blocks app until network available
- [ ] Cache refreshed automatically when online

## Test Steps

1. Login and validate license (online)
2. Disconnect network
3. Restart app - should work (cached)
4. Wait 24+ hours (or manually expire cache)
5. Restart app - should block with "Network required" message
6. Reconnect network - should auto-refresh and work

## Technical Notes

- Cache implementation in: `electron/services/licenseService.ts`
- Cache duration: 24 hours (86400000ms)
- Storage: Local SQLite or electron-store

## Why Deferred

Requires manual time manipulation or waiting 24 hours. Core license flow is working. This is edge case handling for offline users.
