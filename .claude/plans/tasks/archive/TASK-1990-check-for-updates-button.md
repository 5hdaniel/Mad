# Task TASK-1990: Wire Check for Updates Button to updateService

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves PR
6. **Engineer merges PR and verifies merge state is MERGED**
7. Task marked complete only AFTER merge verified

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

---

## Goal

Wire the disabled "Check for Updates" button in Settings to actually trigger an update check via the existing `updateService.checkForUpdates()` method, showing status feedback to the user.

## Non-Goals

- Do NOT redesign the auto-update UI or add a full update management screen
- Do NOT modify the `updateService.ts` logic (it already works correctly)
- Do NOT change the auto-download toggle behavior
- Do NOT add the install/restart flow to this button (that already exists in `UpdateNotification.tsx`)

## Deliverables

1. Update: `electron/preload/outlookBridge.ts` -- Add `checkForUpdates` method to `updateBridge`
2. Update: `src/window.d.ts` -- Add type declaration for the new IPC method
3. Update: `electron/types/ipc.ts` -- Add type declaration if applicable
4. Update: `electron/main.ts` -- Register IPC handler for `check-for-updates`
5. Update: `src/components/Settings.tsx` -- Wire button with onClick, show status feedback

## Acceptance Criteria

- [ ] "Check for Updates" button is no longer permanently disabled
- [ ] Clicking the button triggers `updateService.checkForUpdates()` via IPC
- [ ] Button shows "Checking..." state while check is in progress
- [ ] After check completes, button shows result: "Up to date" or "Update available (vX.Y.Z)"
- [ ] Button is disabled during checking (prevents double-clicks)
- [ ] Button re-enables after check completes (with result message that auto-clears after ~5 seconds)
- [ ] Works in dev mode without crashing (should show "Up to date" or handle gracefully)
- [ ] All CI checks pass

## Implementation Notes

### Current State

**Settings.tsx** (line 727-732):
```tsx
<button
  disabled
  className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  Check for Updates
</button>
```
The button is hardcoded `disabled` with no `onClick` handler.

**updateService.ts** already has `checkForUpdates()` method (line 118) that returns `Promise<UpdateInfo | null>`.

**updateBridge** (in `electron/preload/outlookBridge.ts`, line 74) has event listeners (`onAvailable`, `onProgress`, `onDownloaded`, `install`) but lacks a `checkForUpdates` invoke method.

### Changes Required

1. **Add IPC handler in `electron/main.ts`:**
```typescript
ipcMain.handle("app:check-for-updates", async () => {
  try {
    // In dev mode, autoUpdater.checkForUpdates() may not work
    if (!app.isPackaged) {
      return { updateAvailable: false, currentVersion: app.getVersion() };
    }
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return {
      updateAvailable: !!result?.updateInfo,
      version: result?.updateInfo?.version,
      currentVersion: app.getVersion(),
    };
  } catch (error) {
    return {
      updateAvailable: false,
      currentVersion: app.getVersion(),
      error: error instanceof Error ? error.message : "Check failed",
    };
  }
});
```

2. **Add `checkForUpdates` to updateBridge in `electron/preload/outlookBridge.ts`:**
```typescript
export const updateBridge = {
  // ... existing methods ...

  /**
   * Manually check for updates
   * @returns Update check result
   */
  checkForUpdates: (): Promise<{
    updateAvailable: boolean;
    version?: string;
    currentVersion: string;
    error?: string;
  }> => ipcRenderer.invoke("app:check-for-updates"),
};
```

3. **Update `src/window.d.ts`** -- add type for `update.checkForUpdates` if `window.api.update` is typed there. Check how `window.api.update` is structured.

