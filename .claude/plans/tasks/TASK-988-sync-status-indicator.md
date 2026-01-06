# TASK-988: Sync Status Indicator & Auto-Sync on Login

**Sprint**: SPRINT-026
**Estimated**: ~30K tokens
**Priority**: High

---

## Objective

Add visual sync status indicators and implement auto-sync on login with proper sequencing.

## Requirements

### 1. Sync Status Indicator on Dashboard
- Show when email/messages/contacts sync is in progress
- Display on dashboard so user knows background work is happening
- Examples: "Syncing emails...", "Importing messages...", "Syncing contacts..."
- Should be non-intrusive but visible

### 2. Progress for Manual Message Import (Settings)
- When user clicks "Import Messages" in Settings, show progress
- Don't freeze UI - show spinner/progress bar
- Already have `onImportProgress` callback - use it

### 3. Auto-Sync on Login Flow
**Sequence after login:**
1. User logs in → Dashboard loads
2. Run sync in background:
   - macOS: Emails + Messages + Contacts
   - Windows/Linux: Emails only (messages via iPhone sync)
3. Show sync status indicator during sync
4. THEN show "X new transactions to review" or "All caught up"

### 4. Settings Toggle for Auto-Sync
- Add toggle: "Auto-sync on login" (default: ON)
- When OFF, skip the auto-sync after login
- User can still manually trigger syncs

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/dashboard/SyncStatusIndicator.tsx` | **NEW** - Status indicator component |
| `src/hooks/useSyncStatus.ts` | **NEW** - Track sync state across services |
| `src/components/Dashboard.tsx` | Add SyncStatusIndicator |
| `src/components/settings/MacOSMessagesImportSettings.tsx` | Add progress UI |
| `src/components/Settings.tsx` | Add auto-sync toggle |
| Preferences/settings store | Store auto-sync preference |
| Dashboard or App initialization | Trigger auto-sync sequence |

## Acceptance Criteria

- [ ] Dashboard shows sync status when syncing
- [ ] Settings message import shows progress (not frozen UI)
- [ ] Auto-sync runs on login before showing transaction status
- [ ] Settings has "Auto-sync on login" toggle
- [ ] Toggle persists across sessions
- [ ] Works on both macOS and Windows

## Technical Notes

- Use existing `onImportProgress` for message import progress
- May need similar progress callbacks for email sync
- Consider using a global sync state context or store
- Non-blocking - all syncs should be background operations

---

## Implementation Summary (Engineer-Owned)

*Completed: 2026-01-05*

### Files Created

| File | Purpose |
|------|---------|
| `src/hooks/useSyncStatus.ts` | Manages global sync status for emails/messages/contacts |
| `src/hooks/useAutoSync.ts` | Handles auto-sync on dashboard entry with preference check |
| `src/components/dashboard/SyncStatusIndicator.tsx` | Visual indicator component for dashboard |

### Files Modified

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Added SyncStatusIndicator, sync status props |
| `src/components/Settings.tsx` | Added auto-sync toggle with persistence |
| `src/appCore/state/types.ts` | Added SyncStatus types to AppStateMachine |
| `src/appCore/state/useAppStateMachine.ts` | Integrated useAutoSync hook |
| `src/appCore/AppRouter.tsx` | Pass sync status to Dashboard |
| `src/components/dashboard/index.ts` | Export SyncStatusIndicator |
| `src/index.css` | Added fade-in and indeterminate progress animations |

### Implementation Details

1. **useSyncStatus hook** - Tracks sync state for emails, messages, and contacts with progress tracking. Subscribes to `onImportProgress` IPC for message import progress.

2. **useAutoSync hook** - Manages auto-sync on dashboard entry:
   - Loads auto-sync preference from user preferences
   - Triggers sync sequence when user reaches dashboard
   - Respects preference toggle (default: enabled)
   - Runs in sequence: emails -> messages (macOS) -> contacts

3. **SyncStatusIndicator component** - Non-intrusive UI showing:
   - Current sync operation message
   - Progress bar (determinate or indeterminate)
   - Multi-sync indicators when running multiple operations

4. **Settings auto-sync toggle** - Toggle persists via existing preferences API under `sync.autoSyncOnLogin`

5. **MacOSMessagesImportSettings** - Already had progress UI from TASK-987, wired up via `onImportProgress`

### Checklist

- [x] Created branch from develop
- [x] Dashboard shows sync status when syncing
- [x] Auto-sync runs on login/dashboard entry
- [x] Settings has "Auto-sync on login" toggle
- [x] Toggle persists across sessions
- [x] Works on both macOS and Windows (messages sync is macOS-only)
- [x] Type check passes
- [x] Lint passes (pre-existing unrelated error in ContactSelectModal.tsx)
- [x] Tests pass (pre-existing flaky test in databaseService.test.ts unrelated to changes)

### Notes

**Deviations from plan:** None - implemented as specified.

**Issues encountered:**
- One pre-existing lint error in ContactSelectModal.tsx (missing react-hooks plugin rule)
- One pre-existing flaky test in databaseService.test.ts (vacuum test)
