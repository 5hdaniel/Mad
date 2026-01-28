# Task TASK-960: Delete Deprecated EmailOnboardingScreen.tsx

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

Delete the deprecated `src/components/EmailOnboardingScreen.tsx` (1,203 lines) after verifying that migration to `onboarding/steps/EmailConnectStep.tsx` is complete.

## Non-Goals

- Do NOT refactor EmailConnectStep.tsx
- Do NOT add new functionality
- Do NOT modify the onboarding flow logic
- Do NOT touch any other onboarding components unless they import EmailOnboardingScreen

## Deliverables

1. **Verification:** Confirm no active usages of EmailOnboardingScreen
2. **Delete:** Remove `src/components/EmailOnboardingScreen.tsx`
3. **Cleanup:** Remove any orphaned imports referencing the deleted file
4. **Update:** Update barrel exports if needed

## Acceptance Criteria

- [ ] All usages of `EmailOnboardingScreen` identified (grep search complete)
- [ ] No active imports of EmailOnboardingScreen remain in codebase
- [ ] `src/components/EmailOnboardingScreen.tsx` deleted
- [ ] Email onboarding flow still works (manual verification of EmailConnectStep)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Bundle size reduced (noted in PR)

## Implementation Notes

### Step 1: Search for Usages

```bash
# Find all imports of EmailOnboardingScreen
grep -rn "EmailOnboardingScreen" --include="*.ts" --include="*.tsx" src/

# Check routing configuration
grep -rn "EmailOnboarding" src/App.tsx src/appCore/AppRouter.tsx

# Check barrel exports
grep -rn "EmailOnboardingScreen" src/components/index.ts
```

### Step 2: Verify Migration

The file header says it's deprecated in favor of `onboarding/steps/EmailConnectStep.tsx`. Verify:

1. EmailConnectStep.tsx exists and is functional
2. The onboarding flow uses EmailConnectStep, not EmailOnboardingScreen
3. No runtime code paths lead to EmailOnboardingScreen

### Step 3: Delete the File

```bash
rm src/components/EmailOnboardingScreen.tsx
```

### Step 4: Clean Up

1. Remove from any barrel exports (e.g., `src/components/index.ts`)
2. Fix any TypeScript errors from missing imports
3. Run all checks

### Important Details

- The file is marked `@deprecated` with migration guide in its header
- This is 1,203 lines of dead code
- If ANY active usage is found, STOP and report to PM

## Integration Notes

- Imports from: None expected (should be dead code)
- Exports to: Potentially `src/components/index.ts` (remove)
- Used by: Should be nothing after migration
- Depends on: Migration to EmailConnectStep.tsx must be complete

## Do / Don't

### Do:
- Run comprehensive search before deleting
- Verify email onboarding still works after deletion
- Document bundle size reduction in PR

### Don't:
- Delete the file if ANY active usage exists
- Modify EmailConnectStep.tsx (out of scope)
- Touch other onboarding components unless necessary for cleanup

## When to Stop and Ask

- If ANY active import of EmailOnboardingScreen is found
- If deletion causes TypeScript errors in more than 2 files
- If email onboarding flow breaks after deletion
- If you find functionality in EmailOnboardingScreen not in EmailConnectStep

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests needed
- Existing tests to update: Remove any tests for EmailOnboardingScreen if they exist
- If tests exist for the deleted file, they should also be deleted

### Coverage

- Coverage impact: May increase slightly (removing dead code)

### Integration / Feature Tests

- Required scenarios: Manual verification that email onboarding flow works

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests (no failures from deleted file)
- [ ] Type checking (no dangling imports)
- [ ] Lint / format checks
- [ ] Build succeeds

**PRs without verification of onboarding flow WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor: delete deprecated EmailOnboardingScreen.tsx`
- **Labels**: `refactor`, `cleanup`
- **Depends on**: None (first task in sprint)

---

## SR Engineer Review Notes

**Review Date:** 2026-01-04 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** develop
- **Branch Into:** develop
- **Suggested Branch Name:** `refactor/TASK-960-delete-emailonboarding`

### Execution Classification
- **Parallel Safe:** Yes
- **Depends On:** None
- **Blocks:** None

### Safety Verification (Pre-Implementation Confirmation)
- [x] `EmailOnboardingScreen.tsx` exists (1,203 lines)
- [x] `EmailConnectStep.tsx` exists and is functional (441 lines at `src/components/onboarding/steps/`)
- [x] No active imports of EmailOnboardingScreen found (grep returned 0 results)
- [x] File header contains `@deprecated` annotation with migration guide

### Technical Considerations
- Clean deletion - no active references found
- May require removing from barrel export (`src/components/index.ts`) if exported
- Low risk due to no active usages

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~10-15K

**Token Cap:** 60K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 | - |
| Files to modify | 1-3 (cleanup) | +5K |
| Files to delete | 1 (1203 lines) | +5K |
| Investigation | Usage search | +5K |

**Confidence:** High (simple deletion task)

**Risk factors:**
- Migration may be incomplete
- Unknown usages may exist

**Similar past tasks:** BACKLOG-149 estimate ~15K

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
Investigation:
- [ ] grep search completed for EmailOnboardingScreen
- [ ] No active imports found (or documented if found)

Files deleted:
- [ ] src/components/EmailOnboardingScreen.tsx

Files modified:
- [ ] <list any cleanup files>

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] Email onboarding flow manually verified
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

**Variance:** PM Est ~15K vs Actual ~XK (X% over/under)

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | X |
| Duration | X seconds |
| API Calls | X |

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** N/A
**Test Coverage:** N/A (deletion task)

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop
