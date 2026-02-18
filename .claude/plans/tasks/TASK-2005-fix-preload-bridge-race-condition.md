# TASK-2005: Fix window.api.system undefined race condition in LoadingOrchestrator

**Backlog ID:** BACKLOG-721
**Sprint:** SPRINT-086
**Phase:** Phase 1 (single task sprint)
**Branch:** `fix/task-2005-preload-bridge-race-condition`
**Estimated Turns:** 5-10
**Estimated Tokens:** ~20K

---

## Objective

Fix the unhandled `TypeError: Cannot read properties of undefined (reading 'system')` that occurs in `LoadingOrchestrator.tsx` when the component mounts before the Electron preload bridge has finished calling `contextBridge.exposeInMainWorld()`. This is a race condition between React mounting and the preload script completing.

---

## Context

### Sentry Error Details
- **Error:** `TypeError: Cannot read properties of undefined (reading 'system')`
- **File:** `src/appCore/state/machine/LoadingOrchestrator.tsx` line 80
- **Level:** Error (Unhandled)
- **Environment:** development, Electron 35.7.5
- **Frequency:** Can occur on every app startup

### How the Race Condition Happens

1. The app starts with `INITIAL_APP_STATE = { status: "loading", phase: "checking-storage" }` (see `src/appCore/state/machine/types.ts:464`)
2. `LoadingOrchestrator` mounts and its Phase 1 `useEffect` fires immediately
3. Phase 1 calls `window.api.system.hasEncryptionKeyStore()` at line 80
4. If the preload script (`electron/preload.ts`) has not yet finished calling `contextBridge.exposeInMainWorld("api", { ... })`, then `window.api` is `undefined`
5. Accessing `.system` on `undefined` throws the TypeError

### Architecture

- **Preload script:** `electron/preload.ts` - calls `contextBridge.exposeInMainWorld("api", { system: systemBridge, ... })`
- **LoadingOrchestrator:** `src/appCore/state/machine/LoadingOrchestrator.tsx` - Phase 1 useEffect immediately calls `window.api.system.hasEncryptionKeyStore()`
- **State machine initial state:** `src/appCore/state/machine/types.ts` - `INITIAL_APP_STATE` starts in `checking-storage` phase
- **System bridge:** `electron/preload/systemBridge.ts` - provides `hasEncryptionKeyStore`, `initializeSecureStorage`, `checkAllConnections`, `checkPermissions`

### Why This Happens in Practice

The `contextBridge.exposeInMainWorld()` call in the preload script is synchronous, but there can be a timing gap between when the preload script runs and when the renderer's JavaScript (React) starts executing. This is especially likely to manifest:
- On slower machines
- During development with DevTools open
- When Electron version updates change internal timing
- On first launch after install

---

## Requirements

### Must Do:

1. **Add a guard in LoadingOrchestrator Phase 1** that checks whether `window.api` and `window.api.system` are defined before calling any methods
2. **If the API is not ready, implement a retry mechanism** with exponential backoff (e.g., check every 50ms, then 100ms, then 200ms, up to a reasonable timeout like 5 seconds)
3. **If the API never becomes available within the timeout, dispatch an ERROR action** with a clear, user-facing error message and `recoverable: true`
4. **Apply the same guard pattern to ALL phases** in LoadingOrchestrator that access `window.api` (Phases 1-4), not just Phase 1
5. **Create a shared utility function** (e.g., `waitForApi()` or `ensureApiReady()`) so the guard logic is not duplicated across all 4 phases
6. **Add a unit test** that verifies the component handles `window.api` being undefined gracefully (no unhandled errors)

### Must NOT Do:
- Do NOT change the preload script (`electron/preload.ts`) - the fix must be in the renderer side
- Do NOT change the state machine reducer or types
- Do NOT add artificial delays to the app startup (the retry should be a tight poll, not a sleep)
- Do NOT change the order of initialization phases
- Do NOT add new IPC channels or modify the bridge modules
- Do NOT modify `electron/main.ts` or any main process files

---

## Acceptance Criteria

- [ ] `window.api` being `undefined` at mount time does NOT cause an unhandled TypeError
- [ ] The app successfully initializes once the preload bridge becomes available (retry succeeds)
- [ ] If the bridge never becomes available (5s timeout), the app shows a recoverable error screen
- [ ] All 4 phases of LoadingOrchestrator are protected, not just Phase 1
- [ ] A shared utility function avoids duplicating the guard logic
- [ ] Unit test exists that mocks `window.api` as undefined and verifies graceful handling
- [ ] Existing tests still pass (`npm test`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)

