# Task TASK-1165: Fix Transactions.test.tsx Missing Mock

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

Fix the missing mock in `Transactions.test.tsx` that is causing test failures.

## Non-Goals

- Do NOT refactor Transactions component
- Do NOT add new test coverage beyond fixing the mock
- Do NOT modify other test files

## Deliverables

1. Update: `src/components/__tests__/Transactions.test.tsx` (or similar location)

## Acceptance Criteria

- [ ] Missing mock identified and added
- [ ] All Transactions.test.tsx tests pass
- [ ] No new test failures introduced
- [ ] All CI checks pass

## Implementation Notes

### Investigation Steps

1. Run the failing test to see the exact error:
```bash
npm test -- --testPathPattern="Transactions.test"
```

2. Common missing mock causes:
   - Window.api calls not mocked
   - Context providers not wrapped
   - Service/hook dependencies not mocked
   - Router not provided

### Common Mock Patterns

**Window API Mock:**
```typescript
beforeEach(() => {
  (window as any).api = {
    invoke: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    // ... other methods
  };
});
```

**Context Provider Mock:**
```typescript
const wrapper = ({ children }) => (
  <SomeContext.Provider value={mockValue}>
    {children}
  </SomeContext.Provider>
);
```

**Hook Mock:**
```typescript
jest.mock('@/hooks/useSomeHook', () => ({
  useSomeHook: () => ({
    value: 'mocked',
    action: jest.fn(),
  }),
}));
```

### Finding the Issue

1. Check test file for existing mocks
2. Look at Transactions component imports
3. Identify which dependencies aren't mocked
4. Add minimal mock to fix the issue

## Integration Notes

- Imports from: Transactions component and its dependencies
- Exports to: N/A (test file only)
- Used by: CI pipeline
- Depends on: None

## Do / Don't

### Do:

- Keep the fix minimal and targeted
- Follow existing mock patterns in the codebase
- Verify fix with `npm test`

### Don't:

- Don't refactor the component under test
- Don't add unrelated test coverage
- Don't change the component implementation

## When to Stop and Ask

- If the test failure is due to a real bug (not missing mock)
- If multiple tests require significant mock changes
- If the component structure has fundamentally changed

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: This IS a test fix
- Verify:
  - All Transactions.test.tsx tests pass
  - No new test failures

### Coverage

- Coverage impact: Should not decrease coverage

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(test): add missing mock in Transactions.test.tsx`
- **Labels**: `fix`, `test`, `sprint-051`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~3K-7K

**Token Cap:** 20K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 1 test file | +3K |
| Code volume | ~20-50 lines | +2K |
| Test complexity | Low (adding mock) | +0K |

**Confidence:** High

**Risk factors:**
- May require investigating multiple potential causes

**Similar past tasks:** BACKLOG-423 originally estimated ~5K

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
- [ ] src/components/__tests__/Transactions.test.tsx

Features implemented:
- [ ] Missing mock added
- [ ] Tests passing

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

**Variance:** PM Est ~5K vs Actual ~XK (X% over/under)

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
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
