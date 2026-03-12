# SPRINT-127: License/Plan/Tier Unification (Phase 1-2)

**Created:** 2026-03-12
**Status:** Planning
**Goal:** Consolidate Keepr's fragmented entitlement system into two clear layers (License = user access, Plan = org capabilities) with tier constraints as structural guardrails.

---

## Sprint Narrative

Keepr currently has 6+ overlapping systems for entitlement management: `license_type`, `subscription_tier`, `organizations.plan`, `plans.tier`, `LicenseContext` computed flags, and `useFeatureGate`. This creates confusion for developers (which system to check?), inconsistency for users (different features depending on which code path runs), and maintenance burden (updating permissions requires touching multiple systems).

This sprint tackles Phases 1 and 2 of the unification. Phase 1 establishes tier constraints as a structural guardrail in the database and admin UI. Phase 2 moves license-based feature gates (`canExport`, `canSubmit`, `ai_detection_enabled`, `transaction_limit`) to the plan-based feature system. After this sprint, all feature access decisions flow through `useFeatureGate` / `check_feature_access`, and tiers enforce which features a plan CAN enable.

Phases 3-4 (schema cleanup and context unification) are planned for SPRINT-128 and depend on this sprint completing.

---

## Prerequisites

- **SPRINT-124** (Feature Flag Data Model): COMPLETED -- tables, RPCs, seed data exist
- **SPRINT-126** (Feature Gate Rework + Completion): COMPLETED -- admin UI, FeatureGateService, and broker portal gates are in place

---

## In-Scope

| Task | Backlog | Title | Phase | Est. Tokens | Status |
|------|---------|-------|-------|-------------|--------|
| TASK-2156 | BACKLOG-930, BACKLOG-931 | Tier Constraints Schema + RPC Enforcement (incl. feature dependency rules) | Phase 1 | ~40K | Pending |
| TASK-2157 | BACKLOG-930, BACKLOG-931 | Admin UI Tier Constraint Enforcement (incl. dependency UI) | Phase 1 | ~30K | Pending |
| TASK-2158 | BACKLOG-930, BACKLOG-932 | New Feature Definitions (export, submission, AI, broker_portal_access) | Phase 2 | ~30K | Pending |
| TASK-2159 | BACKLOG-930 | Move canExport/canSubmit to useFeatureGate | Phase 2 | ~40K | Pending |
| TASK-2160 | BACKLOG-930 | Move transaction_limit and ai_detection to Plan Features | Phase 2 | ~25K | Pending |

**Total Engineer Estimate: ~165K tokens**

### Folded-In Backlog Items

| Backlog | Title | Folded Into | Additional Effort |
|---------|-------|-------------|-------------------|
| BACKLOG-931 | Feature dependency rules | TASK-2156 (schema: `depends_on` column or `feature_dependencies` table), TASK-2157 (admin UI: grey out dependent features, auto-enable dependencies) | ~10K across both tasks |
| BACKLOG-932 | Broker portal access gate | TASK-2158 (add `broker_portal_access` feature_definition + top-level broker portal check on dashboard/submissions pages) | ~10K in TASK-2158 |

---

## Key Deliverables

1. **Tier constraint schema and RPC enforcement** -- `min_tier` column on `feature_definitions`, server-side enforcement in plan RPCs
2. **Admin UI tier constraint visualization** -- locked features, tooltips, auto-disable on tier change
3. **Feature dependency rules** (BACKLOG-931) -- `depends_on` / `feature_dependencies` model, admin UI greying out dependent features and auto-enabling prerequisites
4. **New feature definitions** -- `local_export`, `broker_submission`, `ai_detection`, `broker_portal_access`
5. **Broker portal access gate** (BACKLOG-932) -- top-level plan feature controlling entire broker portal access (dashboard + submissions pages)
6. **canExport/canSubmit migration** -- LicenseContext delegates to useFeatureGate instead of license_type
7. **transaction_limit and ai_detection migration** -- reads from plan features with license column fallback

