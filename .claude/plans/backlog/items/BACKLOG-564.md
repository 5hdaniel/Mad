# BACKLOG-564: Disable Auto-Import Setting

**Created**: 2026-01-28
**Source**: User request
**Priority**: Medium
**Status**: In Sprint (SPRINT-065)

---

## Description

Add a Settings option to disable automatic data import on app startup. This prevents the app from freezing on slower computers by giving users control over when imports run.

## Problem Statement

When Magic Audit opens, it automatically imports messages, contacts, and emails. On slower computers, this can cause the app to freeze or become unresponsive. Users need the ability to disable this automatic behavior and trigger imports manually when they're ready.

## Acceptance Criteria

- [ ] Setting to disable auto-import on startup exists in Settings
- [ ] When disabled, no automatic imports run when app opens
- [ ] Manual import buttons still work regardless of setting
- [ ] Preference persists across app restarts
- [ ] Default behavior is preserved (auto-import enabled)

## Technical Notes

- Settings.tsx already has "Auto-Sync on Login" toggle
- `useAutoRefresh` hook already respects this preference
- `useMacOSMessagesImport` hook does NOT currently respect this preference
- Need to add preference checking to `useMacOSMessagesImport`

## Estimated Effort

~15-25K tokens

## Related

- TASK-1741 (implementation task)
- SPRINT-065
- TASK-1003 (useAutoRefresh - reference implementation)
