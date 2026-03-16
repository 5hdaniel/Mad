# TASK-2166: Admin Portal UX Cross-links and Navigation

**Backlog ID:** BACKLOG-934
**Sprint:** SPRINT-128
**Batch:** 2 (parallel with TASK-2165)
**Branch:** `feature/BACKLOG-934-admin-crosslinks`
**Status:** Completed
**Estimated Tokens:** ~20K
**Token Cap:** 80K
**PR:** #1139 (Merged)

---

## Objective

Add cross-links between admin portal detail pages so support agents can quickly navigate between related entities (users, organizations, plans). Three specific missing links need to be added: (a) User detail -> Org link, (b) User detail -> Plan link, and (c) Plan detail -> Organizations using this plan.

---

## Context

The admin portal has separate pages for users, organizations, and plans. Some cross-links already exist:
- **Org -> Plan link:** `PlanAssignment.tsx:113-118` shows plan name as a `<Link>` to `/dashboard/plans/${currentPlan.plan_id}` (working)
- **Org Members -> User link:** `MembersTable.tsx:522` has `router.push(/dashboard/users/${member.user_id})` on row click (working)

Three cross-links are missing:
1. **User detail -> Org:** `OrganizationCard.tsx:55` shows org name as plain text. The `organization_id` is available at line 50 (used as key). Needs a `<Link>` to `/dashboard/organizations/${m.organization_id}`.
2. **User detail -> Plan:** `LicenseCard.tsx` has no plan information. The user's org plan needs to be fetched and displayed with a link.
3. **Plan detail -> Orgs using this plan:** `admin-portal/app/dashboard/plans/[id]/page.tsx` has no section showing which organizations are on this plan.

The BACKLOG-934 detail file also mentions breadcrumbs and plan list org count columns, but those are deferred (out of scope for this task).

---

## Requirements

### Must Do:

#### 1. User Detail -> Org Link (OrganizationCard.tsx)
- Change the org name from plain `<p>` text to a Next.js `<Link>` component
- Link target: `/dashboard/organizations/${m.organization_id}`
- Keep the existing styling but add hover state and link color
- Import `Link` from `next/link`

#### 2. User Detail -> Plan Link (LicenseCard.tsx or new component)
- Show the user's org plan name with a link to the plan detail page
- The plan data needs to come from the user detail page's data fetch (in `admin-portal/app/dashboard/users/[id]/page.tsx`)
- Options:
  - a. Add plan info to `OrganizationCard` (preferred -- show plan alongside org, since plan is org-level)
  - b. Add a plan link to `LicenseCard`
- The user detail page already fetches `organization_members` with the org's `name`. Extend the query to also fetch `organization_plans(plan_id, plans(id, name, tier))` via the org.

#### 3. Plan Detail -> Orgs Using This Plan
- Add a section to `admin-portal/app/dashboard/plans/[id]/page.tsx` showing organizations assigned to this plan
- Query `organization_plans` joined with `organizations` where `plan_id` matches
- Show: org name (as link to org detail), member count, assigned date
- If no orgs are on this plan, show "No organizations are using this plan."
- Add a new query function in `admin-queries.ts` (e.g., `getOrganizationsByPlan(planId)`)

### Must NOT Do:
- Do not add breadcrumbs (deferred to separate task)
- Do not modify the plan list page org count column (deferred)
- Do not modify `MembersTable.tsx` or `PlanAssignment.tsx` (their links already work)
- Do not change any database schema or RPCs (all data is already accessible via existing tables)
- Do not break existing navigation patterns

---

## Acceptance Criteria

- [ ] User detail page: org name is a clickable link to `/dashboard/organizations/{org_id}`
- [ ] User detail page: org's plan name is shown with a clickable link to `/dashboard/plans/{plan_id}`
- [ ] Plan detail page: shows "Organizations Using This Plan" section with linked org names
- [ ] Plan detail page: shows "No organizations are using this plan" when no orgs are assigned
- [ ] All links navigate correctly (no 404s)
- [ ] Existing cross-links (Org->Plan, Members->User) still work
- [ ] Admin portal builds: `npm run build` (in admin-portal directory)
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Files to Modify

- `admin-portal/app/dashboard/users/[id]/components/OrganizationCard.tsx` - Add `<Link>` for org name (line 55)
- `admin-portal/app/dashboard/users/[id]/page.tsx` - Extend org membership query to include plan data
- `admin-portal/app/dashboard/plans/[id]/page.tsx` - Add "Orgs using this plan" section
- `admin-portal/lib/admin-queries.ts` - Add `getOrganizationsByPlan()` query function

