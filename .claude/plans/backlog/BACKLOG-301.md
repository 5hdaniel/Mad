# BACKLOG-301: Refactor Sync Coordination with SyncScheduler Service

## Status: OPEN
## Priority: Medium
## Category: Technical Debt / Architecture
## Created: 2026-01-17

---

## Problem Statement

Currently, background sync operations are triggered by multiple independent hooks with overlapping responsibilities:

1. `useMacOSMessagesImport` - dedicated macOS Messages import (2000ms delay)
2. `useAutoRefresh` - general sync for emails, messages, contacts (2500ms delay)

Both hooks have their own module-level guards, but they weren't coordinated, causing duplicate sync triggers. The current fix uses cross-hook flag exports (`hasMessagesImportTriggered()`), which works but creates:

- Hidden coupling between hooks
- Order dependency (relies on 500ms timing gap)
- Testing complexity with module-level state
- Difficulty adding new sync sources

## Proposed Solution

Implement a **SyncScheduler Service** pattern:

```
                SyncScheduler (singleton service)
                      |
    +--------+--------+--------+--------+
    |        |        |        |        |
 emails   messages  contacts  (future sources)
```

### Architecture

1. **SyncScheduler.ts** - Pure TypeScript singleton service (not a React hook)
   - Tracks registered sync operations
   - Prevents duplicate runs via internal state
   - Exposes `request(type)`, `isRunning(type)`, `hasRun(type)`
   - Handles sync priorities and dependencies

2. **useSyncScheduler.ts** - Thin React hook wrapper
   - Subscribes to SyncScheduler for React components
   - Returns sync status for UI

3. **Migration** - Existing hooks delegate to SyncScheduler
   - `useMacOSMessagesImport` → `scheduler.request('messages')`
   - `useAutoRefresh` → `scheduler.request('emails')`, etc.

### Benefits

- Single source of truth for sync state
- No cross-hook flag exports
- Easy to add new sync sources (iPhone backup, cloud sync)
- Easy to implement sync dependencies
- Testable in isolation (no React required)

## Files Affected

- `src/services/sync/SyncScheduler.ts` (new)
- `src/hooks/useSyncScheduler.ts` (new)
- `src/hooks/useMacOSMessagesImport.ts` (refactor)
- `src/hooks/useAutoRefresh.ts` (refactor)
- `src/appCore/BackgroundServices.tsx` (minor updates)

## Implementation Phases

| Phase | Action | Risk | Effort |
|-------|--------|------|--------|
| 1 | Create SyncScheduler service | Low | ~15K tokens |
| 2 | Create useSyncScheduler hook | Low | ~10K tokens |
| 3 | Migrate useMacOSMessagesImport | Medium | ~15K tokens |
| 4 | Migrate useAutoRefresh | Medium | ~20K tokens |
| 5 | Deprecate cross-hook flags | Low | ~5K tokens |

**Total Estimate:** ~65K tokens

## Acceptance Criteria

- [ ] SyncScheduler service created with full test coverage
- [ ] All sync operations routed through SyncScheduler
- [ ] No duplicate sync triggers on dashboard load
- [ ] Cross-hook flag exports removed
- [ ] Existing tests still pass
- [ ] UI sync indicator works correctly

## Dependencies

None - this is a pure refactor with no feature changes.

## Related Items

- TASK-1113: Fix Duplicate macOS Messages Sync (immediate fix)
- BACKLOG-293: Duplicate macOS Messages Sync (original bug report)

## Notes

- SR Engineer recommendation from architectural review
- Should be completed before adding new sync sources (iPhone backup, Supabase cloud sync)
- Current flag-based approach is acceptable short-term

---

## SR Engineer Review

**Status:** Pending
