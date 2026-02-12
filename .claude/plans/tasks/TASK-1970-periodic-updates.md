# Task TASK-1970: Periodic Update Checks

---

## WORKFLOW REQUIREMENT
**This task MUST be implemented via the `engineer` agent.**

1. PM creates branch and updates backlog status
2. PM invokes `engineer` agent with this task file
3. Engineer implements the task
4. Engineer opens PR targeting `develop`
5. SR Engineer reviews and merges
6. PM records metrics and updates backlog

---

## Goal

Add a periodic 4-hour interval for checking application updates. Currently the app only checks for updates on startup — this ensures users running the app for extended periods still get update notifications.

## Non-Goals

- Do NOT change the existing startup update check behavior
- Do NOT add user-configurable update interval
- Do NOT force-apply updates (just check and notify)
- Do NOT add update checks in development mode

## Deliverables

1. Update: `electron/constants.ts` (line 77 area) — add `UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000`
2. Update: `electron/main.ts` (lines 682-686) — add `setInterval` after existing startup timeout

## Acceptance Criteria

- [ ] `UPDATE_CHECK_INTERVAL` constant defined in `electron/constants.ts`
- [ ] `setInterval` calls update check every 4 hours
- [ ] Interval only runs in production mode (`app.isPackaged`)
- [ ] Interval is cleared on app quit (prevent memory leak)
- [ ] All CI checks pass

## Implementation Notes

### Constant

```typescript
// electron/constants.ts
export const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in ms
```

### Interval Setup

In `electron/main.ts`, after the existing startup update check timeout (lines 682-686):

```typescript
// Periodic update checks (production only)
if (app.isPackaged) {
  const updateInterval = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[Update] Periodic check failed:', err.message);
    });
  }, UPDATE_CHECK_INTERVAL);

  // Clean up on quit
  app.on('before-quit', () => {
    clearInterval(updateInterval);
  });
}
```

### Important Details

- `autoUpdater` is already imported and configured in main.ts
- The existing startup check uses a `setTimeout` delay — the periodic interval is separate and additional
- Wrap in `app.isPackaged` to avoid running in development mode
- `.catch()` on the check prevents unhandled rejections if the update server is unreachable

## Integration Notes

- Should run after TASK-1967 (Sentry) and TASK-1968 (Crash Recovery) to avoid main.ts merge conflicts
- `autoUpdater` is already available in the scope
- The existing update check flow handles download/install notifications — this just triggers the check

## Do / Don't

### Do:
- Guard with `app.isPackaged`
- Clean up interval on `before-quit`
- Catch errors silently (update checks are best-effort)

### Don't:
- Do NOT modify the existing startup update check
- Do NOT add a user-visible indicator for periodic checks
- Do NOT retry failed checks more frequently

## When to Stop and Ask

- If the autoUpdater setup has been significantly refactored
- If there's already a periodic check mechanism in place
- If `autoUpdater` is not accessible in the scope where the interval needs to be added

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (Electron main process, runtime behavior)
- Verify via: Confirm interval is set in production mode only (code review)

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(updates): add periodic 4-hour update checks`
- **Labels:** `feature`, `electron`
- **Depends on:** TASK-1968 (sequential due to shared main.ts)

---

## PM Estimate (PM-Owned)

**Category:** `feature`
**Estimated Tokens:** ~10K
**Token Cap:** 40K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] electron/constants.ts (UPDATE_CHECK_INTERVAL)
- [ ] electron/main.ts (setInterval + cleanup)

Features implemented:
- [ ] 4-hour periodic update check
- [ ] Production-only guard
- [ ] Interval cleanup on quit

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Notes
**Deviations from plan:** <explanation or "None">
**Issues encountered:** <document and resolution>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Review Summary
- Architecture compliance: <PASS/FAIL>
- Security review: <PASS/FAIL>

### Merge Information
**PR Number:** #
**Merge Commit:** <hash>
**Merged To:** develop
