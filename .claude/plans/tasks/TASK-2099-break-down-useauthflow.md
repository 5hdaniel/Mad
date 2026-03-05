# Task TASK-2099: Break Down useAuthFlow Hook

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

Decompose `useAuthFlow.ts` (currently 335 lines) into focused sub-hooks with single responsibilities, then re-export the same public API so callers are unaffected.

## Non-Goals

- Do NOT refactor `useEmailHandlers.ts` (279 lines, under 300-line threshold)
- Do NOT change the public API of `useAuthFlow` -- all callers must work without modification
- Do NOT add new features or change behavior
- Do NOT modify any component files that import useAuthFlow

## Deliverables

1. New file: `src/appCore/state/flows/auth/useLoginHandlers.ts` -- login success, pending OAuth, deep link auth
2. New file: `src/appCore/state/flows/auth/useLogoutHandler.ts` -- logout logic
3. New file: `src/appCore/state/flows/auth/useTermsHandlers.ts` -- accept/decline terms
4. New file: `src/appCore/state/flows/auth/index.ts` -- barrel export
5. Update: `src/appCore/state/flows/useAuthFlow.ts` -- compose from sub-hooks, keep same export signature

## Acceptance Criteria

- [ ] `useAuthFlow.ts` is under 100 lines (composition + re-export only)
- [ ] Each sub-hook file is under 120 lines
- [ ] The `UseAuthFlowReturn` interface is unchanged
- [ ] The `UseAuthFlowOptions` interface is unchanged
- [ ] All existing imports of `useAuthFlow` work without modification
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (all existing tests)
- [ ] No behavior changes -- pure structural refactor

## Implementation Notes

### Current Structure (335 lines)

The hook contains these logical blocks:

| Block | Lines | Suggested Sub-Hook |
|-------|-------|--------------------|
| `handleLoginSuccess` callback | 130-174 | `useLoginHandlers` |
| `handleLoginPending` callback | 175-186 | `useLoginHandlers` |
| `handleDeepLinkAuthSuccess` callback | 187-251 | `useLoginHandlers` |
| `handleLogout` callback | 252-265 | `useLogoutHandler` |
| `handleAcceptTerms` callback | 266-297 | `useTermsHandlers` |
| `handleDeclineTerms` callback | 298-end | `useTermsHandlers` |

### Key Patterns

```typescript
// src/appCore/state/flows/auth/useLoginHandlers.ts
import { useCallback } from "react";
import { authService } from "@/services";
import type { UseAuthFlowOptions } from "../useAuthFlow";

export function useLoginHandlers(options: Pick<UseAuthFlowOptions, 'login' | 'isAuthenticated'>) {
  const handleLoginSuccess = useCallback(/* ... */, [/* deps */]);
  const handleLoginPending = useCallback(/* ... */, []);
  const handleDeepLinkAuthSuccess = useCallback(/* ... */, [/* deps */]);

  return { handleLoginSuccess, handleLoginPending, handleDeepLinkAuthSuccess };
}
```

```typescript
// src/appCore/state/flows/useAuthFlow.ts (after refactor)
import { useLoginHandlers } from "./auth/useLoginHandlers";
import { useLogoutHandler } from "./auth/useLogoutHandler";
import { useTermsHandlers } from "./auth/useTermsHandlers";

export function useAuthFlow(options: UseAuthFlowOptions): UseAuthFlowReturn {
  const { handleLoginSuccess, handleLoginPending, handleDeepLinkAuthSuccess } = useLoginHandlers(options);
  const { handleLogout } = useLogoutHandler(options);
  const { handleAcceptTerms, handleDeclineTerms } = useTermsHandlers(options);

  return {
    handleLoginSuccess,
    handleLoginPending,
    handleDeepLinkAuthSuccess,
    handleLogout,
    handleAcceptTerms,
    handleDeclineTerms,
    // ... any remaining state
  };
}
```

### Important Details

- The `DEFAULT_PENDING_ONBOARDING` constant and `PendingOnboardingData` type should move to a shared location or the sub-hook that uses it
- `useState` calls for local state (like `pendingOAuth`) stay in the appropriate sub-hook that owns that state
- The `useMemo` at the end of the hook for the return value can be removed if the composition is clean enough
- Preserve the JSDoc comments on the main `useAuthFlow` function

## Integration Notes

- **Imports from:** `@/services` (authService), various type imports
- **Exports to:** Components that use `useAuthFlow` (do NOT change these)
- **Used by:** `src/appCore/state/machine/` and related orchestration code
- **Depends on:** No other sprint tasks

## Do / Don't

### Do:
- Keep the exact same `UseAuthFlowReturn` type signature
- Move `useCallback` dependencies correctly to sub-hooks
- Create a clean barrel export in `auth/index.ts`
- Preserve all logger calls and error handling

### Don't:
- Change callback behavior or error handling logic
- Remove or rename any exported function
- Add new parameters or return values
- Modify any files outside `src/appCore/state/flows/`

## When to Stop and Ask

- If `UseAuthFlowOptions` needs modification to support sub-hook composition
- If any component directly imports individual callbacks (not via `useAuthFlow`)
- If circular dependencies arise between sub-hooks
- If moving state between hooks changes render behavior

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests
- Existing tests to update:
  - Any test that imports from `useAuthFlow` -- verify they still work
  - If tests mock internal functions, update import paths

### Coverage

- Coverage impact: Must not decrease

### Integration / Feature Tests

- Required scenarios:
  - Login flow works end-to-end (manual)
  - Logout works (manual)
  - Terms acceptance works (manual)

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(auth): decompose useAuthFlow into focused sub-hooks`
- **Labels**: `refactor`, `tech-debt`
- **Depends on**: None

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 4 new files (3 sub-hooks + barrel) | +8K |
| Files to modify | 1 file (useAuthFlow.ts) | +5K |
| Code volume | ~335 lines redistributed | +5K |
| Test complexity | Low (no new tests, just import paths) | +2K |

**Adjustment:** refactor x 0.5 applied. Base estimate ~50K, adjusted to ~25K.

**Confidence:** High

**Risk factors:**
- Callback dependency arrays may need careful migration
- State sharing between sub-hooks needs clean interfaces

**Similar past tasks:** TASK-513-521 (TransactionList refactoring, SPRINT-008) -- similar decomposition pattern

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
Files created:
- [ ] src/appCore/state/flows/auth/useLoginHandlers.ts
- [ ] src/appCore/state/flows/auth/useLogoutHandler.ts
- [ ] src/appCore/state/flows/auth/useTermsHandlers.ts
- [ ] src/appCore/state/flows/auth/index.ts

Features implemented:
- [ ] useAuthFlow decomposed into 3 sub-hooks
- [ ] Public API unchanged
- [ ] All callers work without modification

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

**Variance:** PM Est ~25K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~25K | ~XK | +/-X% |
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
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
