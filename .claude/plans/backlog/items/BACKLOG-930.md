# BACKLOG-930: License/Plan/Tier Unification

**Type:** refactor
**Area:** schema
**Priority:** high
**Status:** Pending
**Created:** 2026-03-12

---

## Summary

Unify the fragmented entitlement system in Keepr. Currently there are 6+ overlapping mechanisms for the same concept: `license_type`, `subscription_tier`, `organizations.plan`, `plans.tier`, `LicenseContext` computed flags (`canExport`, `canSubmit`), and the new `useFeatureGate` hook. This initiative consolidates everything into two clear, non-overlapping layers:

- **License** = "Can this person use the app?" (status: active/suspended/expired, trial tracking, device limits)
- **Plan** = "What can this org do?" (all features and limits, controlled by tier constraints)

---

## Problem Statement

### Current State: 6+ Overlapping Systems

| System | Location | What It Controls | Problem |
|--------|----------|-----------------|---------|
| `license_type` | `licenses` table, `users_local.license_type` | `individual`/`team`/`enterprise` | Overlaps with plan tier; used for `canExport`/`canSubmit` in LicenseContext |
| `subscription_tier` | `users` (Supabase), `users_local` (SQLite) | `free`/`pro`/`enterprise` | Different values than `license_type`; used for API rate limits |
| `organizations.plan` | `organizations` table | `trial`/`pro`/`enterprise` | Replaced by `organization_plans` (SPRINT-124) but column still exists |
| `plans.tier` | `plans` table (SPRINT-124) | `trial`/`pro`/`enterprise`/`custom` | New system, values don't match `license_type` (trial vs individual) |
| `LicenseContext` | `src/contexts/LicenseContext.tsx` | `canExport`, `canSubmit`, `canAutoDetect` | Derives permissions from `license_type` instead of plan features |
| `useFeatureGate` | `src/hooks/useFeatureGate.ts` | Feature-level access | New system (SPRINT-122), not yet connected to LicenseContext |
| `ai_detection_enabled` | `licenses` table, `users_local` | AI feature toggle | Should be a plan feature, not a license column |
| `transaction_limit` | `licenses` table | Max transactions | Should be a plan feature (`max_transactions`) |

### Key Confusion Points

1. **canExport** is derived from `license_type === 'individual'` in LicenseContext, but should come from plan features (`text_export`, `email_export`)
2. **canSubmit** is derived from `license_type === 'team' || 'enterprise'` in LicenseContext, but should come from a plan feature (`broker_submission`)
3. A component checking export permissions must currently consult BOTH `useLicense()` and `useFeatureGate()` -- there is no single source of truth
4. `subscription_tier` and `license_type` use different value sets for the same concept
5. `organizations.plan` column is redundant since `organization_plans` table exists

---

## Target State

### Two Clean Layers

```
LICENSE (per-user)                 PLAN (per-org)
-----------------                  ----------------
status: active/suspended/expired   tier: individual/team/enterprise/custom
trial_status                       feature flags (from plan_features)
trial_expires_at                   feature overrides (per-org)
device_count / device_limit        tier_constraints (which features each tier allows)
```

### Tier as Structural Guardrail

Tiers act as **templates + constraints**, not just labels:

| Tier | Description | Locked Features (cannot enable) |
|------|-------------|-------------------------------|
| **individual** | Solo user, no org | `broker_submission`, `team_management`, `multi_seat` |
| **team** | Org with members | `sso_login`, `audit_logs`, `custom_integrations`, `advanced_compliance` |
| **enterprise** | Full access | None (all features available) |
| **custom** | Special deals | None (fully configurable) |

When creating/editing a plan:
- The tier determines which features are **available** to toggle on/off
- Features outside the tier's scope are **greyed out / locked** in admin UI
- RPCs enforce constraints server-side (not just UI)

### Migration Path

```
license_type: 'individual' -> plans.tier: 'individual' (replaces 'trial'/'pro')
license_type: 'team'       -> plans.tier: 'team' (new tier value)
license_type: 'enterprise' -> plans.tier: 'enterprise' (stays the same)
subscription_tier: 'free'  -> license.status: 'active' + plan tier 'individual'
subscription_tier: 'pro'   -> plan tier 'team'
ai_detection_enabled       -> plan feature 'ai_detection'
transaction_limit          -> plan feature 'max_transactions'
canExport                  -> useFeatureGate('text_export') || useFeatureGate('email_export')
canSubmit                  -> useFeatureGate('broker_submission')
```

---

## Phased Implementation

### Phase 1: Tier Constraints Foundation (SPRINT-127, Phase 1)
- Add `min_tier` column to `feature_definitions` table
- Define `tier_constraints` configuration (which features each tier allows)
- Update `admin_create_plan` and `admin_update_plan_feature` RPCs to enforce constraints
- Update admin UI to grey out / lock features outside tier scope
- Change `plans.tier` enum from `trial/pro/enterprise/custom` to `individual/team/enterprise/custom`
- Migrate existing `trial` tier plans to `individual` tier

