# Task TASK-1112: Fix UI Freeze in AttachMessagesModal

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

Fix the UI freeze that occurs when opening the AttachMessagesModal to view/select messages for linking to a transaction. The app becomes unresponsive despite the contact-first interface implemented in BACKLOG-173.

## Non-Goals

- Do NOT completely rewrite the AttachMessagesModal
- Do NOT change the visual design of the modal
- Do NOT modify the message linking API
- Do NOT implement message search (separate feature)

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx`
2. Possibly update: Related hooks or API handlers
3. Add: Performance monitoring/debugging if needed

## Acceptance Criteria

- [ ] AttachMessagesModal opens without UI freeze
- [ ] UI remains responsive during message loading
- [ ] Works with large message databases (500K+ messages)
- [ ] Contact selection is smooth
- [ ] Thread loading for selected contact is fast
- [ ] All existing functionality preserved
- [ ] All existing tests pass
- [ ] All CI checks pass

## Implementation Notes

### Background

BACKLOG-173 / PR #353 implemented a contact-first interface to avoid loading all messages at once. The fix was supposed to:
1. Show contacts first (not all messages)
2. Only load messages for selected contact

However, the freeze is still occurring, indicating either:
1. Regression in the contact-first fix
2. Different code path being triggered
3. Incomplete fix for certain scenarios

### Investigation Steps

1. **Profile the freeze:**
   - Use React DevTools Profiler to identify slow renders
   - Check Chrome DevTools Performance tab for blocking operations
   - Add timing logs to identify the bottleneck

2. **Check code paths:**
   - Verify `getMessageContacts` is called on mount (not `getUnlinkedMessages`)
   - Check if any effect is loading all messages
   - Verify lazy loading when contact is selected

3. **Check for regressions:**
   - Compare current code to PR #353 implementation
   - Look for any changes that might have reintroduced the issue

### Key Files

1. `AttachMessagesModal.tsx` - Main component
2. Backend handlers for message queries
3. Related hooks

### Current Implementation (from code review)

The modal has two views: "contacts" and "threads"

```typescript
// Load contacts on mount
useEffect(() => {
  async function loadContacts() {
    // This should be fast - just gets contacts with unlinked messages
    const result = await window.api.transactions.getMessageContacts(userId);
    // ...
  }
  loadContacts();
}, [userId]);

// Load threads when contact selected
useEffect(() => {
  if (!selectedContact) return;
  async function loadContactMessages() {
    // This loads messages for ONE contact only
    const result = await window.api.transactions.getMessagesByContact(userId, selectedContact);
    // ...
  }
  loadContactMessages();
}, [userId, selectedContact]);
```

### Potential Causes

1. **getMessageContacts is slow** - May be loading too much data
2. **Initial render blocking** - Heavy computation during first render
3. **Re-renders from state updates** - Multiple rapid state changes causing freeze
4. **Large contact list** - If user has many contacts with messages
5. **Synchronous operations** - Database queries blocking main thread

### Likely Fix Areas

1. **Add pagination to contact list** - If contact list is large
2. **Virtualize contact list** - Use react-window or similar
3. **Optimize getMessageContacts query** - May need index or optimization
4. **Add loading states** - Show spinner immediately
5. **Defer initial load** - Use setTimeout or requestIdleCallback

## Integration Notes

- Imports from: MessageThreadCard utilities
- Exports to: None
- Used by: TransactionMessagesTab
- Depends on: TASK-1110 may provide insights (attachment handling)

## Do / Don't

### Do:

- Profile first, then optimize
- Add timing logs to identify the exact bottleneck
- Consider virtualization for large lists
- Test with realistic data volumes (500K+ messages)
- Ensure fix doesn't break existing functionality

### Don't:

- Don't optimize blindly without profiling
- Don't completely rewrite the component
- Don't add artificial delays to "spread out" work
- Don't break the contact-first pattern

## When to Stop and Ask

- If the freeze is caused by a backend query taking >5 seconds
- If virtualization is needed but would require significant refactoring
- If the fix requires changes to the database schema
- If you discover the freeze is in a shared component

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (performance fix)
- New tests to write: None
- Existing tests to update: Ensure existing tests still pass

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Open modal with large contact list
  - Select contact with many threads
  - Navigate back and forth
  - Verify no freeze at any point

### Manual Testing (Critical for this task)

- Test with production-like data volumes
- Use Chrome DevTools to verify no long tasks
- Test on slower hardware if possible

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(messages): prevent UI freeze in AttachMessagesModal`
- **Labels**: `bug`, `performance`
- **Depends on**: Phase 1 tasks (TASK-1109, 1110, 1111, 1113)

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-17 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop (after Phase 1 PRs merged)
- **Branch Into:** develop
- **Suggested Branch Name:** fix/TASK-1112-attach-modal-freeze

