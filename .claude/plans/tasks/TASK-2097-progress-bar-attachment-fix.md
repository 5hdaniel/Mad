# TASK-2097: Fix Message Import Progress Bar 67%-to-100% Jump

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

**Backlog ID:** BACKLOG-824
**Sprint:** SPRINT-106
**Branch:** `fix/task-2097-progress-bar-attachment`
**Estimated Tokens:** ~10K

---

## Objective

Fix the message import progress bar so it shows smooth increments through the attachments phase instead of jumping from ~67% to 100%. The root cause is that the attachments processing loop reports progress only every 500 items, and most users have fewer than 500 attachments.

---

## Context

In `electron/services/macOSMessagesImportService.ts` (around line 1182), the attachment processing loop has:

```typescript
if (i % 500 === 0) {
  // report progress
}
```

The message import has 3 phases, each roughly 1/3 of the progress bar. When the attachments phase (Phase 3) has fewer than 500 items, the `i % 500 === 0` condition is only true at `i=0`, so no intermediate progress is reported. The progress bar shows ~67% (end of Phase 2) and then jumps to 100% (completion).

---

## Requirements

### Must Do:
1. Change the progress reporting interval in the attachments loop to be more granular
2. Use a percentage-based approach: report at every 5-10% increment of total attachment count, OR reduce the interval to 50 or 100
3. Ensure it works correctly for both small (< 100) and large (> 1000) attachment counts
4. Ensure no performance regression from more frequent progress reporting

### Must NOT Do:
- Do NOT change the 3-phase structure of the import
- Do NOT modify the progress bar UI component itself
- Do NOT change how progress events are emitted (just change the frequency)

---

## Acceptance Criteria

- [ ] Progress bar shows smooth increments through the attachments phase
- [ ] Works correctly for users with < 100 attachments
- [ ] Works correctly for users with > 1000 attachments
- [ ] No performance regression from more frequent progress reporting
- [ ] All existing tests pass
- [ ] All CI checks pass

---

## Files to Modify

- `electron/services/macOSMessagesImportService.ts` -- Change the `i % 500` interval (around line 1182)

## Files to Read (for context)

- `electron/services/macOSMessagesImportService.ts` -- Full attachment processing loop and progress reporting pattern

---

## Testing Expectations

### Unit Tests
- **Required:** No (this is a reporting interval change)
- **Existing tests to update:** None expected unless there are tests asserting on the exact interval

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(import): reduce attachment progress reporting interval for smooth progress bar`
- **Branch:** `fix/task-2097-progress-bar-attachment`
- **Target:** `develop`

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
- [ ] electron/services/macOSMessagesImportService.ts

Features implemented:
- [ ] Reduced attachment progress reporting interval
- [ ] Smooth progress bar through attachments phase

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

**Variance:** PM Est ~10K vs Actual ~XK

### Notes

**Deviations from plan:**
<If you deviated, explain what and why>

**Issues encountered:**
<Document any challenges>

---

## SR Engineer Review (SR-Owned)

*Review Date: <DATE>*

### Agent ID

```
SR Engineer Agent ID: <agent_id from Task tool output>
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Test Coverage:** Adequate / Needs Improvement

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

---

## Guardrails

**STOP and ask PM if:**
- The progress reporting involves IPC calls that could cause performance issues at high frequency
- Other import phases use the same interval pattern and should also be updated
- You encounter blockers not covered in the task file
