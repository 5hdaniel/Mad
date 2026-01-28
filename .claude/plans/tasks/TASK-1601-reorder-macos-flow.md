# Task TASK-1601: Reorder macOS Flow Steps

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

---

## Goal

Reorder the macOS onboarding flow so that database initialization (secure-storage step) happens BEFORE email connection, eliminating "Database not initialized" errors during email OAuth.

## Non-Goals

- Do NOT change the UI design of any step
- Do NOT modify the step components themselves
- Do NOT change Windows flow (that's TASK-1602)
- Do NOT remove the pending email state logic yet (that's TASK-1603)

## Deliverables

1. Update: `src/components/onboarding/flows/macosFlow.ts` - Reorder steps
2. Update: `src/components/onboarding/__tests__/flows.test.ts` - Update test expectations
3. Update: `src/appCore/state/machine/derivation/stepDerivation.ts` - If step derivation logic needs adjustment

## Acceptance Criteria

- [ ] macOS flow order is: `phone-type` -> `secure-storage` -> `permissions` -> `email-connect`
- [ ] Existing step components work in new order without modification
- [ ] State machine correctly derives current step in new order
- [ ] Flow test updated to expect new order
- [ ] All CI checks pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Current Flow Order

```typescript
// src/components/onboarding/flows/macosFlow.ts (current)
export const MACOS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",      // 1. Phone selection (no DB needed)
  "email-connect",   // 2. Email OAuth (DB NOT READY - causes errors!)
  "secure-storage",  // 3. Keychain setup (DB init happens here)
  "permissions",     // 4. FDA permissions
] as const;
```

### New Flow Order

```typescript
// src/components/onboarding/flows/macosFlow.ts (new)
export const MACOS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",      // 1. Phone selection (Supabase only after TASK-1600)
  "secure-storage",  // 2. Keychain setup (DB init happens here)
  "permissions",     // 3. FDA permissions
  "email-connect",   // 4. Email OAuth (DB IS READY!)
] as const;
```

### Why This Order

1. **phone-type**: User selects iPhone/Android. After TASK-1600, stored in Supabase (no DB needed).
2. **secure-storage**: User sees Keychain explanation, grants access. DB initializes here.
3. **permissions**: User grants Full Disk Access for iMessage. Quick step.
4. **email-connect**: User connects email. DB is ready, no "pending" complexity needed.

### Key Patterns

The flow order is defined in a single constant. Changing the array order changes the flow:

```typescript
// The OnboardingFlow component uses this array to determine step order
// Navigation uses array index to find current/next/previous steps
const currentIndex = steps.indexOf(currentStepId);
const nextStep = steps[currentIndex + 1];
```

### Step Derivation

Check `stepDerivation.ts` to ensure it correctly maps completed steps to the current step in the new order. The derivation logic should be order-agnostic, but verify:

```typescript
// In stepDerivation.ts - should work with any order
export function deriveCurrentOnboardingStep(state: OnboardingState): OnboardingStepId {
  const flow = getFlowForPlatform(state.platform);
  for (const step of flow.steps) {
    if (!isStepComplete(state, step)) {
      return step;
    }
  }
  return flow.steps[flow.steps.length - 1];
}
```

## Integration Notes

- Imports from: `../types` (OnboardingStepId)
- Exports to: `index.ts`, used by `OnboardingFlow` component
- Used by: `useOnboardingFlow`, `stepDerivation.ts`
- Depends on: TASK-1600 (phone type to Supabase) should ideally complete first
- Blocks: TASK-1603 (can start after this)

## Do / Don't

### Do:
- Only change the array order in `macosFlow.ts`
- Update flow tests to expect new order
- Verify step derivation still works
- Update JSDoc comments to reflect new order

### Don't:
- Modify step components
- Change how step completion is determined
- Add conditional logic for step order
- Change the Windows flow (separate task)

## When to Stop and Ask

- If step derivation logic is tightly coupled to old order
- If step components have hardcoded "next step" logic
- If you find references to the old order that need coordination
- If the new order causes test failures beyond flow.test.ts

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write: None
- Existing tests to update:
  - `flows.test.ts` - Update expected macOS step order

### Coverage

- Coverage impact: No change (updating existing tests)

### Integration / Feature Tests

- Required scenarios:
  - macOS flow progresses through steps in new order
  - Step derivation correctly identifies current step

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(onboarding): reorder macOS flow for DB init before email`
- **Labels**: `onboarding`, `macos`, `sprint-063`
- **Depends on**: TASK-1600 (recommended but not blocking)

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~8K-12K

**Token Cap:** 48K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 2-3 files (flow, tests, maybe derivation) | +5K |
| Code volume | ~20 lines changed | +2K |
| Test complexity | Low (update expected order) | +3K |

**Confidence:** High

**Risk factors:**
- Step derivation logic might need adjustment
- Hardcoded step references elsewhere

**Similar past tasks:** Config category applies 0.5x multiplier

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
- [ ] src/components/onboarding/flows/macosFlow.ts
- [ ] src/components/onboarding/__tests__/flows.test.ts
- [ ] src/appCore/state/machine/derivation/stepDerivation.ts (if needed)

Features implemented:
- [ ] macOS flow reordered: phone -> storage -> perms -> email

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

**Variance:** PM Est ~10K vs Actual ~XK (X% over/under)

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

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~10K | ~XK | +/-X% |
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

### Pre-Implementation Technical Review

**Review Date:** 2026-01-28
**Reviewer:** SR Engineer

#### Branch Information
- **Branch From:** develop (after SPRINT-062 merges)
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1601-macos-flow-order

#### Execution Classification
- **Parallel Safe:** **NO** - shares `flows.test.ts` with TASK-1602
- **Depends On:** TASK-1600 (recommended, not blocking)
- **Blocks:** TASK-1602 (must complete first to avoid test conflicts), TASK-1603

#### Architecture Validation

**APPROVED** - Simple config change with significant architectural benefit:
1. Fixes root cause of "Database not initialized" errors
2. No state machine changes required
3. Step derivation logic is order-agnostic (verified below)

#### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Step derivation tied to old order | Low | **VERIFIED SAFE**: `stepDerivation.ts` uses `STEP_ORDER` constant, not flow arrays |
| Components have hardcoded next steps | Low | **VERIFIED SAFE**: Components use `USE_NEW_ONBOARDING` flag to delegate navigation |
| Test file conflict with TASK-1602 | Medium | **Execute sequentially**: TASK-1601 first, then TASK-1602 |

#### Shared File Analysis

| File | Modified By | Conflict Risk |
|------|-------------|---------------|
| `macosFlow.ts` | TASK-1601 only | None |
| `flows.test.ts` | TASK-1601, TASK-1602 | **HIGH** - Sequential execution required |
| `stepDerivation.ts` | None | None (uses separate `STEP_ORDER` constant) |

#### Technical Considerations

1. **Current Flow vs Step Derivation (CRITICAL)**:
   - `macosFlow.ts` defines UI flow: `["phone-type", "email-connect", "secure-storage", "permissions"]`
   - `stepDerivation.ts` has separate `STEP_ORDER`: `["phone-type", "secure-storage", "email-connect", "permissions", "apple-driver", "android-coming-soon"]`

   **IMPORTANT**: The step derivation already has the CORRECT order! The bug is only in `macosFlow.ts`.

2. **Two Flow Systems**:
   - **UI Flows** (`macosFlow.ts`): Used by `OnboardingFlow` component for rendering
   - **Step Derivation** (`stepDerivation.ts`): Used by state machine for determining next step

   Both need to be aligned. The step derivation is already correct.

3. **Test File Update Strategy**:
   - Update expected order in `flows.test.ts` line 23 and line 72-74
   - Tests check that steps match `MACOS_FLOW_STEPS` constant

4. **Verified: OnboardingFlow Uses Flow Array**:
   - `OnboardingFlow` component iterates over `getFlowSteps(platform)`
   - Index-based navigation works with any array order

#### Do NOT Do (Gotchas)

1. **Do NOT modify `stepDerivation.ts`** - It already has correct order
2. **Do NOT change `STEP_ORDER` constant** - It's canonical for state machine
3. **Do NOT update step components** - They are order-agnostic

#### Exact Change Required

```typescript
// src/components/onboarding/flows/macosFlow.ts
// Change line 26-31 FROM:
export const MACOS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "email-connect",
  "secure-storage",
  "permissions",
] as const;

// TO:
export const MACOS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "secure-storage",
  "permissions",
  "email-connect",
] as const;
```

Also update JSDoc comment (lines 19-24) to reflect new order.

#### Test Updates Required

```typescript
// flows.test.ts - Update these assertions:
// Line 23: Order expectation for macOS
expect(steps).toContain("secure-storage");  // Now step 2
expect(steps).toContain("permissions");     // Now step 3
expect(steps).toContain("email-connect");   // Now step 4

// Line 72-74: Verify exact order matches new constant
```

#### Status: APPROVED FOR IMPLEMENTATION

**EXECUTION ORDER**: Must complete BEFORE TASK-1602 to avoid test file merge conflicts.

---

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
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

**A task is NOT complete until the PR is MERGED (not just approved).**

```bash
# Verify merge state
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