---

## Out of Scope / Deferred to SPRINT-128

- Drop `organizations.plan` column (Phase 3)
- Deprecate `subscription_tier` columns (Phase 3)
- Deprecate `license_type` and `ai_detection_enabled` from `licenses` table (Phase 3)
- Move API rate limits from subscription_tier to plan-based (Phase 3)
- Merge `LicenseContext` + `useFeatureGate` into `useEntitlements()` hook (Phase 4)
- Simplify `licenses` table to status/trial/device only (Phase 4)
- Auto-assign "Personal" plan to individual users without orgs (Phase 4)
- Remove `license_type` from local SQLite schema (Phase 4)
- Clean up duplicated type files (Phase 4)
- Billing/payment integration
- Self-service plan upgrade flow

---

## Phase 1: Tier Constraints Foundation

### Design Decision: Tier Values

**Current** `plans.tier` enum: `trial`, `pro`, `enterprise`, `custom`
**New** `plans.tier` enum: `individual`, `team`, `enterprise`, `custom`

Rationale: Tiers describe the **structural class** of a plan, not the pricing. `trial` is a license status (time-limited access), not a tier. `pro` is a marketing name, not a structural descriptor. The new values align with `license_type` semantics and describe what the org IS (solo user, team, enterprise).

Migration: All existing `trial` tier plans become `individual`; all `pro` tier plans become `team`. The `Enterprise` plan keeps its tier. Existing `organization_plans` references are unaffected (they reference `plan_id`, not tier directly).

### Design Decision: Tier Constraints Model

Each feature_definition gets a `min_tier` column indicating the lowest tier that MAY enable this feature:

```
min_tier = NULL        -> available to all tiers (individual, team, enterprise, custom)
min_tier = 'team'      -> available to team, enterprise, custom only
min_tier = 'enterprise' -> available to enterprise, custom only
```

The tier hierarchy is: `individual < team < enterprise < custom`.

The `custom` tier bypasses all constraints (fully configurable for special deals).

### TASK-2156: Tier Constraints Schema + RPC Enforcement (~40K)

**Scope:**
1. Migration: Alter `plans.tier` CHECK constraint from `('trial', 'pro', 'enterprise', 'custom')` to `('individual', 'team', 'enterprise', 'custom')`
2. Migration: Update existing plans: `trial` -> `individual`, `pro` -> `team`
3. Migration: Add `min_tier TEXT CHECK (min_tier IN ('individual', 'team', 'enterprise'))` column to `feature_definitions`
4. Migration: Set `min_tier` values for existing features:
   - `NULL` (all tiers): `text_export`, `email_export`, `iphone_sync`, `email_sync`, `max_transaction_size`
   - `team`: `broker_submission` (new), `team_management` (new), `multi_seat` (new), `text_attachments`, `email_attachments`, `call_log`, `voice_transcription`
   - `enterprise`: `sso_login`, `custom_retention`, `dual_approval`
5. Create/update RPCs:
   - `admin_create_plan`: Enforce that plan features respect tier constraints AND feature dependency rules
   - `admin_update_plan_feature`: Reject enabling a feature whose `min_tier` exceeds the plan's tier; reject enabling a feature whose dependencies are not enabled
   - New helper function: `tier_rank(tier TEXT) RETURNS INTEGER` for tier comparison
6. Add new feature_definitions: `broker_submission`, `team_management`, `multi_seat`, `ai_detection`, `local_export`
7. Seed plan_features for new feature definitions across existing plans
8. **(BACKLOG-931)** Add feature dependency support: either a `depends_on` column on `feature_definitions` referencing another feature_definition key, or a `feature_dependencies` junction table. Populate initial dependency rules (e.g., `text_export` depends on having an import source feature enabled)

**Files Modified:**
- New Supabase migration file
- No application code changes (schema-only)

