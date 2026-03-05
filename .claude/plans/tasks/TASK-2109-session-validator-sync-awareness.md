# TASK-2109: Prevent session validator from killing UI during active iPhone sync

**Backlog:** BACKLOG-844
**Sprint:** SPRINT-110
**Status:** Pending
**Priority:** Critical
**Type:** fix

---

## Problem

`useSessionValidator.ts` polls remote session validity every 60 seconds. When it detects an invalidated session, it shows `window.alert()` then calls `onSessionInvalidated()` which triggers logout and unmounts the entire React tree.

If an iPhone sync is in progress (backup phase can take 1-2 hours), the UI unmounts but the main process `idevicebackup2` child process keeps running. The user loses all visual feedback and can't cancel.

## Solution: Defer logout until sync completes (Option A)

**SR Review determined the approach:** Use a module-level ref for cross-hook communication.

### Implementation

1. **In `src/hooks/useIPhoneSync.ts`:** Export a module-level sync state ref:
   ```typescript
   // Module-level ref (not React state) — safe in single-threaded renderer
   export const syncStateRef = { isActive: false };
   ```
   Set `syncStateRef.isActive = true` when `syncStatus` becomes `"syncing"`, and `false` when idle/complete/error.

2. **In `src/hooks/useSessionValidator.ts`:** Import `syncStateRef` and check before triggering logout:
   - When session is invalid AND `syncStateRef.isActive === true`:
     - Show a non-blocking toast: "Session expired. Logout will occur after sync completes."
     - Set a `deferredLogout` flag
     - Do NOT call `onSessionInvalidated()`
   - When session is invalid AND `syncStateRef.isActive === false`:
     - Normal logout behavior (existing code)

3. **In `src/hooks/useIPhoneSync.ts`:** When sync completes/errors/cancels, check if a deferred logout is pending and trigger it.

4. **Block new syncs after deferred logout:** Once the deferred-logout flag is set, `startSync` should refuse to start a new sync operation.

## Files to Modify

- `src/hooks/useIPhoneSync.ts` — export `syncStateRef`, update on state changes, check deferred logout on completion
- `src/hooks/useSessionValidator.ts` — import `syncStateRef`, defer logout when sync active

## Acceptance Criteria

- [ ] Session invalidation during active sync does NOT unmount the sync UI
- [ ] User is notified that session expired (toast or banner, not `window.alert`)
- [ ] Logout occurs automatically after sync completes
- [ ] Normal session invalidation (no sync running) works as before
- [ ] New sync starts are blocked after deferred logout flag is set
- [ ] Unit test for `useSessionValidator` covers the defer path
- [ ] Integration test verifies deferred logout during active sync
