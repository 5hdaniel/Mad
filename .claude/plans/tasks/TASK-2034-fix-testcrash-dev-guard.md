# Task TASK-2034: Fix window.__testCrash Exposed in Production

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

Fix the dev-only guard in `src/contexts/NetworkContext.tsx` so that `window.__testCrash` and `window.__testOffline` are only exposed in development builds, not in production. The current guard uses `!win.isPackaged` which is always `true` in the renderer because `window.isPackaged` is `undefined`.

## Non-Goals

- Do NOT refactor NetworkContext beyond fixing the guard condition
- Do NOT add new test crash utilities
- Do NOT modify the actual crash/offline test functionality
- Do NOT search for other instances of `isPackaged` checks in renderer code (that is a separate audit)

## Deliverables

1. Update: `src/contexts/NetworkContext.tsx` -- replace `!win.isPackaged` with `import.meta.env.DEV`

## Acceptance Criteria

- [ ] `window.__testCrash` is only defined when `import.meta.env.DEV` is true
- [ ] `window.__testOffline` is only defined when `import.meta.env.DEV` is true
- [ ] `!win.isPackaged` check is removed from lines 137-144
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No other behavior changes in NetworkContext

## Implementation Notes

### Current Code (Lines 137-144 of NetworkContext.tsx)

```typescript
// Current (BROKEN):
const win = window as any;
if (!win.isPackaged) {
  win.__testCrash = () => { /* crash logic */ };
  win.__testOffline = () => { /* offline logic */ };
}
```

The problem: `window.isPackaged` is `undefined` in the renderer process. `!undefined` is `true`, so these test utilities are ALWAYS exposed, even in packaged production builds.

### Fix

```typescript
// Fixed:
if (import.meta.env.DEV) {
  const win = window as any;
  win.__testCrash = () => { /* crash logic */ };
  win.__testOffline = () => { /* offline logic */ };
}
```

`import.meta.env.DEV` is a Vite compile-time constant that is `true` in development and `false` in production. In production builds, Vite tree-shakes the entire block.

### Key Patterns

- `import.meta.env.DEV` -- Vite built-in, no import needed
- Move the `const win = window as any;` inside the `if` block since it is only needed there
- Keep the crash/offline logic exactly as-is; only change the guard condition

## Integration Notes

- This file (`src/contexts/NetworkContext.tsx`) is not modified by any other SPRINT-091 task
- No imports or exports change
- No type changes

## Do / Don't

### Do:
- Use `import.meta.env.DEV` (Vite standard)
- Keep all existing crash/offline test functionality intact
- Move the `window as any` cast inside the `if` block

### Don't:
- Use `process.env.NODE_ENV` (not available in Vite renderer)
- Remove the test crash/offline functionality entirely
- Add new window globals
- Refactor the rest of NetworkContext

## When to Stop and Ask

- If `import.meta.env.DEV` is not available in the project's Vite config
- If there are other `isPackaged` checks in renderer code that look similarly broken -- report them but do not fix (out of scope)

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Verify `window.__testCrash` is not defined when `import.meta.env.DEV` is false
- Existing tests to update:
  - Any NetworkContext tests that reference `__testCrash` or `__testOffline`

### Coverage

- Coverage impact: Should not decrease

### Integration / Feature Tests

- Required scenarios: None

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(security): guard testCrash/testOffline behind import.meta.env.DEV`
- **Labels**: `security`, `bug`, `quick-win`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `security`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 (NetworkContext.tsx) | +5K |
| Code volume | ~5-10 lines changed | +3K |
| Test complexity | Low (1 new test) | +7K |

**Confidence:** High

**Risk factors:**
- Straightforward fix with clear before/after

**Similar past tasks:** TASK-1118 (fix env var exposure) -- similar security guard fix.

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
- [ ] src/contexts/NetworkContext.tsx

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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase>

**Deviations from plan:**
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | ~XK | +/-X% |
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

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
