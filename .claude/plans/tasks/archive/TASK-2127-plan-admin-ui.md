# TASK-2127: Plan Administration UI (Admin Portal)

> **[COMPLETED 2026-03-12]** PR #1123 merged to develop. User tested and verified.
> Includes delete plan with org protection feature (TASK-2153 scope absorbed into this PR).

**Backlog ID:** BACKLOG-924
**Sprint:** SPRINT-126 (moved from SPRINT-122)
**Phase:** Phase 2 -- QA + Merge (after TASK-2153 merges)
**Status:** Completed -- PR #1123 merged 2026-03-12
**Depends On:** TASK-2126 (SPRINT-121 -- merged), TASK-2153 (SPRINT-126 Phase 1 -- RPC fix must merge first)
**Branch:** `feature/task-2127-plan-admin-ui`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~25K (service category x 0.5, then +20K for UI pages = ~35K adjusted)
**Worktree:** `Mad-TASK-2127`

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

Build admin portal pages for managing plans and assigning them to organizations. Admins should be able to view all plans, see their feature assignments, create custom plans, edit plan features, and assign/change an organization's plan.

## Non-Goals

- Do NOT modify the Supabase schema -- that is SPRINT-118 TASK-2126 (already completed)
- Do NOT build desktop app feature enforcement -- that is TASK-2128
- Do NOT build broker portal feature enforcement -- that is TASK-2129
- Do NOT build billing/payment integration
- Do NOT build self-service plan upgrade flows
- Do NOT modify any `electron/` or `broker-portal/` files

## Deliverables

1. New file: `admin-portal/app/dashboard/plans/page.tsx` -- Plans list page
2. New file: `admin-portal/app/dashboard/plans/[id]/page.tsx` -- Plan detail/edit page
3. New file: `admin-portal/app/dashboard/plans/components/PlanCard.tsx` -- Plan summary card
4. New file: `admin-portal/app/dashboard/plans/components/FeatureToggleList.tsx` -- Feature toggle grid
5. New file: `admin-portal/app/dashboard/plans/components/CreatePlanDialog.tsx` -- Create new plan dialog
6. Update: `admin-portal/app/dashboard/organizations/[id]/page.tsx` -- Add plan assignment section
7. New file: `admin-portal/app/dashboard/organizations/[id]/components/PlanAssignment.tsx` -- Plan assignment component
8. Update: `admin-portal/lib/admin-queries.ts` -- Add plan management query helpers
9. Update: `admin-portal/app/dashboard/layout.tsx` or sidebar -- Add "Plans" navigation item

## File Boundaries

### Files to modify (owned by this task):

- All files in `admin-portal/app/dashboard/plans/` (new directory)
- `admin-portal/app/dashboard/organizations/[id]/page.tsx` (add plan section)
- `admin-portal/app/dashboard/organizations/[id]/components/PlanAssignment.tsx` (new)
- `admin-portal/lib/admin-queries.ts` (add plan helpers)
- `admin-portal/app/dashboard/layout.tsx` or equivalent sidebar config

### Files this task must NOT modify:

- Any `electron/` files -- Owned by TASK-2128
- Any `broker-portal/` files -- Owned by TASK-2129
- Any `supabase/` files -- Schema is already done (TASK-2126)
- `admin-portal/middleware.ts` -- No middleware changes needed
- `admin-portal/lib/permissions.ts` -- Use existing permission framework

### If you need to modify a restricted file:

**STOP** and notify PM. The task may need to be resequenced.

## Acceptance Criteria

- [ ] Plans list page (`/dashboard/plans`) shows all plans with name, tier, feature count
- [ ] Plan detail page (`/dashboard/plans/[id]`) shows all features with toggles and value inputs
- [ ] Plan detail page allows editing feature enabled/value for the plan
- [ ] Create Plan dialog allows creating a new plan with name, tier, description
- [ ] Organization detail page shows current plan assignment with option to change
- [ ] Plan assignment component shows dropdown of available plans
- [ ] Plan changes are saved via Supabase service role client (admin-only)
- [ ] "Plans" nav item appears in admin sidebar (permission-gated if applicable)
- [ ] Feature toggle list groups features by category (export, sync, compliance, general)
- [ ] Integer features (like max_transaction_size) show number input instead of toggle
- [ ] All changes are confirmed before saving (confirmation dialog)
- [ ] No modifications to files outside the "Files to modify" list
- [ ] All CI checks pass (type-check, lint, build in admin-portal)

## Implementation Notes

### Plans List Page

Server component that fetches all plans and renders PlanCard components:

```tsx
// admin-portal/app/dashboard/plans/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function PlansPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from('plans')
    .select('*, plan_features(count)')
    .order('sort_order');

  return (
    <div>
      <h1>Plans</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans?.map(plan => <PlanCard key={plan.id} plan={plan} />)}
      </div>
    </div>
  );
}
```

### Plan Detail Page

Fetches the plan with all its features and renders toggles:

```tsx
// admin-portal/app/dashboard/plans/[id]/page.tsx
// Server component: fetch plan + all feature_definitions + plan_features
// Pass to FeatureToggleList client component for interactivity
```

### FeatureToggleList Component

Client component with toggles grouped by category:

```tsx
// Groups features by category
// Boolean features: toggle switch
// Integer features: number input
// String features: text input
// Save button calls updatePlanFeatures() helper
```

### admin-queries.ts Additions

```typescript
export async function getPlans() { ... }
export async function getPlanWithFeatures(planId: string) { ... }
export async function updatePlanFeature(planId: string, featureId: string, enabled: boolean, value?: string) { ... }
export async function createPlan(name: string, tier: string, description?: string) { ... }
export async function assignOrgPlan(orgId: string, planId: string) { ... }
export async function getOrgPlan(orgId: string) { ... }
```

### Pattern Reference

Look at existing admin portal pages for patterns:
- `admin-portal/app/dashboard/users/` for page structure
- `admin-portal/app/dashboard/organizations/` for org detail pattern
- `admin-portal/components/ui/` for shared UI components (if any)

### Permission Gating

Check if a plan management permission exists. If not, gate behind existing admin permissions. Look at `admin-portal/lib/permissions.ts` for the pattern.

## Integration Notes

- **Depends on:** TASK-2126 (schema -- all plan tables and RPCs must exist)
- **Independent of:** TASK-2128 (desktop enforcement), TASK-2129 (broker enforcement)
- **Uses:** Supabase service role client for admin write operations
- **Uses:** Existing admin portal layout, navigation, and component patterns

## Do / Don't

### Do:
- Follow existing admin portal patterns (server components, shared UI components)
- Use Supabase service role client for admin write operations
- Group features by category in the toggle list
- Include confirmation dialogs before saving changes
- Use existing navigation/sidebar pattern for the Plans nav item
- Handle loading and error states consistently

### Don't:
- Do NOT create new Supabase tables or RPCs
- Do NOT modify files outside admin-portal/
- Do NOT build billing integration
- Do NOT bypass existing RBAC/permission checks
- Do NOT use browser `confirm()` -- use proper React dialogs

## When to Stop and Ask

- If `plans`, `feature_definitions`, `plan_features`, or `organization_plans` tables do not exist (TASK-2126 not merged)
- If the admin portal has significantly different patterns than described
- If there is no sidebar/navigation component to add the Plans link to
- If the Supabase service role client pattern is unclear
- If you need to add a new permission to `admin_permissions`

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (admin portal currently has no test infrastructure)
- Consider adding if test setup exists

### Coverage

- Coverage impact: N/A for admin portal

### Integration / Feature Tests

- Manual verification:
  - Plans list page renders all plans
  - Plan detail page shows all features with correct states
  - Feature toggles save correctly
  - Create Plan dialog creates new plan
  - Org detail page shows plan assignment
  - Plan assignment change takes effect

### CI Requirements

This task's PR MUST pass:
- [ ] Type checking (`npm run type-check` or `npx tsc --noEmit` in admin-portal)
- [ ] Lint checks (`npm run lint` in admin-portal)
- [ ] Build succeeds (`npm run build` in admin-portal)

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(admin): add plan management pages and org plan assignment`
- **Labels**: `admin-portal`, `sprint-119`
- **Depends on**: TASK-2126 (schema must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `service` (admin portal pages)

**Estimated Tokens:** ~25K-35K

**Token Cap:** 140K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | ~7 new files | +15K |
| Files to modify | ~3 files (small additions each) | +5K |
| Code volume | ~500 lines new, ~50 lines modified | +10K |
| Test complexity | None (manual testing) | 0K |
| Service multiplier | x 0.5 (base), +20K for UI pages | Applied |

**Confidence:** Medium

**Risk factors:**
- Number of UI components could grow if admin portal patterns are complex
- Feature toggle grid with mixed input types adds complexity

**Similar past tasks:** TASK-2118 (organizations pages, estimated ~20K), TASK-2112 (user search UI)

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
- [ ] admin-portal/app/dashboard/plans/page.tsx
- [ ] admin-portal/app/dashboard/plans/[id]/page.tsx
- [ ] admin-portal/app/dashboard/plans/components/PlanCard.tsx
- [ ] admin-portal/app/dashboard/plans/components/FeatureToggleList.tsx
- [ ] admin-portal/app/dashboard/plans/components/CreatePlanDialog.tsx
- [ ] admin-portal/app/dashboard/organizations/[id]/components/PlanAssignment.tsx

Files modified:
- [ ] admin-portal/app/dashboard/organizations/[id]/page.tsx
- [ ] admin-portal/lib/admin-queries.ts
- [ ] admin-portal/app/dashboard/layout.tsx (or sidebar config)

Features implemented:
- [ ] Plans list page
- [ ] Plan detail/edit page
- [ ] Feature toggle list with category grouping
- [ ] Create plan dialog
- [ ] Org plan assignment component
- [ ] Plans navigation item

Verification:
- [ ] npm run type-check passes (in admin-portal/)
- [ ] npm run lint passes (in admin-portal/)
- [ ] npm run build passes (in admin-portal/)
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

**Variance:** PM Est ~35K vs Actual ~XK (X% over/under)

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
| **Tokens** | ~35K | ~XK | +/-X% |
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

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** develop

### Merge Verification (MANDATORY)

- [ ] PR merge command executed: `gh pr merge <PR> --merge`
- [ ] Merge verified: `gh pr view <PR> --json state` shows `MERGED`
- [ ] Task can now be marked complete