### Phase 2: Feature Consolidation (SPRINT-127, Phase 2)
- Add `local_export`, `broker_submission`, `ai_detection` as new `feature_definitions`
- Move `canExport`/`canSubmit` logic from LicenseContext to useFeatureGate
- Update ExportModal to use only useFeatureGate
- Move `transaction_limit` from licenses table to plan features (`max_transactions`)
- Move `ai_detection_enabled` to plan features

### Phase 3: Schema Cleanup (SPRINT-128)
- Drop `organizations.plan` column
- Deprecate `users.subscription_tier`, `profiles.subscription_tier`
- Deprecate `licenses.license_type`, `licenses.ai_detection_enabled`, `licenses.transaction_limit`
- Move API rate limits from subscription_tier to plan-based
- Update admin portal analytics to read from organization_plans

### Phase 4: Context Unification (SPRINT-128)
- Merge `LicenseContext` + `useFeatureGate` into single `useEntitlements()` hook
- Simplify `licenses` table to: status, trial tracking, device limits
- Individual users without an org get a default "Personal" plan auto-assigned
- Remove `license_type` from local SQLite schema (`users_local`)
- Clean up duplicated type files (`shared/types/license.ts`, `electron/types/license.ts`)

---

## Files Affected (Non-Exhaustive)

### Schema / Migrations
- `supabase/migrations/` -- new migration for tier constraints, feature definitions, column drops
- `electron/database/schema.sql` -- remove `license_type`, `subscription_tier`, `ai_detection_enabled` from `users_local`

### Supabase RPCs
- `admin_create_plan` -- enforce tier constraints
- `admin_update_plan_feature` -- enforce tier constraints
- `check_feature_access` -- no change needed (already plan-based)
- `get_org_features` -- no change needed

### Electron Services
- `electron/services/licenseService.ts` -- simplify to status/trial/device only
- `electron/services/featureGateService.ts` -- may need new features added

### React Contexts / Hooks
- `src/contexts/LicenseContext.tsx` -- eventually replaced by `useEntitlements()`
- `src/hooks/useFeatureGate.ts` -- eventually merged into `useEntitlements()`
- All consumers of `useLicense()`, `useCanExport()`, `useCanSubmit()`, `useCanAutoDetect()`

### Components (25+ files)
- `src/components/ExportModal.tsx`
- `src/components/Dashboard.tsx`
- `src/components/Settings.tsx`
- `src/components/license/TrialStatusBanner.tsx`
- `src/components/license/LicenseGate.tsx`
- `src/components/common/LicenseGate.tsx`
- `src/components/StartNewAuditModal.tsx`
- `src/components/transaction/components/TransactionsToolbar.tsx`
- `src/components/transaction/components/TransactionToolbar.tsx`
- `src/components/transaction/components/TransactionStatusWrapper.tsx`
- `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx`
- `admin-portal/app/dashboard/users/[id]/components/EditLicenseDialog.tsx`
- And more (all `useLicense()` consumers)

### Types
- `shared/types/license.ts` -- remove `LicenseType`, simplify `License` interface
- `electron/types/license.ts` -- mirror changes
- `electron/types/models.ts` -- remove `LicenseType`, `SubscriptionTier`

### Tests (~15 files)
- All test files importing from LicenseContext or using license mocks

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing users with licenses but no plan assignment | High | Phase 1 migration maps all existing users; offline fallback preserves access |
| Offline license validation after schema changes | High | License cache retains status/trial/device; feature gates cached separately with TTL |
| Breaking changes to LicenseContext consumers | Medium | Phase 2 adds backward-compat shims; Phase 4 removes them |
| Migration of existing data (old license_types to plans) | Medium | SQL migration with explicit mapping; dry-run on staging first |
| `plans.tier` enum change (trial->individual) | Medium | Migration renames in-place; seed data updated; admin UI shows new names |
| Individual users without orgs have no plan | Medium | Phase 4 auto-assigns "Personal" plan; bridge logic during transition |
| 25+ component files need updates | Medium | Phased rollout; each phase is independently shippable |

---

## Dependencies

- **Depends on:** SPRINT-124 (Feature Flag Data Model) -- COMPLETED
- **Depends on:** SPRINT-126 (Feature Gate Rework + Completion) -- COMPLETED 2026-03-12
- **Independent of:** SPRINT-125 (iPhone Sync macOS Button)
- **Independent of:** SPRINT-123 (Voice Transcription)

---

## Acceptance Criteria

1. No component checks both `useLicense()` and `useFeatureGate()` for the same permission
2. `canExport` and `canSubmit` are derived from plan features, not `license_type`
3. `ai_detection_enabled` is a plan feature, not a license column
4. `transaction_limit` is a plan feature, not a license column
5. `organizations.plan` column is dropped
6. `subscription_tier` columns are deprecated
7. `plans.tier` uses `individual/team/enterprise/custom` values
8. Tier constraints prevent enabling out-of-scope features in admin UI
9. Single `useEntitlements()` hook replaces both `useLicense()` and `useFeatureGate()`
10. All existing tests pass after each phase
11. Offline access works correctly throughout migration
