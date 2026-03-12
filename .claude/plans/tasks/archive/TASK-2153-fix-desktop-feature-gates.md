# TASK-2153: Fix Desktop Feature Gate Service (TASK-2128 Rework)

> **[COMPLETED 2026-03-11]** All 7 bugs fixed. PR #1124 re-reviewed, approved, and merged to develop.

**Backlog ID:** BACKLOG-927
**Sprint:** SPRINT-126
**Phase:** Phase 1 -- Sequential (blocks TASK-2127, TASK-2129)
**Status:** Completed -- PR #1124 merged 2026-03-11
**Depends On:** TASK-2128 (original implementation, PR #1124 with changes requested)
**Branch:** `feature/task-2128-desktop-feature-gates` (existing branch, PR #1124)
**Branch From:** Existing branch (already based on `develop`)
**Branch Into:** `develop`
**Estimated Tokens:** ~25K (bugfix category, 7 distinct fixes + new migration)

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

Fix all 7 bugs identified by the SR Engineer during review of PR #1124 (TASK-2128 -- Desktop Feature Gate Service). This includes 3 critical bugs that make the feature gate system non-functional, plus 4 important quality issues. Some fixes already exist uncommitted on the branch; others need new work.

**This is a rework task, not a new implementation.** The engineer should work on the existing branch `feature/task-2128-desktop-feature-gates`, commit the fixes, and push for SR re-review.

## Non-Goals

- Do NOT rewrite the feature gate service from scratch -- fix the specific 7 issues
- Do NOT add new features beyond what TASK-2128 originally specified
- Do NOT modify the existing deployed migration file -- create a NEW corrective migration
- Do NOT modify admin-portal or broker-portal files
- Do NOT change the public API surface of the feature gate service (IPC channels, hook interface)

## Context: SR Engineer Findings

The SR Engineer reviewed PR #1124 and found 7 issues. Here is each one with the required fix:

### C1 (Critical): Response Parsing Bug

**What's wrong:** `featureGateService.ts` uses `Array.isArray(data)` to check the RPC response. The `get_org_features` RPC returns a JSONB **object**, not an array. Because `Array.isArray({})` returns `false`, features are never parsed -- the service always falls through to the default/empty state.

**Fix:** Change the response parsing to handle the JSONB object format. The RPC returns:
```json
{
  "org_id": "uuid",
  "plan_name": "string",
  "plan_tier": "string",
  "features": {
    "feature_key": {
      "enabled": true,
      "value": "string",
      "value_type": "string",
      "name": "string",
      "source": "plan|override|default"
    }
  }
}
```

**Status:** Fix reportedly exists UNCOMMITTED on the branch. Verify and commit.

### C4 (Critical): SQL RPC Override Logic Bug

**What's wrong:** The `get_org_features` RPC function uses `IF v_org_plan IS NOT NULL` to check if an organization has a plan. But `v_org_plan` is a RECORD type (from a `SELECT INTO`), and a RECORD is never NULL even when the SELECT returns no rows -- it has NULL columns instead. This means the override/plan feature resolution logic never executes.

**Fix:** Create a NEW migration file that fixes the conditional check. Use `IF v_org_plan.plan_id IS NOT NULL` instead of `IF v_org_plan IS NOT NULL` (check the specific column, not the record).

**CRITICAL CONSTRAINT:** Migration `20260311182011_feature_flags_plan_management` is already deployed to Supabase. The SQL fix was applied live directly to the database. You MUST:
1. Create a NEW migration file (do NOT edit the existing one)
2. The new migration should use `CREATE OR REPLACE FUNCTION` to redefine the RPC
3. Include the complete corrected function body
4. Also fix I2 (error response format) in the same migration since it's the same function

**Naming:** Use the standard Supabase migration naming convention: `YYYYMMDDHHMMSS_fix_get_org_features_rpc.sql`

### C6 (Critical): ExportModal Renders Date Fields When Gated

**What's wrong:** When a feature is gated, the ExportModal shows date range fields alongside the UpgradePrompt. The user sees a confusing mix of "you can't use this" and "pick your date range."

**Fix:** When the feature is gated, render ONLY the UpgradePrompt. Do not render date range fields, format options, or any other export configuration UI. The modal should show:
- Title (so user knows what they tried to do)
- UpgradePrompt component
- Close button
- Nothing else

### I1 (Important): Test Mocks Match the Bug

**What's wrong:** The test file `featureGateService.test.ts` mocks the RPC response as an array (matching the buggy C1 behavior). When C1 is fixed, these mocks will no longer match reality.

**Fix:** Update all test mocks to use the correct JSONB object format (see C1 for the shape). Tests should verify the service correctly parses the object response.

**Status:** Fix reportedly exists UNCOMMITTED on the branch. Verify and commit.

### I2 (Important): Inconsistent Error Response Format

**What's wrong:** In the `get_org_features` RPC, the error path returns `'[]'::jsonb` (an array) but the success path returns a JSONB object `'{}'`. Consumers cannot rely on a consistent response shape.

**Fix:** Change the error response to return a JSONB object consistent with the success path. Return something like:
```sql
SELECT jsonb_build_object(
  'org_id', p_org_id,
  'plan_name', 'none',
  'plan_tier', 'none',
  'features', '{}'::jsonb
)
```

**Include this fix in the corrective migration (same file as C4).**

### I5 (Important): No Cache Max Age

**What's wrong:** The persisted disk cache (`feature-cache.json` or SQLite entry) has no maximum age. If the app goes offline for months, it could use stale feature flags from months ago.

**Fix:** Add a max age check to the persisted cache loader. Suggested: 7 days max age. If the persisted cache is older than 7 days, discard it and fail-open (allow all features). The in-memory TTL (5 minutes) handles normal refresh; this is a safety net for the persisted fallback.

### I6 (Important): FeatureAccess Type Duplicated

**What's wrong:** The `FeatureAccess` interface/type is defined in 5 different places across the codebase (service, hook, test, preload, etc.). Changes to the type require updating all 5 locations.

**Fix:** Create a single canonical definition and import it everywhere:
- Define `FeatureAccess` in a shared types file (e.g., `electron/services/types/featureGate.ts` or add to existing `electron/services/types.ts`)
- Import from that single location in all 5 files
- Remove all duplicate definitions

## Deliverables

1. **Commit existing uncommitted fixes** (C1, I1) on the branch
2. **New migration file:** `supabase/migrations/YYYYMMDDHHMMSS_fix_get_org_features_rpc.sql` (fixes C4 + I2)
3. **Updated:** `electron/services/featureGateService.ts` (C1 response parsing, I5 cache max age, I6 type consolidation)
4. **Updated:** `electron/services/__tests__/featureGateService.test.ts` (I1 correct mocks, I6 type import)
5. **Updated:** ExportModal or related component (C6 -- only show UpgradePrompt when gated)
6. **New or updated:** Shared type file with canonical `FeatureAccess` definition (I6)
7. **Updated:** All files that duplicate `FeatureAccess` to import from canonical location (I6)

## File Boundaries

### Files to modify (owned by this task):

- `electron/services/featureGateService.ts` (C1, I5, I6)
- `electron/services/__tests__/featureGateService.test.ts` (I1, I6)
- `supabase/migrations/YYYYMMDDHHMMSS_fix_get_org_features_rpc.sql` (NEW -- C4, I2)
- ExportModal component (identify exact file -- C6)
- Shared types file for `FeatureAccess` (I6 -- new or updated)
- Any files importing/duplicating `FeatureAccess` (I6)
- `electron/preload.ts` (if it has a `FeatureAccess` duplicate -- I6)
- `src/hooks/useFeatureGate.ts` (if it has a `FeatureAccess` duplicate -- I6)

### Files this task must NOT modify:

- Any `admin-portal/` files -- Owned by TASK-2127
- Any `broker-portal/` files -- Owned by TASK-2129
- Existing migration `20260311182011_feature_flags_plan_management` -- Already deployed, do NOT edit
- `electron/services/syncOrchestratorService.ts` -- Do not modify sync flow
- `electron/services/databaseService.ts` -- Do not modify DB schema

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

### Critical Fixes
- [ ] **C1**: `featureGateService.ts` correctly parses the JSONB object response from `get_org_features` (not `Array.isArray`)
- [ ] **C4**: New corrective migration creates or replaces `get_org_features` function with fixed `IF v_org_plan.plan_id IS NOT NULL` logic
- [ ] **C4**: Existing migration `20260311182011_feature_flags_plan_management` is NOT modified
- [ ] **C6**: ExportModal renders ONLY UpgradePrompt (+ title + close button) when feature is gated -- no date fields, no format options

### Important Fixes
- [ ] **I1**: All test mocks use correct JSONB object format matching the real RPC response
- [ ] **I2**: Error response in `get_org_features` RPC returns a JSONB object (not `'[]'::jsonb`)
- [ ] **I5**: Persisted cache has a max age (suggest 7 days) -- stale cache is discarded
- [ ] **I6**: `FeatureAccess` type defined in exactly ONE location; all other files import from there

### Quality Gates
- [ ] All existing tests pass (`npm test`)
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] New migration file runs cleanly (test with `supabase db reset` or equivalent)
- [ ] No uncommitted changes remaining on the branch

## Implementation Notes

### Working on an Existing Branch

This task works on an EXISTING branch with an EXISTING PR:
- **Branch:** `feature/task-2128-desktop-feature-gates`
- **PR:** #1124
- **Main repo is currently ON this branch** (`/Users/daniel/Documents/Mad`)

Steps:
1. Check out the branch (it should already be checked out in the main repo)
2. Check for uncommitted changes (`git status`) -- C1 and I1 fixes may be staged/unstaged
3. Review the uncommitted changes to verify they're correct
4. Stage and commit the existing fixes
5. Implement remaining fixes (C4, C6, I2, I5, I6)
6. Commit all new fixes
7. Push and request SR re-review

### Corrective Migration Template

```sql
-- Fix get_org_features RPC: correct plan record NULL check and error response format
-- Ref: SPRINT-126 TASK-2153 (fixes C4, I2 from SR review of PR #1124)
-- Note: Original migration 20260311182011_feature_flags_plan_management is deployed
-- but has bugs. This migration replaces the function with corrected logic.

CREATE OR REPLACE FUNCTION get_org_features(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_plan RECORD;
  v_result JSONB;
  -- ... (copy full function body from live Supabase, which has the fix applied)
BEGIN
  -- ... existing logic ...

  -- FIX C4: Check specific column, not the record itself
  IF v_org_plan.plan_id IS NOT NULL THEN
    -- plan/override resolution logic
  END IF;

  -- FIX I2: Error response returns object, not array
  -- Use jsonb_build_object() for consistent format
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'org_id', p_org_id,
      'plan_name', 'none',
      'plan_tier', 'none',
      'features', '{}'::jsonb
    );
END;
$$;
```

**Important:** Copy the ACTUAL corrected function from the live Supabase database (where the fix is already applied), then ensure both C4 and I2 are addressed in the copy.

### ExportModal Fix (C6)

Find the ExportModal component. When the feature gate check returns `allowed: false`:

```tsx
// BEFORE (buggy): Shows both UpgradePrompt AND date fields
return (
  <Modal>
    <UpgradePrompt feature="Export" />
    <DateRangeFields />  {/* Should NOT render when gated */}
    <FormatOptions />     {/* Should NOT render when gated */}
  </Modal>
);

// AFTER (fixed): Only shows UpgradePrompt
if (!isAllowed) {
  return (
    <Modal title="Export">
      <UpgradePrompt feature="Export" />
      {/* Close button only -- no export configuration UI */}
    </Modal>
  );
}

// Normal path: full export UI
return (
  <Modal title="Export">
    <DateRangeFields />
    <FormatOptions />
    <ExportButton />
  </Modal>
);
```

### Cache Max Age (I5)

```typescript
// In featureGateService.ts, when loading persisted cache:
private loadPersistedCache(): FeatureCache | null {
  const cached = this.readCacheFromDisk();
  if (!cached) return null;

  const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const age = Date.now() - cached.fetchedAt;

  if (age > MAX_CACHE_AGE_MS) {
    // Cache too old -- discard and fail-open
    this.deleteCacheFromDisk();
    return null;
  }

  return cached;
}
```

### Type Consolidation (I6)

1. Find all 5 locations where `FeatureAccess` is defined
2. Choose the canonical location (suggest `electron/services/types.ts` or a new `electron/services/types/featureGate.ts`)
3. Export the canonical definition
4. Replace all duplicates with imports

```bash
# Find all FeatureAccess definitions
grep -rn "interface FeatureAccess" --include="*.ts" --include="*.tsx" electron/ src/
grep -rn "type FeatureAccess" --include="*.ts" --include="*.tsx" electron/ src/
```

## Integration Notes

- **Depends on:** TASK-2128 (original implementation, existing on branch)
- **Blocks:** TASK-2127 (admin portal), TASK-2129 (broker portal) -- they use the same `get_org_features` RPC
- **Uses:** Existing PR #1124 -- push fixes to the same branch
- **Migration note:** The corrective migration will be picked up by TASK-2127 and TASK-2129 when they sync with develop after this task merges

## Do / Don't

### Do:
- Commit existing uncommitted fixes first (verify they're correct)
- Create a NEW migration file for the SQL fix -- never edit deployed migrations
- Copy the corrected function from live Supabase as a starting point
- Use early return pattern in ExportModal for the gated case
- Add a constant for cache max age (not a magic number)
- Run all tests after each fix to catch regressions

### Don't:
- Do NOT edit migration `20260311182011_feature_flags_plan_management`
- Do NOT change the IPC channel names or hook API
- Do NOT add new features -- fix only what's listed
- Do NOT modify admin-portal or broker-portal files
- Do NOT remove the persisted cache feature -- just add the max age

## When to Stop and Ask

- If the uncommitted changes (C1, I1) are not present on the branch
- If the corrective migration causes conflicts with the existing migration
- If `FeatureAccess` is defined in more than 5 places (scope may be larger than expected)
- If ExportModal structure is significantly different from the expected pattern
- If you cannot determine which file is the ExportModal
- If the live Supabase function differs significantly from the migration file version

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes (update existing tests)
- `featureGateService.test.ts`:
  - All mocks use JSONB object format (I1)
  - Cache expiration test for 7-day max age (I5)
  - Verify feature parsing works with real response shape (C1)
  - Import `FeatureAccess` from canonical location (I6)

### Coverage

- Coverage impact: Should maintain >80% on featureGateService.ts
- Existing test coverage must not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **PR:** #1124 (existing -- push fixes to the same branch)
- **Title:** Keep existing: `feat(electron): add feature gate service with caching and upgrade prompts`
- **Request SR re-review** after all 7 fixes are pushed

---

## PM Estimate (PM-Owned)

**Category:** `bugfix` + `migration`

**Estimated Tokens:** ~20K-25K

**Token Cap:** 100K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Uncommitted fixes (C1, I1) | Just need commit -- minimal work | +2K |
| Corrective migration (C4, I2) | Copy from live + modify | +5K |
| ExportModal fix (C6) | Small conditional rendering change | +3K |
| Cache max age (I5) | Small addition to existing code | +2K |
| Type consolidation (I6) | Find 5 files, refactor imports | +5K |
| Test updates | Update mocks, add cache age test | +3K |
| Verification + push | Test suite, type-check, lint | +5K |

**Confidence:** Medium-High (fixes are well-defined, most code already exists)

**Risk factors:**
- Uncommitted changes may have been lost or are different than expected
- Type consolidation scope may be larger than 5 files
- ExportModal structure unknown until engineer explores

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
Fixes committed:
- [ ] C1: Response parsing (JSONB object, not array)
- [ ] C4: Corrective migration with fixed NULL check
- [ ] C6: ExportModal only shows UpgradePrompt when gated
- [ ] I1: Test mocks use correct format
- [ ] I2: Error response returns object
- [ ] I5: Cache max age (7 days)
- [ ] I6: FeatureAccess type consolidated

Files created:
- [ ] supabase/migrations/YYYYMMDDHHMMSS_fix_get_org_features_rpc.sql

Files modified:
- [ ] electron/services/featureGateService.ts
- [ ] electron/services/__tests__/featureGateService.test.ts
- [ ] ExportModal component (specify file)
- [ ] Shared types file
- [ ] (list other files with FeatureAccess duplicates)

Verification:
- [ ] npm test passes
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] No uncommitted changes on branch
- [ ] Pushed to origin
- [ ] SR re-review requested
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
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~25K | ~XK | +/-X% |
| Duration | - | X sec | - |

**Root cause of variance:**
<1-2 sentence explanation>

**Suggestion for similar tasks:**
<Recommendation>

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

**PR Number:** #1124
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge 1124 --merge`
- [ ] Merge verified: `gh pr view 1124 --json state` shows `MERGED`
- [ ] Task can now be marked complete
