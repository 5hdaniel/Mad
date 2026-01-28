# Task TASK-1602: Reorder Windows Flow Steps

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

Reorder the Windows onboarding flow so that database initialization (via apple-driver step) happens BEFORE email connection, eliminating "Database not initialized" errors during email OAuth.

## Non-Goals

- Do NOT change the UI design of any step
- Do NOT modify the step components themselves
- Do NOT change macOS flow (that's TASK-1601)
- Do NOT remove the pending email state logic yet (that's TASK-1603)

## Deliverables

1. Update: `src/components/onboarding/flows/windowsFlow.ts` - Reorder steps
2. Update: `src/components/onboarding/__tests__/flows.test.ts` - Update test expectations

## Acceptance Criteria

- [ ] Windows flow order is: `phone-type` -> `apple-driver` -> `email-connect`
- [ ] Existing step components work in new order without modification
- [ ] State machine correctly derives current step in new order
- [ ] Flow test updated to expect new order
- [ ] All CI checks pass
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

## Implementation Notes

### Current Flow Order

```typescript
// src/components/onboarding/flows/windowsFlow.ts (current)
export const WINDOWS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",      // 1. Phone selection
  "email-connect",   // 2. Email OAuth (DB NOT READY - causes errors!)
  "apple-driver",    // 3. Apple driver setup (for iPhone users)
] as const;
```

### New Flow Order

```typescript
// src/components/onboarding/flows/windowsFlow.ts (new)
export const WINDOWS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",      // 1. Phone selection (Supabase only after TASK-1600)
  "apple-driver",    // 2. Apple driver setup (triggers DB init for iPhone users)
  "email-connect",   // 3. Email OAuth (DB IS READY!)
] as const;
```

### Why This Order

1. **phone-type**: User selects iPhone/Android. After TASK-1600, stored in Supabase (no DB needed).
2. **apple-driver**: For iPhone users, shows driver installation. DB initializes here. For Android users, this step is skipped.
3. **email-connect**: User connects email. DB is ready, no "pending" complexity needed.

### Windows DB Initialization

On Windows, DB initialization happens during the apple-driver step for iPhone users. For Android users, DB init happens implicitly. The key is that email-connect comes AFTER, so DB is always ready.

### Key Patterns

```typescript
// The flow order is a simple array - change the order, change the flow
export const WINDOWS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "apple-driver",    // Moved before email-connect
  "email-connect",
] as const;
```

### Conditional Step Display

The `apple-driver` step may be conditionally displayed based on phone type. The flow definition doesn't change this - the step component handles its own visibility or skip logic. Verify that:

1. iPhone users see the apple-driver step
2. Android users skip directly to email-connect

## Integration Notes

- Imports from: `../types` (OnboardingStepId)
- Exports to: `index.ts`, used by `OnboardingFlow` component
- Used by: `useOnboardingFlow`, `stepDerivation.ts`
- Depends on: TASK-1600 (phone type to Supabase) should ideally complete first
- Parallel with: TASK-1601 (macOS flow) - but coordinate on flows.test.ts

## Do / Don't

### Do:
- Only change the array order in `windowsFlow.ts`
- Update flow tests to expect new order
- Update JSDoc comments to reflect new order
- Verify step skipping still works for Android users

### Don't:
- Modify step components
- Change how step completion is determined
- Add conditional logic for step order
- Change the macOS flow (separate task)

## When to Stop and Ask

- If Android users have issues skipping the apple-driver step
- If DB initialization timing is different than expected on Windows
- If the apple-driver step has dependencies on email-connect
- If flows.test.ts is being modified by another task simultaneously

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write: None
- Existing tests to update:
  - `flows.test.ts` - Update expected Windows step order

### Coverage

- Coverage impact: No change (updating existing tests)

### Integration / Feature Tests

- Required scenarios:
  - Windows iPhone user: phone -> driver -> email
  - Windows Android user: phone -> email (driver skipped)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(onboarding): reorder Windows flow for DB init before email`
- **Labels**: `onboarding`, `windows`, `sprint-063`
- **Depends on**: TASK-1600 (recommended but not blocking)

---

## PM Estimate (PM-Owned)

**Category:** `config`

**Estimated Tokens:** ~6K-10K

**Token Cap:** 40K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | +0K |
| Files to modify | 2 files (flow, tests) | +4K |
| Code volume | ~15 lines changed | +2K |
| Test complexity | Low (update expected order) | +2K |

**Confidence:** High

**Risk factors:**
- Android user flow needs verification
- May conflict with TASK-1601 on flows.test.ts

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
- [ ] src/components/onboarding/flows/windowsFlow.ts
- [ ] src/components/onboarding/__tests__/flows.test.ts

Features implemented:
- [ ] Windows flow reordered: phone -> driver -> email

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

### Pre-Implementation Technical Review

**Review Date:** 2026-01-28
**Reviewer:** SR Engineer

#### Branch Information
- **Branch From:** develop (after TASK-1601 merges)
- **Branch Into:** develop
- **Suggested Branch Name:** fix/task-1602-windows-flow-order

#### Execution Classification
- **Parallel Safe:** **NO** - must wait for TASK-1601 (shared `flows.test.ts`)
- **Depends On:** TASK-1601 (BLOCKING - must merge first)
- **Blocks:** TASK-1603

#### Architecture Validation

**APPROVED** - Simple config change with minimal risk:
1. Mirrors macOS flow reorder pattern
2. Windows DB init happens during apple-driver step (or implicitly for Android)
3. No state machine changes required

#### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Android user skip logic breaks | Medium | **VERIFY**: `shouldSkipStep()` in stepDerivation.ts handles this |
| DB init timing different on Windows | Low | DB init happens during apple-driver or on first IPC call |
| Apple-driver has email dependency | Low | **VERIFIED SAFE**: Step is independent |
| Merge conflict with TASK-1601 | High | **BLOCKING DEPENDENCY**: Wait for TASK-1601 to merge first |

#### Shared File Analysis

| File | Modified By | Conflict Risk |
|------|-------------|---------------|
| `windowsFlow.ts` | TASK-1602 only | None |
| `flows.test.ts` | TASK-1601, TASK-1602 | **RESOLVED BY SEQUENCING** |

#### Technical Considerations

1. **Windows DB Initialization Path**:
   - iPhone users: DB init triggered during apple-driver step
   - Android users: DB init happens implicitly (Windows uses DPAPI, no prompt)
   - Either way, DB is ready before email-connect in new order

2. **Step Derivation Check**:
   ```typescript
   // stepDerivation.ts line 92 - apple-driver skip logic
   case "apple-driver":
     return !(platform.isWindows && phoneType === "iphone");
   ```
   - iPhone users: Step shown, DB inits here
   - Android users: Step skipped, DB inits implicitly

3. **Android User Flow After Reorder**:
   ```
   Current: phone-type -> email-connect -> (apple-driver skipped)
   New:     phone-type -> (apple-driver skipped) -> email-connect
   ```
   This is correct - Android users skip apple-driver regardless of position.

4. **stepDerivation.ts STEP_ORDER**:
   ```typescript
   export const STEP_ORDER: readonly OnboardingStep[] = [
     "phone-type",
     "secure-storage",    // macOS only
     "email-connect",
     "permissions",       // macOS only
     "apple-driver",      // Windows+iPhone only
     "android-coming-soon",
   ] as const;
   ```
   **ISSUE FOUND**: The STEP_ORDER has email-connect BEFORE apple-driver, which is the OLD order.

   **DECISION**: The Windows flow array (`windowsFlow.ts`) controls UI order. The STEP_ORDER in stepDerivation.ts is for state machine progression and should not be modified in this task (it's a separate concern).

#### Do NOT Do (Gotchas)

1. **Do NOT modify `stepDerivation.ts`** - UI flow arrays are separate from state machine step order
2. **Do NOT change android skip logic** - It works based on phoneType, not position
3. **Do NOT start until TASK-1601 is MERGED** - Test file will conflict

#### Exact Change Required

```typescript
// src/components/onboarding/flows/windowsFlow.ts
// Change line 25-29 FROM:
export const WINDOWS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "email-connect",
  "apple-driver",
] as const;

// TO:
export const WINDOWS_FLOW_STEPS: readonly OnboardingStepId[] = [
  "phone-type",
  "apple-driver",
  "email-connect",
] as const;
```

Also update JSDoc comment (lines 19-23) to reflect new order.

#### Test Updates Required

After TASK-1601 merges, update `flows.test.ts`:
```typescript
// Line 28-30: Verify Windows steps in new order
expect(steps).toContain("phone-type");      // Step 1
expect(steps).toContain("apple-driver");    // Step 2 (iPhone) or skipped (Android)
expect(steps).toContain("email-connect");   // Step 3 (iPhone) or Step 2 (Android)
```

Tests don't check order directly for Windows, just presence.

#### Status: APPROVED FOR IMPLEMENTATION

**BLOCKING DEPENDENCY**: Wait for TASK-1601 PR to be MERGED before starting implementation.

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