**Testing:**
- Migration applies cleanly
- `admin_create_plan` rejects enabling `sso_login` on an `individual` tier plan
- `admin_update_plan_feature` rejects enabling `broker_submission` on `individual` tier plan
- `custom` tier plan can enable any feature
- Existing `check_feature_access` and `get_org_features` RPCs continue to work unchanged
- Feature dependency rules: enabling a feature with unmet dependencies is rejected by RPC
- Feature dependency rules: disabling a feature that others depend on is rejected or cascades correctly
- No circular dependency chains in seed data

### TASK-2157: Admin UI Tier Constraint Enforcement (~30K)

**Scope:**
1. Plan creation form: Show tier selector with `individual`/`team`/`enterprise`/`custom`
2. Plan feature editing: Grey out / lock features whose `min_tier` exceeds the plan's tier
3. Show tooltip on locked features: "Requires [tier] tier or higher"
4. When tier changes on a plan, auto-disable features that exceed the new tier (with confirmation)
5. Update plan cards and detail pages to show new tier names
6. Update any hardcoded `trial`/`pro` references to `individual`/`team`
7. **(BACKLOG-931)** Feature dependency enforcement in admin UI: grey out features whose dependencies are not enabled; when enabling a feature, auto-enable its dependencies (with confirmation); when disabling a feature, warn if other enabled features depend on it

**Files Modified:**
- `admin-portal/app/dashboard/plans/` (list, detail, create pages)
- `admin-portal/components/plans/` (plan feature editor, plan cards)

**Dependencies:** TASK-2156 must be merged first (schema changes).

**Testing:**
- Admin can create plans with new tier values
- Locked features show visual indicator and tooltip
- Cannot save a plan with out-of-tier features enabled
- Changing tier on existing plan prompts confirmation for auto-disabled features
- Features with unmet dependencies are greyed out with tooltip explaining prerequisite
- Enabling a feature auto-enables its dependencies (with confirmation dialog)
- Disabling a feature warns if other enabled features depend on it
- Admin portal builds and type-checks

---

## Phase 2: Feature Consolidation

### TASK-2158: New Feature Definitions (export, submission, AI, broker portal access) (~30K)

**Scope:**
1. Verify TASK-2156 added `local_export`, `broker_submission`, `ai_detection` to `feature_definitions`
2. Update seed data:
   - `local_export`: `min_tier = NULL` (all tiers), enabled for all plans
   - `broker_submission`: `min_tier = 'team'`, enabled for team and enterprise plans
   - `ai_detection`: `min_tier = NULL`, disabled by default (add-on for any tier)
3. Add `max_transactions` feature_definition (integer type) if not already present
4. Update FeatureGateService (Electron) to handle the new feature keys
5. Update broker portal feature gate checks for new keys
6. **(BACKLOG-932)** Add `broker_portal_access` as a new feature_definition (`min_tier = 'team'`, enabled for team and enterprise plans). Add top-level broker portal access check: dashboard page and submissions page must check `broker_portal_access` feature before rendering content. Show a "Portal access not available for your plan" message when disabled.

**Files Modified:**
- New migration (seed data updates)
- `electron/services/featureGateService.ts` (add new feature keys to known features)
- `broker-portal/` feature gate utility (add new keys)
- `broker-portal/app/dashboard/page.tsx` (top-level `broker_portal_access` gate)
- `broker-portal/app/dashboard/submissions/page.tsx` (top-level `broker_portal_access` gate)

**Dependencies:** TASK-2156 must be merged (tier constraints schema).

**Testing:**
- `check_feature_access(org_id, 'broker_submission')` returns correct result
- `check_feature_access(org_id, 'local_export')` returns correct result
- `check_feature_access(org_id, 'ai_detection')` returns correct result
- `check_feature_access(org_id, 'broker_portal_access')` returns correct result
- FeatureGateService resolves new feature keys correctly
- Broker portal dashboard page blocks access when `broker_portal_access` is disabled
- Broker portal submissions page blocks access when `broker_portal_access` is disabled
- Existing team/enterprise plans have `broker_portal_access` enabled after migration

