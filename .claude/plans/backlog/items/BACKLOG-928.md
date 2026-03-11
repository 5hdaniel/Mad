# BACKLOG-928: iPhone Sync Button Hidden on macOS When Import Source Set to iPhone Sync

> Renumbered from BACKLOG-924 (duplicate ID -- BACKLOG-924 is also used for Plan Administration UI).

**Type:** Bug
**Area:** UI
**Priority:** High
**Status:** Testing
**Created:** 2026-03-11
**Sprint:** SPRINT-125
**Estimated Effort:** ~15K tokens

---

## Summary

When a macOS user sets their Import Source to "iPhone Sync" in Settings, no sync button appears on the Dashboard. The `AppRouter.tsx:133` condition only checks `isWindows && selectedPhoneType === "iphone"`, ignoring macOS users who have explicitly opted into iPhone sync via the import source preference.

## Fix

1. Surface `importSource` preference in `useAppStateMachine.ts`
2. Update `AppRouter.tsx:133` condition to also check `(isMacOS && importSource === "iphone-sync")`
3. Update `Dashboard.tsx` comment on `onSyncPhone` prop
4. Optionally update `platform.ts` platformFeatures

## Files

- `src/appCore/AppRouter.tsx`
- `src/appCore/state/useAppStateMachine.ts`
- `src/components/Dashboard.tsx`
- `src/utils/platform.ts`
