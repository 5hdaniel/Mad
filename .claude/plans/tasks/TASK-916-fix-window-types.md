# Task TASK-916: Fix window.d.ts Type Definitions for Sync API

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Synchronize `src/window.d.ts` type definitions with actual preload bridge exports, specifically adding missing sync API types like `getUnifiedStatus()`. This prevents type assertion workarounds and catches API mismatches at compile time.

## Non-Goals

- Do NOT refactor the preload bridge implementation
- Do NOT change any runtime behavior
- Do NOT add new APIs (only type existing ones)
- Do NOT modify deviceBridge.ts logic

## Deliverables

1. Update: `src/window.d.ts` - Add missing type definitions
2. Verify: `electron/preload/deviceBridge.ts` exports match types

## Acceptance Criteria

- [ ] `getUnifiedStatus()` properly typed in window.d.ts
- [ ] All sync-related APIs have matching type definitions
- [ ] No type assertions needed to use sync APIs in renderer
- [ ] `npm run type-check` passes with no new errors
- [ ] Existing code continues to work (no breaking changes)

## Implementation Notes

### Step 1: Audit deviceBridge.ts

Read `electron/preload/deviceBridge.ts` and list all exports:

```typescript
// Expected exports to verify
contextBridge.exposeInMainWorld('electron', {
  // ... existing typed methods
  getUnifiedStatus: () => ipcRenderer.invoke('get-unified-status'),
  // ... other sync methods
});
```

### Step 2: Compare with window.d.ts

Check `src/window.d.ts` for missing or mismatched types:

```typescript
interface Window {
  electron: {
    // Check each method has correct signature
    getUnifiedStatus?: () => Promise<UnifiedSyncStatus>;
    // Add missing methods
  };
}
```

### Step 3: Add Missing Types

For each missing method, add the correct type signature:

```typescript
// Example of what might need to be added
interface UnifiedSyncStatus {
  isLocked: boolean;
  lockReason?: string;
  // ... other fields based on actual return type
}

interface ElectronAPI {
  // ... existing
  getUnifiedStatus: () => Promise<UnifiedSyncStatus>;
  // ... other missing sync methods
}
```

### Step 4: Verify Type-Check

```bash
npm run type-check
```

Should pass with:
- No new errors
- No "any" type fallbacks for sync APIs
- IDE autocomplete works for sync methods

### Key Files to Examine

| File | Purpose |
|------|---------|
| `electron/preload/deviceBridge.ts` | Source of truth for exposed APIs |
| `src/window.d.ts` | Type declarations for renderer |
| `src/types/` | May contain related type definitions |
| `electron/main/handlers/` | IPC handler return types |

### Expected Missing Types (from TASK-910)

Based on SPRINT-014 TASK-910 debugging:
- `getUnifiedStatus()` - returns sync lock status
- Possibly other sync-related methods added in SPRINT-014

## Integration Notes

- Imports from: `electron/preload/deviceBridge.ts` (read-only reference)
- Exports to: All renderer code using `window.electron`
- Used by: Any component calling sync APIs
- Depends on: None (but runs after Phase 1 for clean docs baseline)

## Do / Don't

### Do:

- Match types exactly to actual return values
- Use existing type patterns from window.d.ts
- Add JSDoc comments for complex types
- Keep types in sync with IPC handlers

### Don't:

- Change runtime behavior
- Add types for non-existent methods
- Use `any` as a shortcut
- Break existing typed code

## When to Stop and Ask

- If deviceBridge.ts exports something complex that's hard to type
- If you find types that contradict actual implementations
- If multiple files define the same interface differently

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (type changes only)
- New tests to write: None
- Existing tests to update: None

### Coverage

- Coverage impact: None (types don't affect runtime)

### Integration / Feature Tests

- Required scenarios: None

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npm run type-check`)
- [ ] Lint / format checks
- [ ] All existing tests (no regressions)

## PR Preparation

- **Title**: `fix(types): sync window.d.ts with preload bridge exports`
- **Labels**: `tech-debt`, `types`
- **Depends on**: Phase 1 tasks (for clean baseline)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `tech-debt` (types subcategory)

**Raw Estimate:** 2-3 turns, ~10K tokens, 15-20 min
**Adjustment Factor:** 1.0 (no historical data for types category)

**Estimated Totals:**
- **Turns:** 2-3
- **Tokens:** ~10K
- **Time:** ~15-20 min
- **Token Cap:** 40K (4x upper estimate)

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to modify | 1 (window.d.ts) | +1 |
| Files to audit | 2-3 (deviceBridge, handlers) | +1 |
| Code volume | ~30-50 lines types | +0.5 |
| Complexity | Simple interface additions | +0 |

**Confidence:** Medium

**Risk factors:**
- May find more missing types than expected
- Type definitions may need to reference other types
- TASK-910 debugging suggests there were multiple issues

**Similar past tasks:** First types-specific task, no historical data

---

## Branch Information (SR Engineer Fills)

**Branch From:** develop (AFTER Phase 1 complete)
**Branch Into:** develop
**Branch Name:** fix/TASK-916-window-types

---

## SR Engineer Review Notes

**Review Date:** 2026-01-02 | **Status:** APPROVED

### Execution Classification

- **Parallel Safe:** N/A (Phase 2, runs alone)
- **Depends On:** Phase 1 complete (TASK-913, TASK-914, TASK-915)
- **Blocks:** TASK-917

### Shared File Analysis

| File | This Task | Conflicts With |
|------|-----------|----------------|
| `src/window.d.ts` | Type additions | None in this sprint |

### Technical Considerations

- First code task in sprint (Phase 1 is docs only)
- Type-only changes, no runtime impact
- Run full `npm run type-check` before PR
- Phase 2 gate ensures clean documentation baseline before code changes
- Should audit `electron/preload/deviceBridge.ts` first

### Worktree Command (for this task)

```bash
# After Phase 1 tasks are ALL merged:
git -C /Users/daniel/Documents/Mad pull origin develop
git -C /Users/daniel/Documents/Mad worktree add ../Mad-task-916 -b fix/TASK-916-window-types develop
```

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files audited:
- [ ] electron/preload/deviceBridge.ts
- [ ] Related IPC handlers

Files modified:
- [ ] src/window.d.ts

Types added:
- [ ] getUnifiedStatus
- [ ] <other missing types>

Verification:
- [ ] npm run type-check passes
- [ ] No new any types
- [ ] IDE autocomplete works
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If any. If none, write "None">

**Design decisions:**
<Document any decisions made>

**Issues encountered:**
<Document any issues and resolutions>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to modify | 1 | X | +/- X | <reason> |
| Files to audit | 2-3 | X | +/- X | <reason> |
| Types to add | Unknown | X | N/A | <actual count> |

**Total Variance:** Est 2-3 turns -> Actual X turns (X% over/under)

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** N/A (types only)

**Review Notes:**
<Key observations, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
