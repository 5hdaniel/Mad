# TASK-1972: Functional Notification Toggle in Settings

**Sprint:** Standalone (ad hoc user request)
**Branch:** `feature/TASK-1972-notification-toggle`
**Worktree:** `../Mad-notification-toggle`
**Estimated Tokens:** 30K-50K
**PR Target:** `develop`

---

## Objective

Make the currently disabled/greyed-out "Notifications" toggle in the Settings page fully functional. Users should be able to toggle desktop notifications on/off, and verify notifications work with a "Test Notification" button. The preference must persist and actually control whether desktop notifications are shown.

---

## Context

The Settings page (`src/components/Settings.tsx`) has a "Notifications" toggle that is currently rendered as disabled with `opacity-50` and `cursor-not-allowed`. Despite being greyed out, desktop notifications ARE still being sent by `useAutoRefresh.ts` (line 283) when sync completes, via `window.api.notification?.send()`.

The Electron notification infrastructure already exists:
- **Main process:** `electron/system-handlers.ts` lines 1910-1966 - IPC handlers for `notification:is-supported` and `notification:send` using Electron's `Notification` API
- **Preload bridge:** `electron/preload/settingsBridge.ts` lines 100-118 - `notificationBridge` with `isSupported()` and `send()` methods
- **Preload exposure:** `electron/preload.ts` line 88 - Exposed as `window.api.notification`
- **Current usage:** `src/hooks/useAutoRefresh.ts` line 283 - Sends "Sync Complete" notification unconditionally

The preference system is well-established in Settings.tsx (see `handleAutoSyncToggle`, `handleAutoDownloadToggle` patterns). The `window.api.preferences.update()` and `window.api.preferences.get()` API is used to persist user preferences.

---

## Requirements

### Must Do:
1. **Remove disabled state from notifications toggle** - Remove `opacity-50`, `disabled` attribute, and `cursor-not-allowed` from the Notifications section in Settings.tsx
2. **Add notification preference state** - Add `notificationsEnabled` state (default: `true`) that loads from and persists to user preferences via `window.api.preferences`
3. **Make toggle functional** - Wire up the toggle to read/write the `notifications.enabled` preference, following the exact pattern used by `handleAutoSyncToggle` and `handleAutoDownloadToggle`
4. **Add "Test Notification" button** - Add a button below the toggle (following the "Check for Updates" button pattern in the Auto-Download Updates section) that sends a test desktop notification via `window.api.notification.send()`
5. **Gate notification sending on preference** - In `useAutoRefresh.ts`, check the notification preference before sending desktop notifications. Since useAutoRefresh receives `userId` as a parameter, it should load the preference via `window.api.preferences.get(userId)` on mount
6. **Add preference type** - Add `notifications?: { enabled?: boolean }` to the `PreferencesResult.preferences` interface in Settings.tsx
7. **Update tests** - Update `Settings.test.tsx` to test the notification toggle (load preference, toggle state, save preference, test notification button)

### Must NOT Do:
- Do NOT change the in-app toast/notification system (`NotificationContext.tsx`) -- that is a separate UI system
- Do NOT modify the Electron notification handlers in `system-handlers.ts` or the preload bridge -- those already work correctly
- Do NOT add new IPC channels -- use the existing `notification:send` and `notification:is-supported` channels
- Do NOT change how the `NotificationProvider` or `NotificationContainer` works

---

## Acceptance Criteria

- [ ] Notifications toggle in Settings is active (not greyed out) and toggleable
- [ ] Toggle reads initial state from user preferences on load
- [ ] Toggle persists preference changes via `window.api.preferences.update()`
- [ ] "Test Notification" button appears below the toggle
- [ ] Clicking "Test Notification" sends a desktop notification via `window.api.notification.send()`
- [ ] "Test Notification" button is disabled when notifications are toggled OFF
- [ ] When notifications are OFF, `useAutoRefresh.ts` does NOT send the "Sync Complete" notification
- [ ] When notifications are ON, `useAutoRefresh.ts` sends notifications as it currently does
- [ ] Default state is ON (notifications enabled by default)
- [ ] Settings.test.tsx updated with tests for the notification toggle
- [ ] All existing tests pass (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)

---

## Files to Modify

- `src/components/Settings.tsx` - Enable notification toggle, add preference state, add Test Notification button
- `src/hooks/useAutoRefresh.ts` - Gate desktop notification sending on user preference
- `src/components/__tests__/Settings.test.tsx` - Add tests for notification toggle functionality

## Files to Read (for context)

- `electron/system-handlers.ts` (lines 1910-1966) - Existing notification IPC handlers
- `electron/preload/settingsBridge.ts` (lines 100-118) - Existing notification bridge
- `electron/preload.ts` (line 88) - How notification bridge is exposed
- `src/contexts/NotificationContext.tsx` - In-app notification system (DO NOT modify)
- `src/hooks/useAutoRefresh.ts` (lines 275-291) - Current notification sending code

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:**
  - Test notification toggle renders as enabled (not disabled/greyed out)
  - Test notification toggle loads saved preference (ON)
  - Test notification toggle loads saved preference (OFF)
  - Test toggling saves preference via `window.api.preferences.update()`
  - Test "Test Notification" button renders
  - Test "Test Notification" button calls `window.api.notification.send()` when clicked
  - Test "Test Notification" button is disabled when notifications are OFF
- **Existing tests to update:**
  - Update the existing "should show notifications toggle (disabled/coming soon)" test to reflect the new enabled state

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(settings): make notification toggle functional with test button`
- **Branch:** `feature/TASK-1972-notification-toggle`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-11*

### Engineer Checklist

```
Pre-Work:
- [x] Created branch from develop
- [x] Noted start time: session start
- [x] Read task file completely

Implementation:
- [x] Code complete
- [x] Tests pass locally (npm test)
- [x] Type check passes (npm run type-check)
- [x] Lint passes (npm run lint)

PR Submission:
- [x] This summary section completed
- [x] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Notification toggle greyed out/disabled with opacity-50 and cursor-not-allowed, notifications still sent unconditionally in useAutoRefresh
- **After**: Toggle is fully functional, persists preference, Test Notification button added, useAutoRefresh gates notifications on user preference
- **Actual Tokens**: ~25K (Est: 30-50K)
- **PR**: https://github.com/5hdaniel/Mad/pull/814

### Notes

**Deviations from plan:**
None. Implementation followed the exact patterns specified in the task file.

**Issues encountered:**
- Worktree did not have node_modules installed; ran `npm install` before quality checks. This is expected for worktrees.
- Pre-existing test failures in `contact-handlers.test.ts` (18 failures related to contact preference gating in electron handlers) -- unrelated to this task's changes.

---

## Guardrails

**STOP and ask PM if:**
- The preferences API shape differs from what is documented here
- The `window.api.notification` bridge is not exposed or behaves differently than expected
- Modifying `useAutoRefresh.ts` requires changing its function signature or props
- Any test changes affect more than the Settings.test.tsx file
- You encounter blockers not covered in the task file
