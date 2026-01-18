# BACKLOG-293: Duplicate macOS Messages Sync on Dashboard Load

**Created:** 2026-01-16
**Priority:** Medium
**Type:** Bug
**Status:** Open

---

## Summary

Returning users see the macOS Messages sync running twice when opening the dashboard. The sync appears to trigger redundantly, processing 678K+ messages twice in a row.

---

## Observed Behavior

User reported seeing sync logs appear twice on initial dashboard load:

```
[1] 2026-01-17T01:31:18.141Z INFO  [MacOSMessagesImportService] Fetched 678041 messages and 62952 attachments in macOS Messages
[1] 2026-01-17T01:31:18.141Z INFO  [MacOSMessagesImportService] Loading existing message IDs for deduplication...
[1] 2026-01-17T01:31:23.144Z INFO  [MacOSMessagesImportService] Found 675014 existing messages
[1] 2026-01-17T01:31:23.144Z INFO  [MacOSMessagesImportService] Processing 678041 messages in 1357 batches
[1] 2026-01-17T01:31:23.631Z INFO  [MacOSMessagesImportService] Processing 62952 attachments, 28871 already stored
```

This indicates the full sync process is being triggered multiple times for returning users.

---

## Expected Behavior

- Sync should only trigger once on dashboard load
- If sync was recently completed, should use cached/last sync state
- Deduplication should prevent redundant processing, but the sync shouldn't even start twice

---

## Potential Causes

1. **React StrictMode double-mount** (dev only) - Effects run twice in development
2. **Multiple sync triggers** - Sync may be called from:
   - Login completion handler
   - Dashboard mount effect
   - BackgroundServices component
3. **Race condition** - Multiple components checking "should sync" before any sync starts
4. **Missing sync-in-progress guard** - No mutex/lock preventing concurrent syncs

---

## Investigation Areas

1. Check `BackgroundServices` component for sync trigger logic
2. Check `useAppStateMachine` for state transitions that trigger sync
3. Check if `MacOSMessagesImportService` has a "sync in progress" guard
4. Review useEffect dependencies in dashboard-related components

---

## Files to Investigate

- `src/appCore/BackgroundServices.tsx`
- `src/hooks/useAppStateMachine.ts`
- `electron/services/MacOSMessagesImportService.ts`
- `src/screens/Dashboard.tsx`

---

## Acceptance Criteria

- [ ] Sync triggers exactly once on dashboard load for returning users
- [ ] Sync-in-progress state prevents duplicate sync triggers
- [ ] No regression in initial sync for new users
- [ ] Performance: 678K messages shouldn't be fetched/processed twice