4. **Update `src/components/Settings.tsx`:**
```tsx
const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available' | 'error'>('idle');
const [updateVersion, setUpdateVersion] = useState<string>('');

const handleCheckForUpdates = async () => {
  setUpdateStatus('checking');
  try {
    // Access via window.electron (legacy) or window.api.update
    const result = await window.electron?.checkForUpdates?.()
      ?? await window.api?.update?.checkForUpdates?.();
    if (result?.updateAvailable) {
      setUpdateStatus('available');
      setUpdateVersion(result.version || '');
    } else {
      setUpdateStatus('up-to-date');
    }
  } catch {
    setUpdateStatus('error');
  }
  // Auto-reset after 5 seconds
  setTimeout(() => setUpdateStatus('idle'), 5000);
};

// In JSX:
<button
  onClick={handleCheckForUpdates}
  disabled={updateStatus === 'checking'}
  className="mt-3 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  {updateStatus === 'checking' ? 'Checking...' :
   updateStatus === 'up-to-date' ? 'Up to date' :
   updateStatus === 'available' ? `Update available (v${updateVersion})` :
   updateStatus === 'error' ? 'Check failed' :
   'Check for Updates'}
</button>
```

### Key Files to Reference (READ ONLY)

- `electron/services/updateService.ts` (line 118: `checkForUpdates()`)
- `electron/preload/outlookBridge.ts` (line 74: `updateBridge`)
- `electron/main.ts` (lines 737-741: auto-update initialization, lines 922-928: periodic checks)
- `src/components/UpdateNotification.tsx` (example of using updateBridge)
- `electron/preload/legacyBridge.ts` (lines 95-105: legacy update method mapping)

### Important: Legacy vs API Bridge

The update bridge is accessed through two paths:
- Legacy: `window.electron.onUpdateAvailable()`, `window.electron.installUpdate()`
- API: `window.api.update.onAvailable()`, `window.api.update.install()`

Check both paths and add `checkForUpdates` to both if applicable. The `legacyBridge.ts` maps from legacy to the bridge methods.

## Integration Notes

- Imports from: `updateBridge` (via preload)
- Exports to: N/A
- Used by: Settings page only
- Depends on: None (independent, Phase 1)

## Do / Don't

### Do:
- Handle dev mode gracefully (no crash, show "Up to date" or "Not available in dev mode")
- Add the IPC handler near the existing update-related code in main.ts
- Follow existing IPC naming patterns (e.g., `app:check-for-updates`)
- Auto-clear the status message after a few seconds

### Don't:
- Don't modify updateService.ts -- it already works
- Don't add complex update management UI
- Don't add download/install logic to this button (UpdateNotification handles that)
- Don't duplicate the auto-update initialization logic

## When to Stop and Ask

- If `autoUpdater` is not accessible from where the IPC handler would be registered
- If `window.api.update` doesn't exist in the type declarations
- If Settings.tsx exceeds 800 lines after changes

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (this is simple IPC wiring + button state management)
- The existing `updateService.test.ts` covers `checkForUpdates()` logic

### Coverage

- Coverage impact: Minimal -- IPC handlers and button wiring are hard to unit test

### Integration / Feature Tests

- Required scenarios: Manual testing recommended
  - Click button in dev mode -- should not crash
  - Verify button state transitions (idle -> checking -> result -> idle)

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `feat(settings): wire Check for Updates button to updateService`
- **Labels**: `ui`, `settings`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 4-5 files (preload, main, types, Settings) | +5K |
| Code volume | ~40 lines added across files | +2K |
| Test complexity | None required | +0K |
| Investigation | Discovering correct bridge path | +1K |

**Confidence:** High

**Risk factors:**
- Multiple files to touch but all are small changes

**Similar past tasks:** BACKLOG-653 (auto-download toggle, ~10K est)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/preload/outlookBridge.ts
- [ ] electron/main.ts
- [ ] src/window.d.ts
- [ ] src/components/Settings.tsx

Features implemented:
- [ ] IPC handler registered
- [ ] updateBridge.checkForUpdates method added
- [ ] Button onClick wired
- [ ] Status feedback (checking/up-to-date/available/error)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document decisions>

**Issues encountered:**
<Document issues>

**Reviewer notes:**
<Anything for reviewer>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~8K | ~XK | +/-X% |

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
