# Task TASK-2167: Share FolderExportProgress Type Across IPC Boundary

**Status:** Completed
**Sprint:** SPRINT-129
**Backlog:** BACKLOG-349

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

Move the `FolderExportProgress` type from its inline definition in `eventBridge.ts` to a shared location, and update all consumers to import from the shared location. This eliminates type duplication across the IPC boundary.

## Non-Goals

- Do NOT change any runtime behavior -- this is a types-only refactor
- Do NOT modify the folder export logic or progress event emission
- Do NOT add new fields to the `FolderExportProgress` type
- Do NOT touch files unrelated to FolderExportProgress (e.g., other IPC types)
- Do NOT modify any renderer-side component files

## Deliverables

1. Update: `electron/services/folderExportService.ts` -- export the existing `FolderExportProgress` interface
2. Update: `electron/eventBridge.ts` -- import `FolderExportProgress` instead of inline type
3. Update: `electron/preload/window.d.ts` -- import `FolderExportProgress` for preload type declarations

## File Boundaries

### Files to modify (owned by this task):

- `electron/services/folderExportService.ts`
- `electron/eventBridge.ts`
- `electron/preload/window.d.ts`

### Files this task must NOT modify:

- Any `src/` renderer files -- Owned by TASK-2168 scope
- Any other `electron/handlers/` files -- Out of scope
- `electron/types/` -- Do not create new type files for this; export from existing service

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `FolderExportProgress` is exported from `electron/services/folderExportService.ts`
- [ ] `eventBridge.ts` imports `FolderExportProgress` from `folderExportService.ts` (no inline type)
- [ ] `window.d.ts` references the shared `FolderExportProgress` type
- [ ] No inline type definitions remain for `FolderExportProgress` anywhere
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (no regressions)
- [ ] No runtime behavior changes

## Implementation Notes

### Current State

```typescript
// electron/services/folderExportService.ts -- interface defined but NOT exported
interface FolderExportProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

// electron/eventBridge.ts -- inline type duplication
(callback: (progress: { stage: string; current: number; total: number; message: string }) => void)
```

### Target State

```typescript
// electron/services/folderExportService.ts -- export the interface
export interface FolderExportProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

// electron/eventBridge.ts -- import from shared location
import { FolderExportProgress } from './services/folderExportService';
// Use FolderExportProgress in the callback type

// electron/preload/window.d.ts -- import shared type
import { FolderExportProgress } from '../services/folderExportService';
```

### Key Steps

1. Add `export` keyword to `FolderExportProgress` in `folderExportService.ts`
2. In `eventBridge.ts`, replace inline type with import
3. In `window.d.ts`, add import and use the shared type
4. Run `npm run type-check` to verify

## Integration Notes

- This task runs in **parallel** with TASK-2168 (no file overlap)
- Phase 2 tasks (TASK-2169, TASK-2170) do not directly depend on this type change
- PR targets: `int/sprint-129-refactor`

## Do / Don't

### Do:

- Export the existing interface exactly as-is (add `export` keyword)
- Verify import paths resolve correctly
- Run full type-check after changes

### Don't:

- Rename the interface
- Add/remove/change any fields
- Create a new types file (keep in folderExportService.ts)
- Change any runtime code

## When to Stop and Ask

- If `FolderExportProgress` is used in more files than listed above
- If the type has been changed or extended since the backlog item was created
- If import paths have circular dependency issues

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests needed
- Existing tests to verify: All existing tests pass unchanged

### Coverage

- Coverage impact: No change expected (types-only refactor)

### Integration / Feature Tests

- Verify folder export still works by checking type-check passes

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without passing CI WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(ipc): share FolderExportProgress type across IPC boundary`
- **Branch**: `refactor/task-a-folder-export-type`
- **Base**: `int/sprint-129-refactor`
- **Labels**: `refactor`, `types`

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~8K

**Token Cap:** 32K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 3 files | +3K |
| Code volume | ~10 lines changed | +2K |
| Exploration | Finding all usages | +3K |

**Confidence:** High

**Risk factors:**
- Very low risk -- adding `export` keyword and imports

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: <DATE>*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files modified:
- [ ] electron/services/folderExportService.ts
- [ ] electron/eventBridge.ts
- [ ] electron/preload/window.d.ts

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~8K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any, explain what and why. Otherwise "None">

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~8K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** N/A (types-only)

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-129-refactor

### Merge Verification (MANDATORY)

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