### Execution Classification
- **Parallel Safe:** No - Phase 2 task
- **Depends On:** TASK-1109, TASK-1110, TASK-1111, TASK-1113 (all Phase 1 tasks)
- **Blocks:** None - final task in sprint

### Shared File Analysis
- **Primary file:** `src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx`
- **Secondary files (possible):** Backend query handlers, related hooks
- **Conflicts with:** None - Phase 2 isolation ensures no conflicts

### Technical Considerations
1. **Profile First:** Use React DevTools Profiler and Chrome Performance tab before making changes. Identify the specific bottleneck.
2. **BACKLOG-173 Review:** The contact-first interface was implemented in PR #353 - verify this is still working or identify regression.
3. **Potential Causes:**
   - `getMessageContacts` query may be slow with large datasets
   - Initial render may be doing heavy computation
   - State updates causing cascade re-renders
4. **Virtualization:** If contact list is large (1000+), consider `react-window` or similar virtualization library.
5. **Risk:** Medium-High - performance debugging is unpredictable.

### Architecture Notes
- `AttachMessagesModal` follows contact-first pattern (load contacts, then threads on selection)
- Ensure fix doesn't reintroduce the original "load all messages at once" pattern
- If backend query optimization is needed, that may be a separate task

### Profiling Strategy for Engineer
1. Open Chrome DevTools Performance tab before opening modal
2. Click "Record", then open the modal
3. Stop recording and identify:
   - Long tasks (>50ms)
   - Heavy scripting blocks
   - Excessive re-renders
4. Document findings in Implementation Summary

### Phase 2 Benefits
- Phase 1 tasks may reveal patterns useful here (e.g., TASK-1110 attachment handling)
- Stable codebase reduces variables during performance debugging
- More time for thorough profiling without parallel work interference

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~35-45K

**Token Cap:** 180K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Investigation | Profiling and diagnosis | +15K |
| Implementation | Performance fix | +15K |
| Testing | Manual perf testing | +10K |
| Complexity | Medium-High - performance debugging | - |

**Confidence:** Medium

**Risk factors:**
- Root cause not yet identified
- May require virtualization (more complex)
- May be backend issue (separate fix needed)
- Large data volumes hard to test

**Similar past tasks:** BACKLOG-173 was ~40K

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
- [ ] src/components/transactionDetailsModule/components/modals/AttachMessagesModal.tsx
- [ ] <other files>

Features implemented:
- [ ] Modal opens without freeze
- [ ] UI remains responsive

Root cause identified:
- [ ] <describe root cause>

Fix applied:
- [ ] <describe fix>

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Manual testing with large dataset
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |
| Input Tokens | X |
| Output Tokens | X |
| Cache Read | X |
| Cache Create | X |

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Performance Metrics (Task-Specific)

| Metric | Before | After |
|--------|--------|-------|
| Time to modal open | X ms | X ms |
| Time to contact selection | X ms | X ms |
| Time to thread load | X ms | X ms |
| Longest blocking task | X ms | X ms |

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** Adequate / Needs Improvement
**Performance Verification:** PASS / FAIL

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