### TASK-2159: Move canExport/canSubmit to useFeatureGate (~40K)

**Scope:**
This is the largest task -- it rewires the permission model for export and submission.

1. Update `LicenseContext`:
   - Change `canExport` to derive from `useFeatureGate('local_export')` instead of `license_type === 'individual'`
   - Change `canSubmit` to derive from `useFeatureGate('broker_submission')` instead of `license_type === 'team' || 'enterprise'`
   - Change `canAutoDetect` to derive from `useFeatureGate('ai_detection')` instead of `hasAIAddon`
   - Keep backward-compatible interface (same property names) so consumers don't need immediate updates
2. Update ExportModal:
   - Remove any direct `useLicense()` checks for export permission
   - Use only `useFeatureGate` for `text_export`, `email_export`, `text_attachments`, `email_attachments`
3. Update components that use `useCanExport()`, `useCanSubmit()`, `useCanAutoDetect()`:
   - These hooks still work (they delegate to LicenseContext which now delegates to useFeatureGate)
   - No component changes needed in this task -- the bridge is in LicenseContext
4. Update `LicenseGate` component to optionally accept a `featureKey` prop for plan-based gating
5. Update test mocks to reflect new derivation logic

**Files Modified:**
- `src/contexts/LicenseContext.tsx` (major refactor)
- `src/components/ExportModal.tsx`
- `src/components/license/LicenseGate.tsx`
- `src/components/common/LicenseGate.tsx`
- Test files for affected components

**Dependencies:** TASK-2158 must be merged (new features must exist in DB).

**Testing:**
- `canExport` returns true when plan has `local_export` enabled, regardless of `license_type`
- `canSubmit` returns true when plan has `broker_submission` enabled
- `canAutoDetect` returns true when plan has `ai_detection` enabled
- ExportModal uses only feature gate checks
- All existing component tests pass (backward-compatible interface)
- Offline: cached feature gates used when offline; license cache still provides status/trial

### TASK-2160: Move transaction_limit and ai_detection to Plan Features (~25K)

**Scope:**
1. Move `transaction_limit` from `licenses` table to plan feature `max_transactions`:
   - `LicenseContext.transactionLimit` reads from `useFeatureGate('max_transactions')` value
   - `licenseService.ts` (Electron) checks plan feature for transaction limit instead of license column
   - `incrementTransactionCount` RPC: check plan feature limit instead of license column
2. Move `ai_detection_enabled` reads from license to plan feature:
   - `licenseService.ts`: stop reading `ai_detection_enabled` from licenses table
   - `LicenseContext.hasAIAddon` reads from `useFeatureGate('ai_detection')`