---

## Files to Modify

- `src/appCore/state/machine/LoadingOrchestrator.tsx` - Add API readiness guard with retry to all 4 phases
- `src/appCore/state/machine/utils/waitForApi.ts` (NEW) - Shared utility for API readiness polling
- `src/appCore/state/machine/LoadingOrchestrator.test.tsx` - Add test for undefined `window.api` scenario

## Files to Read (for context)

- `electron/preload.ts` - Understand what `window.api` exposes and when
- `src/appCore/state/machine/types.ts` - `INITIAL_APP_STATE` and type definitions
- `src/appCore/state/machine/reducer.ts` - How ERROR actions are handled
- `src/appCore/state/machine/components/ErrorScreen.tsx` - What the error screen looks like
- `src/appCore/state/machine/components/LoadingScreen.tsx` - Loading screen (displayed during retry)

---

## Implementation Guidance

### Recommended Approach: Polling Utility + Phase Guards

**Step 1:** Create `src/appCore/state/machine/utils/waitForApi.ts`:

```typescript
/**
 * Waits for the Electron preload bridge (window.api) to become available.
 * The contextBridge.exposeInMainWorld() call in preload.ts may not have
 * completed by the time React mounts.
 *
 * @param timeoutMs - Maximum time to wait (default: 5000ms)
 * @returns Promise that resolves when window.api is available, or rejects on timeout
 */
export async function waitForApi(timeoutMs = 5000): Promise<void> {
  // Fast path: already available
  if (window.api?.system) return;

  const startTime = Date.now();
  let delay = 50; // Start with 50ms, double each iteration

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (window.api?.system) return;
    delay = Math.min(delay * 2, 500); // Cap at 500ms between checks
  }

  throw new Error(
    "Electron preload bridge (window.api) not available after " +
      timeoutMs +
      "ms. The app may need to be restarted."
  );
}
```

**Step 2:** Update each Phase in LoadingOrchestrator to await the API first:

```typescript
// Example for Phase 1:
useEffect(() => {
  if (state.status !== "loading" || loadingPhase !== "checking-storage") return;

  let cancelled = false;
  const platform = platformRef.current;

  const runPhase = async () => {
    try {
      await waitForApi();
    } catch (err) {
      if (cancelled) return;
      dispatch({
        type: "ERROR",
        error: {
          code: "API_NOT_READY",
          message: (err as Error).message,
        },
        recoverable: true,
      });
      return;
    }

    if (cancelled) return;

    // ... existing logic (window.api.system.hasEncryptionKeyStore(), etc.)
  };

  runPhase();

  return () => { cancelled = true; };
}, [state.status, loadingPhase, dispatch]);
```

### Alternative Approach: Guard at Top of Each Phase

If the utility approach feels heavy, a simpler guard at the top of each phase is also acceptable:

```typescript
if (!window.api?.system) {
  // Retry after a short delay
  const retryTimer = setTimeout(() => {
    dispatch({ type: "RETRY" }); // Or re-trigger the effect
  }, 100);
  return () => clearTimeout(retryTimer);
}
```

The polling utility approach is preferred because it handles the retry internally and provides a clear timeout with error messaging.

---

## Testing Expectations

### Unit Tests
- **Required:** Yes
- **New tests to write:**
  1. Test that LoadingOrchestrator does not throw when `window.api` is undefined at mount
  2. Test that `waitForApi()` resolves when `window.api` becomes available after a delay
  3. Test that `waitForApi()` rejects after timeout when `window.api` never becomes available
- **Existing tests to update:** May need to ensure existing LoadingOrchestrator tests still mock `window.api` correctly

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix: guard LoadingOrchestrator against preload bridge race condition`
- **Branch:** `fix/task-2005-preload-bridge-race-condition`
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
- **Actual Turns**: X (Est: 5-10)
- **Actual Tokens**: ~XK (Est: ~20K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The existing LoadingOrchestrator test suite requires significant rework to accommodate the change
- You discover other components besides LoadingOrchestrator that directly access `window.api` at mount time without guards (report them but do NOT fix them in this task)
- The retry mechanism introduces a visible delay (>200ms) in normal startup -- this should be a fast no-op when the API is already ready
- You encounter blockers not covered in the task file
