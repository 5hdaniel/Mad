# TASK-2162: Defer macOS Notification Permission Prompt

**Backlog ID:** BACKLOG-834
**Sprint:** SPRINT-128
**Batch:** 1 (parallel with TASK-2163, TASK-2164)
**Branch:** `fix/BACKLOG-834-defer-notification-prompt`
**Status:** Completed
**Estimated Tokens:** ~3K
**Token Cap:** 12K
**PR:** #1135 (Merged)

---

## Objective

Replace `autoUpdater.checkForUpdatesAndNotify()` with `autoUpdater.checkForUpdates()` in two locations to prevent macOS from prompting for notification permissions on first launch. The app already has an in-app `UpdateNotification` component that handles update UI via IPC events -- the native OS notification is redundant and disruptive during onboarding.

---

## Context

When the Electron app launches for the first time on macOS, `checkForUpdatesAndNotify()` triggers the OS notification permission prompt. This is confusing during onboarding because the user hasn't done anything related to notifications yet. The app uses a custom in-app `UpdateNotification` component (rendered in the React UI) that shows update availability, progress, and restart prompts via IPC events from `electron-updater`. The OS-level notification is therefore completely redundant.

Note: the periodic update check at `electron/main.ts:1086` already uses `checkForUpdates()` (correct). Only two locations need fixing.

---

## Requirements

### Must Do:
1. Change `autoUpdater.checkForUpdatesAndNotify()` to `autoUpdater.checkForUpdates()` at `electron/main.ts:833`
2. Change `autoUpdater.checkForUpdatesAndNotify()` to `autoUpdater.checkForUpdates()` at `electron/handlers/updaterHandlers.ts:42`
3. Verify no other calls to `checkForUpdatesAndNotify()` exist in the codebase

### Must NOT Do:
- Do not modify the `UpdateNotification` React component
- Do not change the update check interval or delay timing
- Do not remove any IPC event listeners for update events
- Do not touch the periodic check at `electron/main.ts:1086` (it already uses `checkForUpdates()`)

---

## Acceptance Criteria

- [ ] `checkForUpdatesAndNotify()` does not appear in production code (mock files are acceptable)
- [ ] `checkForUpdates()` is used in both the initial startup check and the manual check handler
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] The in-app `UpdateNotification` component still renders update notifications (IPC events unchanged)

---

## Files to Modify

- `electron/main.ts:833` - Change `autoUpdater.checkForUpdatesAndNotify()` to `autoUpdater.checkForUpdates()`
- `electron/handlers/updaterHandlers.ts:42` - Change `autoUpdater.checkForUpdatesAndNotify()` to `autoUpdater.checkForUpdates()`
- `tests/__mocks__/electron-updater.js:6` - Remove the `checkForUpdatesAndNotify` mock (no longer needed since production code no longer calls it)

## Files to Read (for context)

- `electron/main.ts` - Confirm line 833 and line 1086 context
- `electron/handlers/updaterHandlers.ts` - Confirm line 42 context
- `src/components/UpdateNotification.tsx` - Verify it uses IPC events (should NOT need changes)

---

## Testing Expectations

### Unit Tests
- **Required:** No new tests needed
- **Existing tests to update:** None expected -- `checkForUpdates` vs `checkForUpdatesAndNotify` share the same return type

### Manual Verification
- On macOS: confirm first launch does NOT trigger notification permission prompt
- Confirm that when an update is available, the in-app UpdateNotification component still appears

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

---

## PR Preparation

- **Title:** `fix(electron): defer macOS notification prompt by using checkForUpdates`
- **Branch:** `fix/BACKLOG-834-defer-notification-prompt`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: ~3K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The `UpdateNotification` component relies on `checkForUpdatesAndNotify()` specifically (it should not)
- There are more than 2 calls to `checkForUpdatesAndNotify()` in the codebase
- Any test mocks reference `checkForUpdatesAndNotify` specifically
- You encounter blockers not covered in the task file
