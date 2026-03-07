# TASK-2116: Persistent sync status bar (replaces modal)

**Backlog:** BACKLOG-847
**Sprint:** SPRINT-114
**Status:** Completed
**Priority:** High
**Type:** feature

---

## Problem

iPhone sync progress is shown in a full-screen modal (`IPhoneSyncModal.tsx`) that blocks all app interaction. Users cannot navigate to dashboard, settings, or other screens during long syncs (which can take 30+ minutes for large backups).

## Solution

Add a persistent, non-blocking status bar that shows sync progress from any screen. The modal remains for the initial setup flow (device connection, password prompts) but once syncing starts, progress moves to the status bar.

## Architecture

### New Components

1. **`SyncStatusBar.tsx`** — Persistent bar component
   - Renders in `AppShell.tsx` (between offline banner and content area)
   - Shows: phase icon, phase name, progress bar, bytes/files counts, cancel button
   - Compact by default (~48px height), expandable on click for full details
   - Only visible when `syncStatus === "syncing"` or briefly after completion/error

2. **`useSyncStatusBar.ts`** (optional) — If needed to manage expand/collapse and auto-dismiss state

### Modified Components

3. **`AppShell.tsx`** — Add `SyncStatusBar` between offline banner and scrollable content
4. **`IPhoneSyncModal.tsx`** — Auto-close modal when sync enters `backing_up` phase (progress moves to status bar)
5. **`IPhoneSyncFlow.tsx`** — May need adjustment for modal-close-during-sync behavior

### NOT Modified (reuse as-is)

- `useIPhoneSync.ts` — Already exposes all needed state (syncStatus, progress, cancelSync)
- `SyncProgress.tsx` — Reference for progress display logic, but status bar has its own compact layout

## Design Spec

### Compact State (default during sync)
```
┌──────────────────────────────────────────────────────────┐
│ 📱 Exporting iPhone data...  ████████░░░░ 67%  │ Cancel │
│    142 MB transferred · 1,204 files              │        │
└──────────────────────────────────────────────────────────┘
```

### Completion State (auto-dismiss after 5s)
```
┌──────────────────────────────────────────────────────────┐
│ ✓ iPhone sync complete · 2,847 messages imported │  ✕    │
└──────────────────────────────────────────────────────────┘
```

### Error State (manual dismiss)
```
┌──────────────────────────────────────────────────────────┐
│ ⚠ iPhone sync failed: Device disconnected       │  ✕    │
└──────────────────────────────────────────────────────────┘
```

## Implementation Notes

- Use the existing `useIPhoneSync` hook — it already has all the state needed
- Follow the pattern from `SyncStatusIndicator.tsx` (dashboard email sync status) for styling conventions
- The status bar should use Tailwind classes consistent with the app's design system
- For the progress bar, reuse the same indeterminate/determinate logic from `SyncProgress.tsx`
- `backing_up` phase = indeterminate (no reliable total), `extracting`/`storing` = determinate
- The modal should still handle: device connection, password prompts, passcode waiting
- Once `progress.phase` transitions to `backing_up`, the modal auto-closes and status bar takes over
- Completion/error can show in both status bar (persistent) and optionally the modal (if user reopens it)

## Key Files to Read

- `src/hooks/useIPhoneSync.ts` — hook API and state shape
- `src/components/iphone/SyncProgress.tsx` — current progress display logic
- `src/components/dashboard/SyncStatusIndicator.tsx` — existing persistent status pattern
- `src/appCore/AppShell.tsx` — layout structure (where to insert bar)
- `src/appCore/modals/IPhoneSyncModal.tsx` — modal to modify
- `src/components/iphone/IPhoneSyncFlow.tsx` — sync flow orchestrator

## Acceptance Criteria

- [ ] Persistent status bar visible in AppShell during active sync
- [ ] User can navigate to any screen while sync runs (not blocked by modal)
- [ ] Status bar shows phase, progress bar, bytes transferred, file count
- [ ] Cancel button works from status bar
- [ ] Modal auto-closes when sync starts (backing_up phase)
- [ ] Completion state shows briefly then auto-dismisses
- [ ] Error state requires manual dismiss
- [ ] Existing modal still handles device connection and password prompts
- [ ] Unit tests for SyncStatusBar component
