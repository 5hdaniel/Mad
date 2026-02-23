# Task TASK-2064: Rename Conflicting SyncOrchestrator Services

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

**CRITICAL:** Creating a PR is step 3 of 7, not the final step. Task is NOT complete until PR is MERGED.

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Rename the electron-side `SyncOrchestrator` class (iPhone/Windows device sync) to `DeviceSyncOrchestrator` to eliminate the naming collision with the renderer-side `SyncOrchestratorService` (renderer sync queue). These are completely different services with confusingly similar names.

## Non-Goals

- Do NOT change any logic or behavior. This is a pure rename refactor.
- Do NOT rename the renderer-side `SyncOrchestratorService` (it has the correct name).
- Do NOT modify the sync flow or data model.
- Do NOT combine or merge the two services.

## Prerequisites

**Sprint:** SPRINT-097
**Depends on:** TASK-2063 (rate limiter) should merge first, since both touch sync-related code. If running in parallel, TASK-2064 must NOT modify files that TASK-2063 modifies.
**Blocks:** Nothing.

## Context

Two services named "SyncOrchestrator" exist in the codebase:

| Service | Location | Purpose | Scope |
|---------|----------|---------|-------|
| `SyncOrchestrator` | `electron/services/syncOrchestrator.ts` | iPhone/Windows device backup + sync | Main process (electron) |
| `SyncOrchestratorService` | `src/services/SyncOrchestratorService.ts` | Renderer sync queue (contacts, emails, messages) | Renderer process (React) |

The electron-side `SyncOrchestrator` handles iPhone backup creation, decryption, message/contact parsing, and device sync. It has nothing to do with the renderer-side sync queue.

### What Gets Renamed

