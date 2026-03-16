# TASK-2165: Prevent Individual Plan Assignment to Organizations

**Backlog ID:** BACKLOG-936
**Sprint:** SPRINT-128
**Batch:** 2 (parallel with TASK-2166)
**Branch:** `fix/BACKLOG-936-prevent-individual-plan-on-orgs`
**Status:** Completed
**Estimated Tokens:** ~20K
**Token Cap:** 80K
**PR:** #1138 (Merged)

---

## Objective

Add two layers of protection to prevent assigning Individual-tier plans to organizations: (1) filter out Individual plans from the admin portal plan assignment dropdown, and (2) add tier validation to the `admin_assign_org_plan` RPC so the backend rejects the assignment regardless of how the API is called.

---

## Context

SPRINT-127 introduced the tier system with `individual`, `team`, `enterprise`, and `custom` tiers. The `Individual` plan (tier = `individual`) is designed for solo users without organizations. However, the `admin_assign_org_plan` RPC (in `supabase/migrations/20260311_admin_plan_management_rpcs.sql:186-252`) has no tier validation -- it only checks that the plan exists and is active. The admin portal `PlanAssignment` component (at `admin-portal/app/dashboard/organizations/[id]/components/PlanAssignment.tsx`) uses `getActivePlans()` from `admin-portal/lib/admin-queries.ts:392-406` which returns all active plans without any tier filter.

The tier infrastructure is fully in place from SPRINT-127:
- `plans.tier` column with values `individual`, `team`, `enterprise`, `custom`
- `tier_rank()` function that maps tiers to integer ranks (individual=1, team=2, enterprise=3, custom=4)
- Tier validation patterns in `admin_create_plan` and `admin_update_plan_feature` RPCs

---

## Requirements

### Must Do:

#### 1. Admin Portal UI Guard (frontend)
- In `PlanAssignment.tsx`, filter the `availablePlans` array to exclude plans with `tier === 'individual'` before rendering the dropdown
- Alternatively, add a new query function `getActivePlansForOrgs()` in `admin-queries.ts` that filters by tier at the query level (preferred for defense-in-depth)

#### 2. RPC Backend Guard (database)
- Create a new Supabase migration that alters `admin_assign_org_plan` to check the plan's tier before assignment
- If the plan's tier is `individual`, return an error: `'individual_plan_cannot_be_assigned_to_org'`
- The check should go after the "plan exists and is active" check (after line 215 in the existing RPC)

#### 3. Error handling in UI
- If the RPC returns the individual-plan error (which shouldn't happen due to the UI filter, but defense-in-depth), display a clear error message in the `PlanAssignment` component

### Must NOT Do:
- Do not modify existing plan data or reassign orgs currently on Individual plans
- Do not change the `getActivePlans()` function signature (other callers may use it)
- Do not modify the tier constraint system or `tier_rank()` function
- Do not block assigning Individual plans to users (only to organizations)
- Do not modify `admin_create_plan` or `admin_update_plan_feature` RPCs

---

## Acceptance Criteria

- [ ] Individual plan does NOT appear in the plan assignment dropdown on org detail page
- [ ] Calling `admin_assign_org_plan` directly with an Individual-tier plan ID returns an error
- [ ] Error message is clear: "Individual plans cannot be assigned to organizations"
- [ ] Team, Enterprise, and Custom plans still assign successfully to orgs
- [ ] `getActivePlans()` function is unchanged (backward compatible)
- [ ] Admin portal builds: `npm run build` (in admin-portal directory)
- [ ] Migration applies cleanly
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

---

## Files to Modify

- `admin-portal/app/dashboard/organizations/[id]/components/PlanAssignment.tsx:144-149` - Filter out Individual-tier plans from dropdown
- `admin-portal/lib/admin-queries.ts` - Add `getActivePlansForOrgs()` function (optional, preferred approach)
- New file: `supabase/migrations/YYYYMMDD_prevent_individual_plan_on_orgs.sql` - Alter `admin_assign_org_plan` RPC to add tier validation

## Files to Read (for context)

- `admin-portal/app/dashboard/organizations/[id]/components/PlanAssignment.tsx` - Current plan assignment UI
- `admin-portal/lib/admin-queries.ts:392-406` - Current `getActivePlans()` query
- `supabase/migrations/20260311_admin_plan_management_rpcs.sql:186-252` - Current `admin_assign_org_plan` RPC
- `supabase/migrations/20260312_tier_constraints_schema.sql` - Tier infrastructure (tier_rank, min_tier patterns)

---

## Implementation Notes

### IMPORTANT: Migration Must Include Full Function Body (SR Engineer Review)

The new migration must use `CREATE OR REPLACE FUNCTION` with the **FULL** `admin_assign_org_plan` function body -- not just an ALTER. Copy the entire function from `20260311_admin_plan_management_rpcs.sql:186-252` and add the tier check into it. PostgreSQL does not support partial function modifications; `CREATE OR REPLACE` replaces the entire function definition.

### Data Migration Note (SR Engineer Review)

SR Engineer verified: **no organizations currently have an Individual plan assigned**. No data migration is needed -- this is a preventive guard only.

### RPC Modification Pattern

Add this check after the plan existence verification (after line 215):

```sql
-- Verify plan is not Individual tier (cannot assign to orgs)
DECLARE
  v_plan_tier TEXT;
BEGIN
  -- ... existing checks ...

  -- Get plan tier
  SELECT tier INTO v_plan_tier FROM public.plans WHERE id = p_plan_id AND is_active = true;

  -- Block Individual tier plans from org assignment
  IF v_plan_tier = 'individual' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'individual_plan_cannot_be_assigned_to_org',
      'message', 'Individual plans cannot be assigned to organizations. Use Team, Enterprise, or Custom plans.'
    );
  END IF;

  -- ... rest of existing upsert logic ...
```

### UI Filter Pattern

In `PlanAssignment.tsx`, after fetching plans:

```typescript
// Filter out Individual-tier plans (they cannot be assigned to orgs)
const orgPlans = plansResult.data?.filter(p => p.tier !== 'individual') ?? [];
setAvailablePlans(orgPlans);
```

Or create a new query:

```typescript
// In admin-queries.ts
export async function getActivePlansForOrgs(): Promise<{ data: Plan[] | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .neq('tier', 'individual')
    .order('sort_order');

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as Plan[], error: null };
}
```

---

## Testing Expectations

### Unit Tests
- **Required:** No new unit tests (admin-portal has no test infrastructure currently)
- **Migration testing:** Verify via Supabase SQL editor or `supabase db push`

### Manual Verification
1. Open admin portal, navigate to an org's detail page
2. Click to change plan assignment
3. Verify Individual plan is NOT in the dropdown
4. Assign a Team or Enterprise plan -- should succeed
5. Via SQL/RPC: call `admin_assign_org_plan` with an Individual plan ID -- should return error

### CI Requirements
- [ ] Admin portal `npm run build` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `fix(schema+admin): prevent Individual plan assignment to organizations`
- **Branch:** `fix/BACKLOG-936-prevent-individual-plan-on-orgs`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: [state before]
- **After**: [state after]
- **Actual Tokens**: ~XK (Est: ~20K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- Any existing organizations are currently assigned an Individual plan (need data migration decision)
- The `Plan` type in `admin-queries.ts` does not include a `tier` field (would need a type update)
- The `admin_assign_org_plan` RPC has been modified since SPRINT-127 (check migration file timestamps)
- The `CREATE OR REPLACE FUNCTION` approach would lose existing RPC logic (may need to copy full function)
- You encounter blockers not covered in the task file