3. Add backward compatibility: if plan feature not found, fall back to license column value (graceful migration)
4. Update admin portal `EditLicenseDialog` to not show `ai_detection_enabled` toggle (it's now on the plan)
5. Update admin portal `LicenseCard` to show feature source (plan vs license legacy)

**Files Modified:**
- `electron/services/licenseService.ts`
- `src/contexts/LicenseContext.tsx`
- `admin-portal/app/dashboard/users/[id]/components/EditLicenseDialog.tsx`
- `admin-portal/app/dashboard/users/[id]/components/LicenseCard.tsx`
- Test files for licenseService

**Dependencies:** TASK-2159 must be merged (LicenseContext bridge must be in place).

**Testing:**
- Transaction limit reads from plan feature, not license column
- AI detection reads from plan feature, not license column
- Fallback: if plan feature missing, license column value used
- Admin portal EditLicenseDialog no longer shows ai_detection toggle
- Existing license validation tests pass with updated logic

---

## Dependency Graph

```
SPRINT-126 (Feature Gate Rework) -- COMPLETED 2026-03-12
    |
    v
TASK-2156 (Tier Constraints Schema + RPCs)       [Phase 1]
    |
    +---> TASK-2157 (Admin UI Tier Constraints)   [Phase 1]
    |
    +---> TASK-2158 (New Feature Definitions)     [Phase 2]
              |
              +---> TASK-2159 (canExport/canSubmit -> useFeatureGate)  [Phase 2]
                        |
                        +---> TASK-2160 (transaction_limit + ai_detection -> Plan Features)  [Phase 2]
```

### Execution Order

| Batch | Tasks | Execution | Rationale |
|-------|-------|-----------|-----------|
| 1 | TASK-2156 | Sequential (solo) | Foundation schema -- everything depends on this |
| 2 | TASK-2157, TASK-2158 | **Parallel** | TASK-2157 modifies admin-portal only; TASK-2158 modifies migration + electron + broker-portal. No shared files. |
| 3 | TASK-2159 | Sequential | Depends on TASK-2158 (new feature definitions must exist) |
| 4 | TASK-2160 | Sequential | Depends on TASK-2159 (LicenseContext bridge must be in place) |

### Parallel Safety Analysis (Batch 2)

| Task | Files Modified | Overlap with Other? |
|------|---------------|---------------------|
| TASK-2157 | `admin-portal/app/dashboard/plans/*` | No -- TASK-2158 touches different admin-portal files (if any) or migration only |
| TASK-2158 | New migration file, `electron/services/featureGateService.ts`, `broker-portal/` | No overlap with TASK-2157 |

**Verdict:** Safe for parallel execution.

---

## Estimated Total Effort

| Category | Est. Tokens |
|----------|-------------|
| Phase 1 Engineer work (TASK-2156 + TASK-2157, incl. BACKLOG-931 dependency rules) | ~70K |
| Phase 2 Engineer work (TASK-2158 + TASK-2159 + TASK-2160, incl. BACKLOG-932 broker gate) | ~95K |
| SR Review (5 reviews x ~15K avg) | ~75K |
| PM overhead | ~10K |
| **Total Sprint** | **~250K** |

### Estimation Basis

- Refactor tasks use 0.5x multiplier per historical data (these are refactors of existing patterns)
- TASK-2159 is largest because it touches 25+ consumer files and test mocks
- Schema tasks (TASK-2156, TASK-2158) are straightforward migrations
- Admin UI task (TASK-2157) is moderate -- adding constraint visualization to existing pages
- BACKLOG-931 adds ~10K across TASK-2156 (schema) and TASK-2157 (admin UI dependency visualization)
- BACKLOG-932 adds ~10K to TASK-2158 (new feature definition + broker portal top-level check)

---

## Merge Plan

- All PRs target `develop`
- No integration branch needed (tasks are sequential or parallel-safe)
- Each task uses its own feature branch:
  - `feature/task-2156-tier-constraints-schema`
  - `feature/task-2157-admin-tier-constraints`
  - `feature/task-2158-new-feature-definitions`
  - `feature/task-2159-export-submit-feature-gate`
  - `feature/task-2160-txn-limit-ai-plan-features`
- Merge order follows dependency graph strictly

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SPRINT-126 not completed before Phase 2 starts | Resolved | Low | SPRINT-126 completed 2026-03-12. All feature gate PRs merged. Phase 1 can start immediately. |
| `plans.tier` enum change breaks existing queries | High | Low | Migration updates all rows in-place. No application code references tier value directly (only through RPCs). |
| Existing users with licenses but no plan/org | High | Medium | Phase 2 adds fallback: if no plan features found, fall back to license column values. Phase 4 (SPRINT-128) auto-assigns default plans. |
| Offline feature gate cache stale after plan change | Medium | Medium | FeatureGateService already has TTL-based cache. After plan change, cache invalidated on next sync. |
| Breaking LicenseContext consumers during Phase 2 | Medium | Low | Backward-compatible interface maintained. Same property names (`canExport`, `canSubmit`). Derivation logic changes internally only. |
| 25+ component test files need mock updates | Medium | Medium | TASK-2159 includes test mock updates. Incremental approach: update mocks as needed, don't rewrite all at once. |
| Race condition: license check and feature gate check return different answers during rollout | Low | Medium | Phase 2 bridge in LicenseContext ensures single source of truth. Components don't need to call both. |
| Feature dependency rules create circular dependencies | Medium | Low | Validate dependency graph is acyclic in RPC before saving. Admin UI shows dependency chain visually. |
| Broker portal access gate locks out existing orgs | Medium | Low | `broker_portal_access` enabled by default for team/enterprise plans. Migration seeds plan_features for all existing plans. |

---

## Testing Plan

| Surface | Requirement | Owner |
|---------|-------------|-------|
| Migration applies cleanly | All migrations apply via `supabase db push` | TASK-2156, TASK-2158 |
| Tier constraint enforcement (RPCs) | `admin_create_plan` and `admin_update_plan_feature` reject out-of-tier features | TASK-2156 |
| Tier constraint enforcement (UI) | Admin portal greys out locked features, shows tooltips | TASK-2157 |
| New feature definitions exist | `check_feature_access` resolves `local_export`, `broker_submission`, `ai_detection` | TASK-2158 |
| canExport derives from plan | `canExport` true/false based on plan feature, not license_type | TASK-2159 |
| canSubmit derives from plan | `canSubmit` true/false based on plan feature, not license_type | TASK-2159 |
| ExportModal uses feature gate only | No dual-system permission checks | TASK-2159 |
| Transaction limit from plan | Transaction limit reads plan feature value | TASK-2160 |
| AI detection from plan | AI enabled reads plan feature value | TASK-2160 |
| Backward compatibility | All existing tests pass after each task | All tasks |
| Offline mode | License cache + feature gate cache both work | TASK-2159, TASK-2160 |
| Feature dependency enforcement (schema) | RPC rejects enabling a feature whose dependencies are not enabled; RPC rejects disabling a feature that other enabled features depend on | TASK-2156 |
| Feature dependency enforcement (UI) | Admin portal greys out features with unmet dependencies; auto-enables dependencies on confirmation | TASK-2157 |
| Broker portal access gate | `broker_portal_access` feature controls entire portal; dashboard and submissions pages show blocked message when disabled | TASK-2158 |
| Broker portal access defaults | Existing team/enterprise plans have `broker_portal_access` enabled after migration | TASK-2158 |
| CI gates | Type-check, lint, test suite pass | All tasks |

---

## SPRINT-128 Preview (Phase 3-4)

For planning purposes, these are the follow-on tasks:

### Phase 3: Schema Cleanup
- Drop `organizations.plan` column (~10K)
- Deprecate `users.subscription_tier`, `profiles.subscription_tier` (~15K)
- Deprecate `licenses.license_type`, `licenses.ai_detection_enabled`, `licenses.transaction_limit` (~15K)
- Move API rate limits from subscription_tier to plan-based (~10K)
- Update admin portal analytics to read from organization_plans (~10K)

### Phase 4: Context Unification
- Create `useEntitlements()` hook merging LicenseContext + useFeatureGate (~30K)
- Simplify `licenses` table to status/trial/device only (~15K)
- Auto-assign "Personal" plan to individual users without orgs (~15K)
- Remove `license_type` from local SQLite schema (~10K)
- Clean up duplicated type files (~5K)

**Estimated SPRINT-128 total: ~125K engineer tokens + ~50K SR review = ~175K**

---

## Task Files

Task files will be created before sprint execution begins. The estimates above serve as the basis for task file authoring.

- `.claude/plans/tasks/TASK-2156-tier-constraints-schema.md` (to be created)
- `.claude/plans/tasks/TASK-2157-admin-tier-constraints.md` (to be created)
- `.claude/plans/tasks/TASK-2158-new-feature-definitions.md` (to be created)
- `.claude/plans/tasks/TASK-2159-export-submit-feature-gate.md` (to be created)
- `.claude/plans/tasks/TASK-2160-txn-limit-ai-plan-features.md` (to be created)
