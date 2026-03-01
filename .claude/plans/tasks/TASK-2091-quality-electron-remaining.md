# Task TASK-2091: Code Quality Fixes - electron/ + remaining quality alerts

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

Fix approximately 72 code quality CodeQL alerts in the `electron/` directory (excluding files owned by TASK-2088 and TASK-2089), covering unused variables/imports, trivial conditionals, useless assignments, and other quality issues in services, tests, and mocks.

## Non-Goals

- Do NOT touch files in `src/` (owned by TASK-2090)
- Do NOT touch `electron/services/pdfExportService.ts` or `electron/outlookService.ts` (owned by TASK-2088)
- Do NOT touch `electron/services/logService.ts` (owned by TASK-2089)
- Do NOT touch `scripts/download-apple-drivers.js` or `broker-portal/` (owned by TASK-2089)
- Do NOT refactor services beyond removing unused code
- Do NOT change service behavior or logic
- Do NOT add new features

## Deliverables

1. Update: All files in `electron/` with CodeQL code quality alerts (excluding TASK-2088/2089 owned files)
2. Primary files (by alert count from user's analysis):
   - `electron/services/__tests__/performance-benchmark.test.ts` (5 alerts)
   - Various test files and mocks (4+ alerts each)
   - Various service files (1-3 alerts each)

## Scope: Alert Rules to Fix

### Alert Types in Scope

| Rule | Count (approx) | Description |
|------|----------------|-------------|
| `js/unused-local-variable` | ~55-60 | Variables declared but never used. Includes unused imports. |
| `js/trivial-conditional` | ~5-6 | Conditions that always evaluate to same value. |
| `js/useless-assignment-to-local` | ~3-4 | Assigning to local variable never read afterward. |
| `js/useless-assignment-to-property` | ~2-3 | Assigning to property immediately overwritten. |
| `js/useless-comparison-test` | ~1-2 | Comparison always gives same result. |
| `js/unneeded-defensive-code` | ~1 | Defensive code that can never trigger. |

### Excluded Files (Owned by Other Tasks)

**DO NOT modify these files:**
- `electron/services/pdfExportService.ts` (TASK-2088)
- `electron/outlookService.ts` (TASK-2088)
- `electron/services/logService.ts` (TASK-2089)

### How to Find Exact Alerts

```bash
# List all open CodeQL alerts in electron/ (excluding owned files)
gh api repos/{owner}/{repo}/code-scanning/alerts --paginate -q '
  .[] | select(.state=="open") |
  select(.most_recent_instance.location.path | startswith("electron/")) |
  select(.most_recent_instance.location.path | (contains("pdfExportService") or contains("outlookService") or contains("logService")) | not) |
  "\(.rule.id) \(.most_recent_instance.location.path):\(.most_recent_instance.location.start_line)"
' | sort
```

### Top Files (from user's analysis)

| File | Alert Count | Primary Rules |
|------|-------------|---------------|
| `electron/services/__tests__/performance-benchmark.test.ts` | 5 | unused-local-variable |
| Various test files | 4+ each | unused-local-variable |
| Various mock files | 2-3 each | unused-local-variable |
| Various service files | 1-3 each | mixed |

## Acceptance Criteria

- [ ] All `js/unused-local-variable` alerts in owned `electron/` files are resolved
- [ ] All `js/trivial-conditional` alerts in owned `electron/` files are resolved
- [ ] All `js/useless-assignment-to-local` alerts in owned `electron/` files are resolved
- [ ] All `js/useless-assignment-to-property` alerts in owned `electron/` files are resolved
- [ ] All remaining quality alerts in owned `electron/` files are resolved
- [ ] Files owned by TASK-2088 and TASK-2089 are NOT modified
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (no regressions)
- [ ] No new CodeQL alerts introduced

## Implementation Notes

### Fixing `js/unused-local-variable`

**Most common fix -- remove the unused import or variable:**

```typescript
// BAD: Unused import
import { readFileSync, writeFileSync, existsSync } from 'fs';
// If existsSync is never used:

// GOOD: Remove unused import
import { readFileSync, writeFileSync } from 'fs';
```

**For test files with unused mock variables:**

```typescript
// BAD: Mock variable never referenced in test
const mockDb = {
  get: jest.fn(),
  set: jest.fn(),
};
// But mockDb is never used in any assertion or call

// GOOD: Remove if truly unused
// OR if it's part of a mock setup that's used implicitly, add a comment
// explaining why it looks unused
```

**For destructured variables:**

```typescript
// BAD: Unused destructured variable
const { data, error, isLoading } = useQuery();
// If isLoading is never used:

// GOOD: Omit from destructuring
const { data, error } = useQuery();
```

**For function parameters:**

```typescript
// BAD: Unused callback parameter
ipcMain.handle('channel', async (event, arg) => {
  return processArg(arg);  // event is never used
});

// GOOD: Prefix with underscore
ipcMain.handle('channel', async (_event, arg) => {
  return processArg(arg);
});
```

### Fixing `js/trivial-conditional`

```typescript
// BAD: Always-true condition
const value = config.setting ?? 'default';
if (value !== undefined) {  // Always true -- ?? ensures defined
  use(value);
}

// GOOD: Remove redundant check
const value = config.setting ?? 'default';
use(value);
```

### Fixing `js/useless-assignment-to-local`

```typescript
// BAD: Assignment to variable that's immediately overwritten
let config = loadDefaults();
config = loadUserConfig();  // First assignment is useless

// GOOD: Remove useless first assignment
const config = loadUserConfig();
```

### Fixing `js/useless-assignment-to-property`

```typescript
// BAD: Property assigned then immediately overwritten
obj.value = computeA();
obj.value = computeB();  // First assignment is useless

// GOOD: Remove useless first assignment
// (unless computeA() has side effects -- check first!)
obj.value = computeB();
```

### Key Strategy

1. **Use `gh api` to get the full alert list for `electron/`** -- filter out owned files
2. **Process files by alert count** (highest first for maximum impact)
3. **For each file:** Open it, find flagged lines, apply fix
4. **Be careful with test files** -- some "unused" variables may be intentional mock setup
5. **Run `npm run type-check` periodically** to catch issues early
6. **Run `npm test` at the end** to verify no regressions

### Electron-Specific Considerations

- IPC handlers often have unused `event` parameters -- prefix with `_event`
- Service classes may have unused constructor parameters for DI -- verify before removing
- Test mocks may have intentionally broad interfaces -- check if the "unused" methods are part of a required interface

## Integration Notes

- These are purely code quality fixes -- no behavioral changes
- No other tasks depend on or are blocked by this work
- TASK-2090 handles the same types of fixes but in `src/` directory
- No shared types or interfaces are being changed

**File ownership (to avoid conflicts):**
- This task OWNS: All files in `electron/` NOT owned by TASK-2088 or TASK-2089
- TASK-2088 OWNS: `electron/services/pdfExportService.ts`, `electron/outlookService.ts`
- TASK-2089 OWNS: `electron/services/logService.ts`
- TASK-2090 OWNS: All files in `src/`
- TASK-2089 OWNS: `scripts/`, `broker-portal/`

## Do / Don't

### Do:

- Remove genuinely unused imports and variables
- Prefix IPC handler `event` parameters with `_` if unused but required by signature
- Verify each "unused" variable is truly unused (not used implicitly in mocks)
- Run type-check after each batch of changes
- Check if test mock variables are used by jest's mock infrastructure

### Don't:

- Do NOT modify files owned by TASK-2088 or TASK-2089
- Do NOT touch files in `src/` (owned by TASK-2090)
- Do NOT change service logic or behavior
- Do NOT "fix" unused variables by adding unnecessary usage
- Do NOT remove mock setup that's needed by jest even if CodeQL flags it
- Do NOT suppress alerts with comments unless genuinely needed

## When to Stop and Ask

- If removing a variable causes a type error you cannot resolve
- If a mock variable appears unused but removing it breaks tests
- If a service's unused parameter is part of a required interface
- If you find an unused variable that looks like it should be used (potential bug)
- If you reach the token cap

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No new tests needed
- Existing tests to update: Fix unused vars in test files themselves
- If removing a variable from a service causes a test to fail, investigate why

### Coverage

- Coverage impact: Should not decrease. May slightly increase.

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

- **Title**: `chore: remove unused variables and fix code quality alerts in electron/`
- **Labels**: `code-quality`, `codeql`, `cleanup`
- **Branch**: `fix/task-2091-codeql-quality-electron`
- **Base**: `develop`

---

## PM Estimate (PM-Owned)

**Category:** `cleanup`

**Estimated Tokens:** ~15K

> Base estimate: ~30K (~72 alerts across ~35+ files, mechanical fixes)
> Apply cleanup multiplier: x 0.5 = ~15K
> Most fixes are simple import/variable removals

**Token Cap:** 120K (4x upper estimate of 30K, pre-multiplier)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to modify | ~35 files | +15K |
| Alert count | ~72 alerts | +10K |
| Code complexity | Low (mechanical removals) | +0K |
| Test/mock care | Extra verification needed | +5K |

**Confidence:** High

**Risk factors:**
- Test/mock files may have intentionally "unused" variables
- Electron IPC patterns may require `_event` prefix rather than removal
- Large number of files but each fix is trivial

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
- [ ] electron/services/__tests__/performance-benchmark.test.ts
- [ ] <list all modified files>

Files NOT modified (owned by other tasks):
- electron/services/pdfExportService.ts (TASK-2088)
- electron/outlookService.ts (TASK-2088)
- electron/services/logService.ts (TASK-2089)

Alerts resolved:
- [ ] All js/unused-local-variable alerts in owned electron/ files
- [ ] All js/trivial-conditional alerts in owned electron/ files
- [ ] All remaining quality alerts in owned electron/ files

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
