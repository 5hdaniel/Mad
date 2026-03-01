# TASK-2094: Fix Thread List Unmount/Jump on Text Thread Removal

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

**Backlog ID:** BACKLOG-820
**Sprint:** SPRINT-106
**Branch:** `fix/task-2094-thread-list-unmount`
**Estimated Tokens:** ~25K

---

## Objective

Fix the thread list component so that removing a text thread from a transaction does not cause the entire list to unmount and remount. Currently, removing a thread triggers a full re-render that reloads all chats and jumps the scroll position to the top. The removal should be an in-place update.

---

## Context

When a user removes a text thread from a transaction:
1. The thread list appears to unmount entirely
2. All chats reload (visible flicker/loading state)
3. The user's scroll position is lost -- they jump to the top

This is likely caused by a state change that forces the parent component to re-render (possibly a key change on a parent element, or a full data refetch that causes React to unmount/remount the list).

---

## Requirements

### Must Do:
1. Identify the root cause of the full unmount/remount (investigate state management and component keys)
2. Fix the removal to be an in-place optimistic update -- the thread should disappear from the list without a full reload
3. Preserve scroll position after thread removal
4. Eliminate visual flicker or loading state during removal

### Must NOT Do:
- Do NOT change the thread removal API or IPC call
- Do NOT change how threads are stored in the database
- Do NOT alter the thread display format or styling (beyond removal animation if appropriate)

---

## Acceptance Criteria

- [ ] Removing a thread does not unmount/remount the thread list
- [ ] Scroll position is preserved after thread removal
- [ ] The removed thread disappears from the list without a full reload
- [ ] No visual flicker or loading state during removal
- [ ] All existing tests pass
- [ ] All CI checks pass

---

## Files to Modify

- The thread list component (likely in `src/components/transactions/` or `src/components/messages/`)
- The parent component or hook that manages thread list state

## Files to Read (for context)

- Thread list component and its parent
- The hook or service that fetches/manages thread data
- The handler for thread removal (to understand what state changes on remove)

---

## Testing Expectations

### Unit Tests
- **Required:** If the fix involves changing state management logic
- **Existing tests to update:** Any test that covers thread removal behavior

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(ui): prevent thread list unmount on text thread removal`
- **Branch:** `fix/task-2094-thread-list-unmount`
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
- [ ] Thread list component
- [ ] State management hook/parent (if applicable)

Features implemented:
- [ ] In-place optimistic thread removal
- [ ] Scroll position preservation
- [ ] Eliminated full list unmount/remount

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

**Variance:** PM Est ~25K vs Actual ~XK

### Notes

**Planning notes:**
<Root cause identified during investigation>

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
- The unmount is caused by a shared state management pattern used by multiple components (fix may have broader impact)
- The thread list uses virtualization (react-window, react-virtualized) that complicates the fix
- You discover the issue is in the IPC/service layer rather than the UI layer
- You encounter blockers not covered in the task file
