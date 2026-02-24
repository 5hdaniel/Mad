# SPRINT-086: Fix Preload Bridge Race Condition (Sentry)

**Created:** 2026-02-17
**Status:** Ready
**Branch:** `develop` (task branch off develop)
**Base:** `develop`

---

## Sprint Goal

Fix the unhandled `TypeError: Cannot read properties of undefined (reading 'system')` reported by Sentry in `LoadingOrchestrator.tsx`. The error is a race condition where React mounts and accesses `window.api.system` before the Electron preload bridge has finished calling `contextBridge.exposeInMainWorld()`.

## Sprint Narrative

Sentry captured an unhandled error on every app startup:

```
TypeError: Cannot read properties of undefined (reading 'system')
  at LoadingOrchestrator.tsx:80
```

The root cause is a timing race. The app's initial state (`INITIAL_APP_STATE`) starts in `{ status: "loading", phase: "checking-storage" }`, which causes `LoadingOrchestrator`'s Phase 1 `useEffect` to fire immediately and call `window.api.system.hasEncryptionKeyStore()`. If the preload script's `contextBridge.exposeInMainWorld("api", ...)` has not yet completed, `window.api` is `undefined` and the property access throws.

This is a single-task sprint. The fix adds a guard/retry utility to `LoadingOrchestrator` that polls for `window.api` readiness before calling any bridge methods, with a timeout that dispatches a recoverable error if the bridge never becomes available.

---

## In-Scope

| ID | Title | Task | Status |
|----|-------|------|--------|
| BACKLOG-721 | Fix window.api.system undefined race condition in LoadingOrchestrator | TASK-2005 | Pending |

**Total Estimated Tokens:** ~20K (engineering) + ~10K (SR review) = ~30K

## Out-of-Scope / Deferred

- Modifying the preload script or main process (fix is renderer-side only)
- Fixing other potential `window.api` race conditions in non-LoadingOrchestrator components (engineer should report if found, but not fix in this sprint)
- Changing the state machine reducer or initialization sequence
- Adding new IPC channels

---

## Phase Plan

### Phase 1: Implementation (Single Task)

```
Phase 1: Fix
+-- TASK-2005: Add API readiness guard with retry to LoadingOrchestrator
|   1. Create waitForApi() utility
|   2. Guard all 4 phases in LoadingOrchestrator
|   3. Add unit tests
+-- CI gate: type-check, lint, test all pass
```

**TASK-2005** (BACKLOG-721): Fix preload bridge race condition
- Creates: `src/appCore/state/machine/utils/waitForApi.ts`
- Modifies: `src/appCore/state/machine/LoadingOrchestrator.tsx`
- Updates: `src/appCore/state/machine/LoadingOrchestrator.test.tsx`

---

## Dependency Graph

```
TASK-2005 (fix preload bridge race condition)
    |
    v
Sprint Complete
```

Single task, no dependencies.

**Execution Order:**

| Order | Task | Depends On | Parallel? |
|-------|------|------------|-----------|
| 1 | TASK-2005 (preload bridge guard) | None | N/A (only task) |

---

## Merge Plan

| Task | Branch Name | Base | Target |
|------|-------------|------|--------|
| TASK-2005 | `fix/task-2005-preload-bridge-race-condition` | develop | develop |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Retry polling adds startup latency on normal machines | Medium | Low | Fast path: `if (window.api?.system) return` skips polling entirely when bridge is already ready (99% of cases) |
| Guard changes break existing LoadingOrchestrator tests | Low | Medium | Tests already mock `window.api`; the guard is a no-op when mocks are present |
| Other components also access window.api at mount without guards | Low | Medium | Out of scope; engineer reports findings but does not fix |

---

## Testing & Quality Plan

### Per-Task Testing Requirements

| Task | Unit Tests | Integration Tests | Manual Testing |
|------|-----------|-------------------|----------------|
| TASK-2005 | waitForApi() tests + LoadingOrchestrator undefined api test | N/A | Verify app still starts normally (no visible delay) |

### CI Gates

- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No regressions in existing tests

---

## Task Assignment

### TASK-2005

**Title:** Fix window.api.system undefined race condition in LoadingOrchestrator
**Sprint:** SPRINT-086
**Execution:** Sequential (single task)

#### Branch Information
**Branch From:** develop
**Branch Into:** develop
**Branch Name:** `fix/task-2005-preload-bridge-race-condition`

**Estimated Tokens:** ~20K

#### Before Starting
Read the task file: `.claude/plans/tasks/TASK-2005-fix-preload-bridge-race-condition.md`

#### Workflow Reminder
1. Create branch from develop
2. Record your Agent ID immediately
3. Implement solution
4. Complete task file Implementation Summary
5. Create PR with Agent ID noted
6. Wait for CI to pass
7. Request SR Engineer review

**Full workflow:** `.claude/docs/ENGINEER-WORKFLOW.md`

---

## End-of-Sprint Validation Checklist

- [ ] `window.api` being undefined at mount does NOT cause unhandled TypeError
- [ ] App starts normally with no visible delay when bridge is ready (fast path)
- [ ] Recoverable error screen shown if bridge never becomes available (timeout)
- [ ] All 4 LoadingOrchestrator phases are guarded
- [ ] Shared utility avoids duplicate guard logic
- [ ] Unit tests cover the undefined `window.api` scenario
- [ ] All existing tests pass
- [ ] PR merged to develop
- [ ] Backlog CSV updated (BACKLOG-721 marked Completed)

---

## Notes

### Task Sizing Rationale

| Task | Category | Base Est | Multiplier | Final Est | SR Overhead |
|------|----------|----------|------------|-----------|-------------|
| TASK-2005 | fix | ~20K | x1.0 | ~20K | ~10K |
| **Totals** | | | | **~20K** | **~10K** |

Grand total: ~30K estimated billable tokens.

### Priority Justification

This is a **High priority** fix because:
1. It is an unhandled error reported by Sentry on every app startup
2. It can prevent the app from initializing at all on slower machines
3. It is a poor first-run experience for new users
4. The fix is low-risk (guard + retry, no behavioral changes when bridge is ready)
