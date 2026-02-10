# BACKLOG-636: Sync Status Indicator Stuck After Completion

## Priority: Medium
## Category: Bug
## Status: Pending

## Summary

The sync status indicator shows "Contacts ✓ Messages ✓" with a full green progress bar but never auto-dismisses after sync completes.

## Reproduction

1. Log in as agent@izzyrescue.org (or likely any account)
2. App performs initial sync on load
3. Sync completes successfully (contacts + 358 messages imported)
4. Sync status bar remains visible indefinitely with green checkmarks

## Root Cause (Suspected)

From the console logs, the app goes through this state sequence after sync completes:

```
status: ready        → sync completes, dismiss timer likely starts
status: unauthenticated  → brief transition during deep-link auth
status: ready        → auth resolves, app is ready again
```

The `unauthenticated` transition likely unmounts or resets the sync status component, canceling the auto-dismiss timer. When the component remounts in `ready` state, the sync data shows "complete" but no new dismiss timer is started.

## Key Files

- `SyncOrchestratorService.ts` — orchestrates sync, emits status events
- Sync status indicator component (renders the blue bar with checkmarks)
- `LoadingOrchestrator.tsx` — manages app loading phases and auth state transitions

## Acceptance Criteria

- [ ] Sync status indicator auto-dismisses after sync completes (e.g., 3-5 seconds)
- [ ] Dismiss works correctly even if auth state transitions happen during/after sync
- [ ] Manual dismiss (click to close) works as fallback
