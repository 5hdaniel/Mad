# TASK-2157: Admin UI Tier Constraint Enforcement

**Sprint:** SPRINT-127
**Backlog:** BACKLOG-930, BACKLOG-931
**Phase:** Phase 1
**Branch:** `feature/task-2157-admin-tier-constraints`
**Status:** Completed
**Estimated Effort:** ~30K tokens

---

## Summary

Update the admin portal plan management UI to enforce tier constraints visually, show new tier/plan names, display all 8 export/attachment keys grouped by platform, and enforce feature dependency rules in the UI.

## Prerequisites

- TASK-2156 merged (tier constraints schema, min_tier column, feature_dependencies table, updated RPCs)

---

## Scope

### 1. Plan Creation Form
- Tier selector shows: `individual` / `team` / `enterprise` / `custom`
- Labels display as "Individual", "Team", "Enterprise", "Custom"

### 2. Plan Feature Editing — Tier Constraints
- Grey out / lock features whose `min_tier` exceeds the plan's tier
- Show tooltip on locked features: "Requires [tier] tier or higher"
- Use the `min_tier` value from `feature_definitions` (fetched from DB)
- Use `tier_rank()` logic client-side for comparison

### 3. Tier Change — REJECT Behavior
- When admin changes a plan's tier, call `admin_update_plan_tier` RPC
- If RPC returns `tier_downgrade_constraint_violation`, show error listing conflicting features
- Do NOT auto-disable features — admin must manually disable them first
- Show clear message: "Cannot downgrade to [tier]. Disable these features first: [list]"

### 4. Plan Names and Tier Display
- Plan cards show "Individual" and "Team" (not "Trial" / "Pro")
- Plan detail pages show new names
- Update any hardcoded `trial`/`pro` string references to `individual`/`team`

### 5. Export/Attachment Keys — Platform Grouping
- Show all 8 export/attachment feature keys in the feature editor
- Group by platform with section headers:
  - **Broker Portal**: `broker_text_view`, `broker_email_view`, `broker_text_attachments`, `broker_email_attachments`
  - **Desktop App**: `desktop_text_export`, `desktop_email_export`, `desktop_text_attachments`, `desktop_email_attachments`
- The grouping can be derived from the key prefix (`broker_` vs `desktop_`)

### 6. Feature Dependencies (BACKLOG-931)
- Fetch `feature_dependencies` from the database
- Grey out features whose dependencies are not enabled
- Show tooltip: "Requires [dependency] to be enabled first"
- When enabling a feature, auto-enable its dependencies (with confirmation dialog)
- When disabling a feature, warn if other enabled features depend on it (with confirmation dialog listing dependents)

---

## Files to Modify

- `admin-portal/app/dashboard/plans/page.tsx` — plan list, update tier display
- `admin-portal/app/dashboard/plans/[id]/page.tsx` — plan detail, tier change, feature editing
- `admin-portal/app/dashboard/plans/create/page.tsx` — plan creation with new tier values (if exists)
- `admin-portal/components/plans/` — plan cards, feature toggle list, create dialog
- Any shared types/constants referencing old tier values

## Files NOT to Modify

- No Supabase migrations
- No electron/ changes
- No broker-portal/ changes
- No src/ changes

---

## Testing Checklist

- [ ] Plan list shows "Individual" and "Team" names
- [ ] Plan creation allows selecting individual/team/enterprise/custom tiers
- [ ] Locked features show lock icon/grey out with tooltip
- [ ] Cannot save a plan with out-of-tier features enabled
- [ ] Tier downgrade shows error with conflicting feature list
- [ ] 8 export/attachment keys displayed grouped by platform
- [ ] Features with unmet dependencies are greyed out
- [ ] Enabling a feature auto-enables dependencies (with confirmation)
- [ ] Disabling a feature warns about dependents
- [ ] Admin portal builds: `cd admin-portal && npx next build`
- [ ] Admin portal type-checks: `cd admin-portal && npx tsc --noEmit`

---

## Implementation Summary

### What was done

1. **FeatureDefinition type updated** -- Added `min_tier` field and new `FeatureDependency` interface to `admin-queries.ts`
2. **New query functions** -- Added `updatePlanTier()` RPC wrapper and `getFeatureDependencies()` query to `admin-queries.ts`
3. **PlanTierEditor component** (new) -- Inline tier editor dropdown on plan detail page that calls `admin_update_plan_tier` RPC; shows error message on tier downgrade constraint violations
4. **FeatureToggleList rewrite** -- Major enhancement with:
   - Tier constraint visualization: features with `min_tier` above plan tier are greyed out with lock icon and "Requires [Tier]+ " badge
   - `tier_rank()` client-side logic: individual=1, team=2, enterprise=3, custom=4 (custom bypasses all min_tier checks)
   - Platform grouping: export/attachment keys split into "Broker Portal" and "Desktop App" sub-sections
   - Feature dependency enforcement: unmet deps shown with link icon; enabling triggers confirmation dialog to auto-enable deps; disabling triggers confirmation to auto-disable dependents
5. **PlanCard tier labels** -- Display "Individual", "Team", "Enterprise", "Custom" instead of raw lowercase values
6. **Plan detail page** -- Fetches `feature_dependencies` in parallel; passes `planTier` and `dependencies` to FeatureToggleList; uses PlanTierEditor for tier display/edit

### Files Modified
- `admin-portal/lib/admin-queries.ts` -- Added `min_tier` to FeatureDefinition, FeatureDependency type, updatePlanTier(), getFeatureDependencies()
- `admin-portal/app/dashboard/plans/[id]/page.tsx` -- Fetch dependencies, pass planTier/dependencies props, use PlanTierEditor
- `admin-portal/app/dashboard/plans/components/FeatureToggleList.tsx` -- Full rewrite with tier constraints, platform grouping, dependency enforcement
- `admin-portal/app/dashboard/plans/components/PlanCard.tsx` -- Proper tier label display
- `admin-portal/app/dashboard/plans/components/PlanTierEditor.tsx` -- New component for inline tier editing

### Files NOT Modified (as specified)
- No electron/, broker-portal/, src/, or supabase/ changes

### Verification
- `npx tsc --noEmit` passes
- `npx next build` succeeds

### Issues/Blockers
None. CreatePlanDialog already used the correct tier values (individual/team/enterprise/custom). PlanCard already had the correct tier color mapping. The main work was in FeatureToggleList and adding the new PlanTierEditor.
