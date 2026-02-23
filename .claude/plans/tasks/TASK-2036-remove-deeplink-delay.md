# Task TASK-2036: Remove Windows Deep Link Cold-Start 100ms Delay

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

Remove the unnecessary 100ms `setTimeout` wrapper around `handleDeepLinkCallback(deepLinkUrl)` in the `did-finish-load` handler in `electron/main.ts` (around line 886). The delay is unnecessary because `did-finish-load` already guarantees the renderer is ready.

## Non-Goals

- Do NOT refactor the deep link handling system
- Do NOT modify `handleDeepLinkCallback()` itself
- Do NOT change deep link behavior on macOS (this is Windows-specific cold-start code)
- Do NOT modify other setTimeout calls in main.ts

## Deliverables

1. Update: `electron/main.ts` -- remove setTimeout wrapper around `handleDeepLinkCallback`

## Acceptance Criteria

- [ ] The `setTimeout(() => handleDeepLinkCallback(deepLinkUrl), 100)` is replaced with a direct `handleDeepLinkCallback(deepLinkUrl)` call
- [ ] The `did-finish-load` handler still works correctly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] No other behavior changes in deep link handling

## Implementation Notes

### Current Code (around line 886 of electron/main.ts)

```typescript
// Inside a did-finish-load handler:
mainWindow.webContents.on('did-finish-load', () => {
  // ... other logic ...
  setTimeout(() => handleDeepLinkCallback(deepLinkUrl), 100);
});
```

### Fix

```typescript
// Remove setTimeout, call directly:
mainWindow.webContents.on('did-finish-load', () => {
  // ... other logic ...
  handleDeepLinkCallback(deepLinkUrl);
});
```

### Why the Delay is Unnecessary

- `did-finish-load` fires after the renderer process has fully loaded the page
- The renderer's IPC listeners are registered during page load
- By the time `did-finish-load` fires, the renderer is ready to receive IPC messages
- The 100ms delay was likely a precautionary measure that is no longer needed

### Key Context

- This is in the Windows cold-start path where a deep link launches the app
- The deep link URL is captured early and held until the renderer is ready
- `did-finish-load` is the correct event to wait for -- no additional delay needed

## Integration Notes

- This modifies `electron/main.ts` which TASK-2033 also reads (but TASK-2033 is read-only verification)
- TASK-2039 modifies CSP headers in the same file but in a different section
- No shared code paths with other SPRINT-091 tasks

## Do / Don't

### Do:
- Remove only the `setTimeout` wrapper, keeping the `handleDeepLinkCallback(deepLinkUrl)` call
- Preserve all surrounding logic in the `did-finish-load` handler
- Check if the `100` ms constant is used elsewhere (it should not be)

### Don't:
- Remove the `did-finish-load` event listener itself
- Modify `handleDeepLinkCallback` function
- Add new delays or workarounds
- Change deep link handling on macOS

## When to Stop and Ask

- If the setTimeout appears to be guarding against a race condition documented in comments
- If removing the delay causes test failures
- If the code structure around line 886 has changed significantly from what is described

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (removing a delay, no new logic)
- Existing tests should still pass

### Coverage

- Coverage impact: None expected

### Integration / Feature Tests

- Required scenarios: None (manual testing recommended: Windows cold-start with deep link)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(electron): remove unnecessary 100ms deep link cold-start delay`
- **Labels**: `cleanup`, `quick-win`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 1 (electron/main.ts) | +5K |
| Code volume | ~3-5 lines changed | +3K |
| Test complexity | None | +0K |

**Confidence:** High

**Risk factors:**
- Removing a delay could theoretically cause a race condition, but `did-finish-load` guarantees readiness

**Similar past tasks:** Config/cleanup tasks typically complete well under estimate with 0.5x multiplier.

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-02-21*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: ae1ce877
```

### Checklist

```
Files modified:
- [x] electron/main.ts

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
- [x] npm test passes (2 pre-existing failures in transaction-handlers.integration.test.ts, verified on develop)
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "ae1ce877" .claude/metrics/tokens.csv`

| Metric | Value |
|--------|-------|
| **Total Tokens** | (auto-captured) |
| Duration | (auto-captured) seconds |
| API Calls | (auto-captured) |
| Input Tokens | (auto-captured) |
| Output Tokens | (auto-captured) |
| Cache Read | (auto-captured) |
| Cache Create | (auto-captured) |

**Variance:** PM Est ~15K vs Actual (auto-captured)

### Notes

**Planning notes:**
Minimal change -- remove setTimeout wrapper, keep did-finish-load handler intact. No new tests needed.

**Deviations from plan:**
None

**Design decisions:**
Removed the misleading comment ("Small delay to ensure renderer is fully initialized") along with the setTimeout. Kept the accurate comment ("Wait for window to be ready before processing") since we still use did-finish-load.

**Issues encountered:**
None

**Reviewer notes:**
- 2 pre-existing test failures in `electron/__tests__/transaction-handlers.integration.test.ts` (lines 360, 418) verified on develop -- unrelated to this change.
- The change is 1 insertion, 2 deletions in electron/main.ts.

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~15K | (auto-captured) | (auto-captured) |
| Duration | - | (auto-captured) sec | - |

**Root cause of variance:**
Task was straightforward with no surprises. Expected to be under estimate.

**Suggestion for similar tasks:**
Config/cleanup tasks with 1 file, 1-3 line changes can be estimated at ~5-10K tokens.

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
