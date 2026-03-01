# Task TASK-2090: Code Quality Fixes - src/ (unused vars, trivial conditionals)

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

Fix approximately 72 code quality CodeQL alerts in the `src/` directory, primarily unused variables/imports, trivial conditionals, and useless assignments in React components, hooks, and test files.

## Non-Goals

- Do NOT fix alerts in `electron/` directory (owned by TASK-2091)
- Do NOT fix alerts in files owned by TASK-2088 or TASK-2089
- Do NOT refactor components beyond removing unused code
- Do NOT change component behavior or logic
- Do NOT add new features

## Deliverables

1. Update: All files in `src/` with CodeQL code quality alerts
2. Primary files (by alert count from user's analysis):
   - `src/appCore/AppRouter.tsx` (8 alerts)
   - `src/components/Login.tsx` (8 alerts)
   - Various test files (4+ alerts each)
   - Various hooks and components (1-3 alerts each)

## Scope: Alert Rules to Fix

### Alert Types in Scope

| Rule | Count (approx) | Description |
|------|----------------|-------------|
| `js/unused-local-variable` | ~55-60 | Variables declared but never used. Includes unused imports. |
| `js/trivial-conditional` | ~5-6 | Conditions that always evaluate to the same value (e.g., `if (true)`, redundant null checks). |
| `js/useless-assignment-to-local` | ~4-5 | Assigning to a local variable that is never read afterward. |
| `js/useless-assignment-to-property` | ~1-2 | Assigning to a property that is immediately overwritten. |
| `js/useless-comparison-test` | ~1-2 | Comparison that always has the same result. |
| `js/unneeded-defensive-code` | ~1 | Defensive code that can never trigger. |
| `js/comparison-between-incompatible-types` | ~1 | Comparing values of incompatible types. |
| `js/useless-conditional` (in test) | ~1 | Conditional in test that always takes same branch. |

### How to Find Exact Alerts

```bash
# List all open CodeQL alerts in src/
gh api repos/{owner}/{repo}/code-scanning/alerts --paginate -q '.[] | select(.state=="open") | select(.most_recent_instance.location.path | startswith("src/")) | "\(.rule.id) \(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line)"' | sort
```

### Top Files (from user's analysis)

| File | Alert Count | Primary Rules |
|------|-------------|---------------|
| `src/appCore/AppRouter.tsx` | 8 | unused-local-variable |
| `src/components/Login.tsx` | 8 | unused-local-variable |
| Various test files (`__tests__/`) | 4+ each | unused-local-variable |
| Various components | 1-3 each | mixed |

## Acceptance Criteria

- [ ] All `js/unused-local-variable` alerts in `src/` are resolved
- [ ] All `js/trivial-conditional` alerts in `src/` are resolved
- [ ] All `js/useless-assignment-to-local` alerts in `src/` are resolved
- [ ] All `js/useless-assignment-to-property` alerts in `src/` are resolved
- [ ] All `js/useless-comparison-test` alerts in `src/` are resolved
- [ ] All `js/unneeded-defensive-code` alerts in `src/` are resolved
- [ ] All `js/comparison-between-incompatible-types` alerts in `src/` are resolved
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (no regressions)
- [ ] No new CodeQL alerts introduced

## Implementation Notes

### Fixing `js/unused-local-variable`

**Most common fix -- simply remove the unused import or variable:**

```typescript
// BAD: Unused import
import { useState, useEffect, useCallback } from 'react';
// If useCallback is never used in the file:

// GOOD: Remove unused import
import { useState, useEffect } from 'react';
```

**For destructured variables that are unused:**

```typescript
// BAD: Unused destructured variable
const { data, error, loading } = useSomeHook();
// If 'loading' is never used:

// GOOD: Omit from destructuring
const { data, error } = useSomeHook();

// OR if you need it for type reasons, prefix with underscore
const { data, error, loading: _loading } = useSomeHook();
```

**For function parameters that are unused:**

```typescript
// BAD: Unused parameter
const handleClick = (event: MouseEvent, index: number) => {
  console.log(index);
};

// GOOD: Prefix with underscore or remove if not needed for signature
const handleClick = (_event: MouseEvent, index: number) => {
  console.log(index);
};
```

### Fixing `js/trivial-conditional`

```typescript
// BAD: Condition always true/false
const x = someValue ?? defaultValue;
if (x !== undefined) {  // Always true because ?? ensures it's defined
  doSomething(x);
}

// GOOD: Remove the redundant check
const x = someValue ?? defaultValue;
doSomething(x);
```

### Fixing `js/useless-assignment-to-local`

```typescript
// BAD: Value assigned but never read
let result = computeValue();
result = otherValue;  // First assignment is useless
return result;

// GOOD: Remove useless first assignment
const result = otherValue;
return result;
```

### Fixing `js/useless-comparison-test`

```typescript
// BAD: Comparison that always gives same result
const arr: string[] = getItems();
if (arr.length >= 0) {  // Array length is always >= 0
  // ...
}

// GOOD: Remove or fix the comparison
const arr: string[] = getItems();
if (arr.length > 0) {  // This is probably what was intended
  // ...
}
```

### Fixing `js/comparison-between-incompatible-types`

```typescript
// BAD: Comparing string to number
if (someString === 42) { }

// GOOD: Fix the type mismatch
if (Number(someString) === 42) { }
// or
if (someString === '42') { }
```

### Key Strategy

1. **Use `gh api` to get the full list of alerts in `src/`** -- this gives you exact file + line numbers
2. **Process files alphabetically or by alert count** (highest first)
3. **For each file:** Open it, find the flagged lines, apply the fix
4. **Run `npm run type-check` periodically** to catch issues early
5. **Run `npm test` at the end** to verify no regressions

### Batch Processing Tip

Since most alerts are unused variables, you can be efficient:
1. Get all alert locations via `gh api`
2. Group by file
3. Open each file once, fix all alerts in that file
4. Move to next file

## Integration Notes

- These are purely code quality fixes -- no behavioral changes
- No other tasks depend on or are blocked by this work
- TASK-2091 handles the same types of fixes but in `electron/` directory
- No shared types or interfaces are being changed
- Test files may have intentionally unused variables in mocks -- verify before removing

**File ownership:**
- This task OWNS: All files in `src/` directory
- TASK-2088 OWNS: `electron/services/pdfExportService.ts`, `electron/outlookService.ts`
- TASK-2089 OWNS: `electron/services/logService.ts`, `scripts/`, `broker-portal/`
- TASK-2091 OWNS: Everything else in `electron/`

## Do / Don't

### Do:

- Remove genuinely unused imports and variables
- Prefix callback parameters with `_` if they must stay in the signature
- Verify each "unused" variable is truly unused (not used via side effect)
- Run type-check after each batch of changes
- Check if test files use variables in assertions that CodeQL might miss

### Don't:

- Do NOT remove variables that are used as side effects (e.g., `const _cleanup = registerEffect()`)
- Do NOT touch files outside `src/`
- Do NOT change component logic or behavior
- Do NOT "fix" unused variables by adding unnecessary usage
- Do NOT remove React imports that are needed for JSX (React 17+ auto-import may cause false positives)
- Do NOT suppress alerts with comments unless the variable is genuinely needed

## When to Stop and Ask

- If removing a variable causes a type error you cannot resolve
- If a "trivial conditional" removal changes the control flow in a non-obvious way
- If a test file's unused variables seem intentional (part of a mock setup)
- If you find an unused variable that looks like it should be used (potential bug)
- If you reach the token cap

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests needed
- Existing tests to update: Fix unused vars in test files themselves
- If removing a variable from a component causes a test to fail, investigate why

### Coverage

- Coverage impact: Should not decrease. May slightly increase as dead code is removed.

### Integration / Feature Tests

- Required scenarios: None -- these are cleanup changes

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `chore: remove unused variables and fix code quality alerts in src/`
- **Labels**: `code-quality`, `codeql`, `cleanup`
- **Branch**: `fix/task-2090-codeql-quality-src`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~15K

> Base estimate: ~30K (~72 alerts across ~40+ files, but each fix is mechanical)
> Apply cleanup multiplier: x 0.5 = ~15K
> Most fixes are simple import/variable removals

**Token Cap:** 120K (4x upper estimate of 30K, pre-multiplier)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | ~40 files | +15K |
| Alert count | ~72 alerts | +10K |
| Code complexity | Low (mechanical removals) | +0K |
| Test updates | Fix unused vars in test files | +5K |

**Confidence:** High

**Risk factors:**
- Some "unused" variables may be intentional (side effects, mock setup)
- Large number of files but each fix is trivial
- React import changes could cause JSX issues if not careful

**Similar past tasks:** Cleanup tasks historically come in at 0.5x estimate (SPRINT-009)

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
- [ ] src/appCore/AppRouter.tsx
- [ ] src/components/Login.tsx
- [ ] <list all modified files>

Alerts resolved:
- [ ] All js/unused-local-variable alerts in src/
- [ ] All js/trivial-conditional alerts in src/
- [ ] All js/useless-assignment-to-local alerts in src/
- [ ] All remaining quality alerts in src/

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

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.csv`

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
