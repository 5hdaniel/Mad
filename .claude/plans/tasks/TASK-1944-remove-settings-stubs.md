# Task TASK-1944 + TASK-1945: Remove Settings UI Stubs (Auto Export + Dark Mode)

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

**PR Lifecycle Reference:** `.claude/docs/shared/pr-lifecycle.md`

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

## Goal

Remove the disabled "Auto Export" and "Dark Mode" TODO stub blocks from `Settings.tsx` and remove the corresponding test assertions from `Settings.test.tsx`. These are placeholder UI elements with `opacity-50` that should not be shown to users.

## Non-Goals

- Do NOT implement auto export functionality
- Do NOT implement dark mode
- Do NOT modify any other settings sections
- Do NOT refactor surrounding code beyond removing the stubs

## Deliverables

1. Update: `src/components/Settings.tsx` -- remove Auto Export and Dark Mode blocks
2. Update: `src/components/__tests__/Settings.test.tsx` -- remove related test assertions

## Acceptance Criteria

- [ ] The `{/* Auto Export */}` block (lines 501-518 approximately) is completely removed from `Settings.tsx`
- [ ] The `{/* Dark Mode */}` block (lines 520-535 approximately) is completely removed from `Settings.tsx`
- [ ] The test `"should show auto export toggle (disabled/coming soon)"` is removed from `Settings.test.tsx`
- [ ] The test `"should show dark mode toggle (coming soon)"` is removed from `Settings.test.tsx`
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (all remaining tests still pass)

## Implementation Notes

### Settings.tsx Changes

Delete the entire block from `{/* Auto Export */}` comment through the closing `</div>` of that section. Then delete the entire block from `{/* Dark Mode */}` comment through its closing `</div>`. The blocks are adjacent and look like:

```tsx
{/* Auto Export */}
{/* TODO: Implement automatic daily export functionality */}
<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50">
  ...
</div>

{/* Dark Mode */}
{/* TODO: Implement dark mode theme system */}
<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 opacity-50">
  ...
</div>
```

After removal, the notifications toggle (the block ending around line 498) should be immediately followed by `</div>` closing the `space-y-4` container and then `</div>` closing the section, then `{/* Email Connections */}` begins.

### Settings.test.tsx Changes

Remove these two test cases (lines 389-403 approximately):

```typescript
it("should show auto export toggle (disabled/coming soon)", async () => {
  renderSettings({ userId: mockUserId, onClose: mockOnClose });
  expect(screen.getByText("Auto Export")).toBeInTheDocument();
  expect(screen.getByText(/automatically export new transactions/i)).toBeInTheDocument();
});

it("should show dark mode toggle (coming soon)", async () => {
  renderSettings({ userId: mockUserId, onClose: mockOnClose });
  expect(screen.getByText("Dark Mode")).toBeInTheDocument();
  expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
});
```

Verify the surrounding `describe` block still has at least one test case remaining (the notifications test before these should remain).

## Integration Notes

- No other files import or reference these stubs
- No other tasks in this sprint touch `Settings.tsx`
- Standalone change, no dependencies

## Do / Don't

### Do:
- Remove only the specified blocks and their tests
- Verify the JSX structure remains valid after removal
- Run all three checks (`type-check`, `lint`, `test`)

### Don't:
- Do NOT touch any other settings sections
- Do NOT remove the notifications toggle (it's the block ABOVE the auto export stub)
- Do NOT restructure the settings layout
- Do NOT add any new functionality

## When to Stop and Ask

- If the auto export or dark mode blocks are not where expected (moved or refactored)
- If removing the blocks causes JSX structure issues (mismatched tags)
- If more than 2 files need modification

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Update existing tests only (removal)
- New tests to write: None
- Existing tests to update:
  - Remove auto export test assertion
  - Remove dark mode test assertion

### Coverage

- Coverage impact: May increase slightly (removing untestable disabled UI)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

## PR Preparation

- **Title**: `fix(settings): remove auto export and dark mode placeholder stubs`
- **Base**: `develop`
- **Labels**: `cleanup`, `ui`

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~5K (cleanup multiplier x0.5 applied to ~10K base)

**Token Cap:** 20K (4x upper estimate)

> If you reach this cap, STOP and report to PM.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | 2 files (Settings.tsx, Settings.test.tsx) | +3K |
| Code volume | ~50 lines to delete | +2K |
| Test complexity | Low (removal only) | +0K |

**Confidence:** High

**Risk factors:**
- Very low risk -- pure deletion task

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
- [ ] src/components/Settings.tsx
- [ ] src/components/__tests__/Settings.test.tsx

Features implemented:
- [ ] Auto export stub removed
- [ ] Dark mode stub removed
- [ ] Related tests removed

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

**Variance:** PM Est ~5K vs Actual ~XK (X% over/under)

### Notes

**Issues encountered:**
<Document any issues>

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