## Files to Read (for context)

- `admin-portal/app/dashboard/users/[id]/components/OrganizationCard.tsx` - Full file (72 lines)
- `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx` - Full file (105 lines)
- `admin-portal/app/dashboard/users/[id]/page.tsx` - Data fetching for user detail
- `admin-portal/app/dashboard/plans/[id]/page.tsx` - Current plan detail layout (162 lines)
- `admin-portal/app/dashboard/organizations/[id]/components/PlanAssignment.tsx:113-118` - Existing Org->Plan link pattern to match
- `admin-portal/app/dashboard/organizations/[id]/components/MembersTable.tsx:522` - Existing Members->User link pattern

---

## Implementation Notes

### OrganizationCard Link (simplest change)

```tsx
import Link from 'next/link';

// In the org name rendering (line 55):
<Link
  href={`/dashboard/organizations/${m.organization_id}`}
  className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
>
  {m.org_name || 'Unnamed Organization'}
</Link>
```

### Plan Info in OrganizationCard

Extend the `OrgMembership` interface to include plan data:

```typescript
interface OrgMembership {
  organization_id: string;
  org_name: string | null;
  role: string | null;
  joined_at: string | null;
  plan_id?: string | null;     // NEW
  plan_name?: string | null;   // NEW
  plan_tier?: string | null;   // NEW
}
```

In `page.tsx`, extend the query:
```typescript
supabase
  .from('organization_members')
  .select('organization_id, role, joined_at, organizations(name, organization_plans(plan_id, plans(id, name, tier)))')
  .eq('user_id', id)
```

### Server Component Note (SR Engineer Review)

`admin-portal/app/dashboard/plans/[id]/page.tsx` is a **server component**. The engineer can either:
- **Option A:** Inline the `organization_plans` query directly in the page's data fetch (simpler, co-located)
- **Option B:** Add a `getOrganizationsByPlan()` function to `admin-queries.ts` (preferred for consistency -- `admin-queries.ts` already imports from `@/lib/supabase/server`)

### Data Model Note (SR Engineer Review)

The `organization_plans` table has a **UNIQUE constraint on `organization_id`**, meaning each organization has at most one plan. This simplifies the plan detail page query -- no need to handle multiple plans per org or worry about duplicates.

### Orgs By Plan Query

```typescript
export async function getOrganizationsByPlan(planId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('organization_plans')
    .select('organization_id, assigned_at, organizations(id, name)')
    .eq('plan_id', planId)
    .order('assigned_at', { ascending: false });

  if (error) return { data: null, error: new Error(error.message) };
  return { data, error: null };
}
```

### Plan Detail Orgs Section

Add between the feature toggles section and the danger zone:

```tsx
{/* Organizations using this plan */}
<div>
  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
    Organizations Using This Plan
  </h2>
  {orgs.length === 0 ? (
    <p className="text-sm text-gray-500">No organizations are using this plan.</p>
  ) : (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
      {orgs.map((op) => (
        <Link key={op.organization_id} href={`/dashboard/organizations/${op.organization_id}`}>
          {/* org name + assigned date */}
        </Link>
      ))}
    </div>
  )}
</div>
```

---

## Testing Expectations

### Unit Tests
- **Required:** No (admin-portal has no test infrastructure currently)

### Manual Verification
1. Navigate to a user detail page -> verify org name is clickable -> clicking navigates to org detail
2. Verify plan name appears alongside org info -> clicking navigates to plan detail
3. Navigate to a plan detail page -> verify "Organizations Using This Plan" section shows correct orgs
4. Click an org in the plan detail -> verify it navigates to the org detail page
5. Check a plan with no assigned orgs -> verify "No organizations are using this plan" message
6. Verify existing links still work: Org->Plan (PlanAssignment), Members->User (MembersTable)

### CI Requirements
- [ ] Admin portal `npm run build` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feature(admin): add cross-links between user, org, and plan detail pages`
- **Branch:** `feature/BACKLOG-934-admin-crosslinks`
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
- The `organization_plans` table does not allow joining through to `plans` (would need a separate query)
- The user detail page query becomes too complex with the nested plan join (may need restructuring)
- The plan detail page needs pagination for the orgs section (if some plans have many orgs)
- Any Supabase RLS policy blocks the admin portal from reading `organization_plans` (shouldn't, but verify)
- You encounter blockers not covered in the task file