| Current | New |
|---------|-----|
| Class: `SyncOrchestrator` | Class: `DeviceSyncOrchestrator` |
| File: `electron/services/syncOrchestrator.ts` | File: `electron/services/deviceSyncOrchestrator.ts` |
| Export: `syncOrchestrator` (singleton) | Export: `deviceSyncOrchestrator` (singleton) |
| Types: `SyncPhase`, `SyncResult`, etc. | Keep as-is (they're specific enough with DeviceSync prefix on the class) |

## Requirements

### Must Do:

1. **Rename the file**:
   ```bash
   git mv electron/services/syncOrchestrator.ts electron/services/deviceSyncOrchestrator.ts
   ```

2. **Rename the class**:
   - `export class SyncOrchestrator` -> `export class DeviceSyncOrchestrator`

3. **Rename the singleton export**:
   - `export const syncOrchestrator = new SyncOrchestrator()` -> `export const deviceSyncOrchestrator = new DeviceSyncOrchestrator()`
   - `export default syncOrchestrator` -> `export default deviceSyncOrchestrator`

4. **Update all imports/references**:
   - Find all files that import from `./syncOrchestrator` or `../services/syncOrchestrator`
   - Update import paths and identifiers
   - Update all usages of the `syncOrchestrator` singleton to `deviceSyncOrchestrator`

5. **Update test files**:
   - Rename test file if it exists: `syncOrchestrator.test.ts` -> `deviceSyncOrchestrator.test.ts`
   - Update class and import references in tests

6. **Do NOT rename these (they are correctly named)**:
   - `src/services/SyncOrchestratorService.ts` -- renderer-side, stays as-is
   - `src/hooks/useSyncOrchestrator.ts` -- renderer-side hook, stays as-is
   - Types like `SyncPhase`, `SyncResult`, `SyncOptions`, `SyncProgress` -- they live in the electron service context and are fine

### Must NOT Do:

- Change any logic or behavior
- Rename the renderer-side SyncOrchestratorService
- Modify function signatures
- Change exports that aren't being renamed

## Acceptance Criteria

- [ ] File renamed from `syncOrchestrator.ts` to `deviceSyncOrchestrator.ts`
- [ ] Class renamed from `SyncOrchestrator` to `DeviceSyncOrchestrator`
- [ ] Singleton renamed from `syncOrchestrator` to `deviceSyncOrchestrator`
- [ ] All imports updated across the codebase
- [ ] Test files updated
- [ ] No behavior changes -- only naming changes
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Deliverables

### Files to Create

| File | Purpose |
|------|---------|
| `electron/services/deviceSyncOrchestrator.ts` | Renamed file (via `git mv`) |

### Files to Delete

| File | Replaced By |
|------|-------------|
| `electron/services/syncOrchestrator.ts` | `electron/services/deviceSyncOrchestrator.ts` (via `git mv`) |

### Files to Modify

Find all files that import or reference the old name. Run:
```bash
grep -r "syncOrchestrator" electron/ --include="*.ts" -l
```

Known files to update (verify with grep):

| File | Changes |
|------|---------|
| `electron/services/deviceSyncOrchestrator.ts` | Class rename, singleton rename, default export rename |
| `electron/handlers/sync-handlers.ts` (or similar) | Update import path and variable name |
| Any handlers that reference `syncOrchestrator` | Update import and usage |
| Test files: `electron/services/__tests__/syncOrchestrator*.test.ts` | Rename file, update imports and class references |

### Files to Read (for context)

| File | Why |
|------|-----|
| `electron/services/syncOrchestrator.ts` | Current file to rename (full content) |
| `src/services/SyncOrchestratorService.ts` | Confirm this is NOT being renamed |

## Implementation Notes

### Step-by-step process

1. First, find ALL references:
   ```bash
   grep -r "syncOrchestrator\|SyncOrchestrator" electron/ --include="*.ts" -l
   ```

2. Use `git mv` for the file rename (preserves history):
   ```bash
   git mv electron/services/syncOrchestrator.ts electron/services/deviceSyncOrchestrator.ts
   ```

3. If test files exist:
   ```bash
   git mv electron/services/__tests__/syncOrchestrator.test.ts electron/services/__tests__/deviceSyncOrchestrator.test.ts
   git mv electron/services/__tests__/syncOrchestrator.ci.test.ts electron/services/__tests__/deviceSyncOrchestrator.ci.test.ts
   ```

4. Use find-and-replace across all electron/ files:
   - `from "./syncOrchestrator"` -> `from "./deviceSyncOrchestrator"`
   - `from "../services/syncOrchestrator"` -> `from "../services/deviceSyncOrchestrator"`
   - `class SyncOrchestrator` -> `class DeviceSyncOrchestrator` (only in the renamed file)
   - `new SyncOrchestrator()` -> `new DeviceSyncOrchestrator()` (only in the renamed file)
   - `syncOrchestrator` (variable) -> `deviceSyncOrchestrator` (be careful not to catch renderer-side `syncOrchestrator` in `src/`)

5. Run type-check to verify all references are updated:
   ```bash
   npm run type-check
   ```

### CRITICAL: Scope boundary

Only rename in the `electron/` directory. The `src/` directory has its own `syncOrchestrator` that refers to the renderer-side service -- do NOT touch that.

## Testing Expectations

### Unit Tests

- **Required:** Update test file names and imports only
- **No new tests needed** -- this is a pure rename

### CI Requirements

- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

## Estimation

- **Category:** rename refactor (cosmetic)
- **Base estimate:** ~8K tokens
- **SR overhead:** +5K
- **Final estimate:** ~13K tokens
- **Token Cap:** 52K (4x of 13K)

## PR Preparation

- **Title:** `refactor: rename electron SyncOrchestrator to DeviceSyncOrchestrator`
- **Branch:** `refactor/task-2064-rename-sync-orchestrator`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: 2026-02-23*

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
- [x] CI passes
- [x] SR Engineer review requested

Completion:
- [x] SR Engineer approved and merged
- [x] PM notified for next task
```

### Results

- **Before**: Electron-side `SyncOrchestrator` class name collided with renderer-side `SyncOrchestratorService`, causing confusion about which service handles what
- **After**: Electron-side class renamed to `DeviceSyncOrchestrator` with file renamed to `deviceSyncOrchestrator.ts`. All imports and references updated. Renderer-side `SyncOrchestratorService` unchanged.
- **Actual Tokens**: ~13K (Est: 13K)
- **PR**: https://github.com/5hdaniel/Mad/pull/958

### Notes

**Deviations from plan:** None. Pure mechanical rename refactor.

**Issues encountered:** None.

---

## Guardrails

**STOP and ask PM if:**
- More than 15 files need updating (suggests wider impact than expected)
- Any renderer-side (`src/`) files reference the electron `SyncOrchestrator` (unexpected coupling)
- The rename causes circular import issues
- Test files have hardcoded class names in snapshot tests
