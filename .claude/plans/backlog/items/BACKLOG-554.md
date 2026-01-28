# BACKLOG-554: Test Device Registration on First Login

**Created**: 2026-01-27
**Priority**: P2
**Type**: Testing
**Sprint Origin**: SPRINT-062 (deferred from TASK-1508)

---

## Description

Verify that device registration works correctly on first login:
- Device gets registered in `device_registrations` table in Supabase
- Device limit is enforced (trial = 1, individual = 2, team = 10)
- Attempting to login from too many devices shows DeviceLimitScreen

## Acceptance Criteria

- [ ] First login registers device in Supabase
- [ ] Device ID is unique and persistent
- [ ] Second device login works (for non-trial)
- [ ] Exceeding device limit shows appropriate error
- [ ] User can deactivate old devices to make room

## Technical Notes

- Device service: `electron/services/deviceService.ts`
- Device limit check in: `electron/services/licenseService.ts`
- UI component: `src/components/license/DeviceLimitScreen.tsx`

## Why Deferred

Core license flow (expired + transaction limit) is working. Device registration is secondary enforcement that can be tested in next sprint.
