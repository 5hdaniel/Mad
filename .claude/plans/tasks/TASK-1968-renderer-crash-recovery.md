# Task TASK-1968: Renderer Crash Recovery

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

Add `render-process-gone` and `unresponsive` event handlers on `mainWindow.webContents` to show a recovery dialog when the renderer crashes, giving the user the option to reload or quit.

## Non-Goals

- Do NOT implement auto-restart (user must choose via dialog)
- Do NOT add crash telemetry beyond what Sentry captures (TASK-1967)
- Do NOT modify the preload script
- Do NOT add a custom crash reporter (use Sentry from TASK-1967)

## Deliverables

1. Update: `electron/main.ts` — add `render-process-gone` + `unresponsive` event handlers after `createWindow()` (around line 738)

## Acceptance Criteria

- [ ] `render-process-gone` handler registered on `mainWindow.webContents`
- [ ] `unresponsive` handler registered on `mainWindow`
- [ ] Dialog shows: "The application encountered an error. [Reload] [Quit]"
- [ ] "Reload" reloads the renderer (`mainWindow.webContents.reload()`)
- [ ] "Quit" quits the app (`app.quit()`)
- [ ] Sentry captures crash details before showing dialog (if TASK-1967 is merged)
- [ ] Force crash via DevTools `process.crash()` triggers the dialog
- [ ] All CI checks pass

## Implementation Notes

### Event Handlers

Add after `createWindow()` in `electron/main.ts` (around line 738):

```typescript
// Renderer crash recovery
mainWindow.webContents.on('render-process-gone', async (_event, details) => {
  console.error('[Main] Renderer process gone:', details.reason, details.exitCode);

  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: 'Application Error',
    message: 'The application encountered an error.',
    detail: `Reason: ${details.reason}`,
    buttons: ['Reload', 'Quit'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    mainWindow.webContents.reload();
  } else {
    app.quit();
  }
});

mainWindow.on('unresponsive', async () => {
  console.warn('[Main] Window became unresponsive');

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: 'Application Not Responding',
    message: 'The application is not responding.',
    detail: 'Would you like to wait or reload?',
    buttons: ['Wait', 'Reload', 'Quit'],
    defaultId: 0,
    cancelId: 0,
  });

  if (response === 1) {
    mainWindow.webContents.reload();
  } else if (response === 2) {
    app.quit();
  }
  // response === 0: Wait (do nothing)
});
```

### Important Details

- Use `dialog.showMessageBox` (native dialog, not renderer-based) — the renderer may be dead
- `render-process-gone` details include `reason` (e.g., 'crashed', 'killed', 'oom') and `exitCode`
- The `unresponsive` event fires when the renderer stops responding — give the user a "Wait" option since it may recover
- `dialog` is already imported in main.ts

## Integration Notes

- Depends on TASK-1967 (Sentry) — crash details are captured by Sentry before the dialog
- TASK-1970 follows this task (sequential due to shared main.ts)
- The `mainWindow` variable must be in scope where handlers are added

## Do / Don't

### Do:
- Use native `dialog.showMessageBox` (not a renderer dialog)
- Log crash details to console for debugging
- Include the crash reason in the dialog detail text

### Don't:
- Do NOT show the dialog in development mode for `killed` reason (DevTools reload causes this)
- Do NOT auto-restart in a loop (one reload attempt, then user decides)
- Do NOT modify the main window creation code

## When to Stop and Ask

- If `mainWindow` is not accessible where the handlers need to be added
- If the dialog module is not already imported
- If the `render-process-gone` event has different parameters than expected

## Testing Expectations (MANDATORY)

### Unit Tests
- Required: No (Electron main process, tested manually)
- Verify via: Force crash with `process.crash()` in DevTools, confirm dialog appears

### CI Requirements
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

## PR Preparation

- **Title:** `feat(resilience): add renderer crash recovery dialog`
- **Labels:** `feature`, `electron`
- **Depends on:** TASK-1967

---

## PM Estimate (PM-Owned)

**Category:** `feature`
**Estimated Tokens:** ~15K
**Token Cap:** 60K (4x upper estimate)

---

## Implementation Summary (Engineer-Owned)

*Completed: <DATE>*

### Checklist
```
Files modified:
- [ ] electron/main.ts (crash recovery handlers)

Features implemented:
- [ ] render-process-gone handler with Reload/Quit dialog
- [ ] unresponsive handler with Wait/Reload/Quit dialog
- [ ] Console logging of crash details

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] process.crash() in DevTools triggers recovery dialog
- [ ] Reload button works
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
