# Task TASK-2168: Consolidate Duplicate formatDate and formatCurrency Utilities

**Status:** Completed
**Sprint:** SPRINT-129
**Backlog:** BACKLOG-266

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

Consolidate 7+ duplicate `formatDate` implementations and 3+ duplicate `formatCurrency` implementations into a single canonical module at `src/utils/formatUtils.ts`. Update all renderer-side consumers to import from the shared module.

## Non-Goals

- Do NOT modify any files in `electron/` -- this is renderer-only scope
- Do NOT change the formatting behavior or output of any function
- Do NOT add new formatting functions beyond what already exists
- Do NOT refactor other utility duplicates (only formatDate and formatCurrency)
- Do NOT change component logic beyond swapping import sources

## Deliverables

1. New file: `src/utils/formatUtils.ts` -- canonical formatDate and formatCurrency functions
2. New file: `src/utils/__tests__/formatUtils.test.ts` -- unit tests for consolidated functions
3. Update: 7+ component/module files -- replace local formatDate with import from formatUtils
4. Update: 3+ component/module files -- replace local formatCurrency with import from formatUtils
5. Delete: Inline/local implementations after migration

## File Boundaries

### Files to modify (owned by this task):

- `src/utils/formatUtils.ts` (new)
- `src/utils/__tests__/formatUtils.test.ts` (new)
- All renderer files containing duplicate `formatDate` or `formatCurrency` implementations (to be cataloged during exploration)

### Files this task must NOT modify:

- Any `electron/` files -- Out of scope (TASK-2167 owns electron files)
- `src/services/` -- Service layer is not in scope for this task
- Any files that only *call* formatDate/formatCurrency without defining their own copy

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] `src/utils/formatUtils.ts` exists with exported `formatDate` and `formatCurrency` functions
- [ ] All duplicate `formatDate` implementations in `src/` are removed and replaced with imports
- [ ] All duplicate `formatCurrency` implementations in `src/` are removed and replaced with imports
- [ ] Unit tests cover all format variants (date formats, currency edge cases)
- [ ] Formatting output is identical to existing implementations (no behavior change)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (all existing tests, plus new formatUtils tests)
- [ ] No `electron/` files modified

## Implementation Notes

### Step 1: Catalog All Duplicates

Before making any changes, find all implementations:

```bash
# Find formatDate implementations
grep -rn "function formatDate\|const formatDate\|formatDate =" --include="*.ts" --include="*.tsx" src/

# Find formatCurrency implementations
grep -rn "function formatCurrency\|const formatCurrency\|formatCurrency =" --include="*.ts" --include="*.tsx" src/
```

Document the full list in your planning notes.

### Step 2: Analyze Variants

Some implementations may have slightly different signatures or behavior. Catalog all variants:
- Date format strings used
- Locale settings
- Fallback/default behaviors
- Currency symbol handling

The canonical implementation must be a superset that handles all existing use cases.

### Step 3: Create Canonical Module

```typescript
// src/utils/formatUtils.ts

/**
 * Format a date value for display.
 * Consolidates 7+ duplicate implementations across the codebase.
 */
export function formatDate(date: string | Date | null | undefined, format?: string): string {
  // Implementation that covers all existing variants
}

/**
 * Format a currency value for display.
 * Consolidates 3+ duplicate implementations across the codebase.
 */
export function formatCurrency(amount: number | null | undefined, currency?: string): string {
  // Implementation that covers all existing variants
}
```

### Step 4: Write Tests First

Create `src/utils/__tests__/formatUtils.test.ts` with test cases covering every variant found in Step 2.

### Step 5: Migrate Consumers

For each file with a duplicate implementation:
1. Remove the local function definition
2. Add `import { formatDate, formatCurrency } from '../utils/formatUtils';` (adjust path)
3. Verify the call sites don't need signature changes
4. Run type-check after each file

### Key Patterns

```typescript
// Before (duplicated in each file)
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString();
};

// After (single import)
import { formatDate } from '../utils/formatUtils';
```

## Integration Notes

- This task runs in **parallel** with TASK-2167 (no file overlap -- TASK-2167 is electron-only)
- Phase 2 tasks do not directly depend on this utility consolidation
- PR targets: `int/sprint-129-refactor`

## Do / Don't

### Do:

- Catalog every duplicate before starting changes
- Ensure the consolidated function handles all existing signature variants
- Write tests before migrating consumers
- Run type-check after each file migration
- Preserve exact formatting output

### Don't:

- Change formatting behavior (this is consolidation, not improvement)
- Touch `electron/` directory files
- Add new formatting features
- Change function signatures if existing call sites would break
- Delete a local implementation until its consumers are migrated

## When to Stop and Ask

- If formatDate/formatCurrency implementations have incompatible behavior across files
- If more than 15 files need modification (scope may be larger than estimated)
- If any `electron/` files contain duplicates that need consolidation (out of scope)
- If existing tests depend on local function definitions being in specific files

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `src/utils/__tests__/formatUtils.test.ts` covering:
    - formatDate with string input
    - formatDate with Date object input
    - formatDate with null/undefined (fallback behavior)
    - formatDate with various format strings (if applicable)
    - formatCurrency with positive/negative/zero amounts
    - formatCurrency with null/undefined
    - formatCurrency with different currency codes (if applicable)
- Existing tests to update:
  - Any tests that mock or import local formatDate/formatCurrency from their original files

### Coverage

- Coverage impact: Should increase (new dedicated test file for utilities)

### Integration / Feature Tests

- Verify date and currency displays are unchanged across all views

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks
- [ ] Build step

**PRs without tests WILL BE REJECTED.**

## PR Preparation

- **Title**: `refactor(utils): consolidate duplicate formatDate and formatCurrency utilities`
- **Branch**: `refactor/task-c-consolidate-utils`
- **Base**: `int/sprint-129-refactor`
- **Labels**: `refactor`, `cleanup`

---

## PM Estimate (PM-Owned)

**Category:** `refactor`

**Estimated Tokens:** ~30K

**Token Cap:** 120K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 2 new files (formatUtils + tests) | +8K |
| Files to modify | ~10 files (7 formatDate + 3 formatCurrency consumers) | +12K |
| Exploration | Cataloging all duplicates | +5K |
| Test writing | Comprehensive test suite | +5K |

**Confidence:** Medium

**Risk factors:**
- Number of duplicates may be higher than 10
- Some implementations may have subtle behavioral differences

**Similar past tasks:** Refactor tasks typically come in at 0.5x estimate (historical data)

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
- [ ] src/utils/formatUtils.ts
- [ ] src/utils/__tests__/formatUtils.test.ts

Files modified:
- [ ] (list all migrated files)

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
- [ ] New formatUtils tests pass
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

**Variance:** PM Est ~30K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
<Catalog of all duplicates found, variant analysis>

**Deviations from plan:**
<If any, explain what and why. Otherwise "None">

**Design decisions:**
<Document signature decisions for the canonical functions>

**Issues encountered:**
<Document any issues>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~30K | ~XK | +/-X% |
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
<Key observations>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/sprint-129-refactor

### Merge Verification (MANDATORY)

```bash
gh pr view <PR-NUMBER> --json state --jq '.state'
# Must show: MERGED
```

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
