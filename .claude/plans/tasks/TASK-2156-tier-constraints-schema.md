# TASK-2156: Tier Constraints Schema + RPC Enforcement

**Sprint:** SPRINT-127
**Backlog:** BACKLOG-930, BACKLOG-931
**Phase:** Phase 1
**Branch:** `feature/task-2156-tier-constraints-schema`
**Status:** Pending
**Estimated Effort:** ~50K tokens (adjusted per SR review)

---

## Summary

Create a Supabase migration that adds tier constraints, renames feature keys to platform-specific names, creates the feature dependencies junction table, and updates RPCs to enforce constraints. This is schema-only — no application code changes.

---

## Prerequisites

- `20260312_rename_plan_tiers.sql` already deployed (tier values are already `individual`/`team`/`enterprise`/`custom` in the DB). Do NOT re-do the tier value rename.
- SPRINT-126 complete (feature_definitions, plan_features, RPCs all exist)

---

## Scope (Single Migration File)

### 1. Plan Name/Slug Renames

```sql
UPDATE plans SET name = 'Individual', slug = 'individual' WHERE slug = 'trial';
UPDATE plans SET name = 'Team', slug = 'team' WHERE slug = 'pro';
```

### 2. Add `min_tier` Column to `feature_definitions`

```sql
ALTER TABLE feature_definitions
ADD COLUMN min_tier TEXT CHECK (min_tier IN ('individual', 'team', 'enterprise'));
-- NULL means available to all tiers
```

### 3. Update `feature_definitions.category` CHECK Constraint

Add `'access'` category:
```sql
ALTER TABLE feature_definitions DROP CONSTRAINT IF EXISTS feature_definitions_category_check;
ALTER TABLE feature_definitions ADD CONSTRAINT feature_definitions_category_check
  CHECK (category IN ('export', 'sync', 'compliance', 'general', 'access'));
```

### 4. Rename Existing Feature Keys

```sql
UPDATE feature_definitions SET key = 'broker_text_view' WHERE key = 'text_export';
UPDATE feature_definitions SET key = 'broker_email_view' WHERE key = 'email_export';
UPDATE feature_definitions SET key = 'broker_text_attachments' WHERE key = 'text_attachments';
UPDATE feature_definitions SET key = 'broker_email_attachments' WHERE key = 'email_attachments';
```

Note: `plan_features` references `feature_definitions.id` (UUID FK), NOT `key`. So plan_features rows are unaffected by the key rename.

### 5. Fix `organization_plans.feature_overrides` JSONB (SR-C1)

Rename old keys in the JSONB blob to match the new key names:

```sql
UPDATE organization_plans
SET feature_overrides = feature_overrides - 'text_export' ||
  jsonb_build_object('broker_text_view', feature_overrides->'text_export')
WHERE feature_overrides ? 'text_export';

-- Repeat for email_export, text_attachments, email_attachments
```

### 6. Add New Feature Definitions

| Key | Category | min_tier | Description |
|-----|----------|----------|-------------|
| `desktop_text_export` | export | NULL | Desktop app can export text messages |
| `desktop_email_export` | export | NULL | Desktop app can export email messages |
| `desktop_text_attachments` | export | NULL | Desktop app can export text attachments |
| `desktop_email_attachments` | export | NULL | Desktop app can export email attachments |
| `broker_submission` | access | team | Org can submit transactions to broker portal |
| `team_management` | access | team | Org can manage team members |
| `multi_seat` | access | team | Org supports multiple seats/users |
| `ai_detection` | general | NULL | AI-powered message detection (add-on) |
| `broker_portal_access` | access | team | Broker can view this org's submissions |

### 7. Set `min_tier` Values for ALL Existing Features

| min_tier | Features |
|----------|----------|
| NULL (all tiers) | `broker_text_view`, `broker_email_view`, `broker_text_attachments`, `broker_email_attachments`, `desktop_text_export`, `desktop_email_export`, `desktop_text_attachments`, `desktop_email_attachments`, `iphone_sync`, `email_sync`, `max_transaction_size`, `ai_detection` |
| team | `broker_submission`, `team_management`, `multi_seat`, `call_log`, `voice_transcription`, `broker_portal_access` |
| enterprise | `sso_login`, `custom_retention`, `dual_approval` |

### 8. Update Renamed Feature Categories/Descriptions

Update renamed features to use `export` category and accurate descriptions:
- `broker_text_view`: category = `export`, description = "Broker portal can view text messages"
- `broker_email_view`: category = `export`, description = "Broker portal can view email messages"
- `broker_text_attachments`: category = `export`, description = "Broker portal can view text attachments"
- `broker_email_attachments`: category = `export`, description = "Broker portal can view email attachments"

### 9. Seed `plan_features` for ALL New Keys

For ALL existing plans, create `plan_features` rows:

| Feature | Individual Plan | Team Plan | Enterprise Plan | Custom Plan |
|---------|----------------|-----------|-----------------|-------------|
| `desktop_text_export` | enabled | enabled | enabled | enabled |
| `desktop_email_export` | enabled | enabled | enabled | enabled |
| `desktop_text_attachments` | enabled | enabled | enabled | enabled |
| `desktop_email_attachments` | enabled | enabled | enabled | enabled |
| `broker_submission` | disabled | enabled | enabled | enabled |
| `team_management` | disabled | enabled | enabled | enabled |
| `multi_seat` | disabled | enabled | enabled | enabled |
| `ai_detection` | disabled | disabled | disabled | disabled |
| `broker_portal_access` | disabled | enabled | enabled | enabled |

### 10. Create `feature_dependencies` Junction Table (BACKLOG-931)

```sql
CREATE TABLE feature_dependencies (
  feature_key TEXT NOT NULL REFERENCES feature_definitions(key) ON UPDATE CASCADE,
  depends_on_key TEXT NOT NULL REFERENCES feature_definitions(key) ON UPDATE CASCADE,
  PRIMARY KEY (feature_key, depends_on_key),
  CHECK (feature_key != depends_on_key)
);
```

### 11. Seed Initial Dependency Rules

| Feature | Depends On |
|---------|-----------|
| `broker_text_attachments` | `broker_text_view` |
| `broker_email_attachments` | `broker_email_view` |
| `desktop_text_attachments` | `desktop_text_export` |
| `desktop_email_attachments` | `desktop_email_export` |
| `broker_text_view` | `broker_portal_access` |
| `broker_email_view` | `broker_portal_access` |
| `broker_text_attachments` | `broker_portal_access` |
| `broker_email_attachments` | `broker_portal_access` |

### 12. Create/Update RPCs

#### `tier_rank(tier TEXT) RETURNS INTEGER`
Helper function for tier comparison:
- `individual` = 1, `team` = 2, `enterprise` = 3, `custom` = 4

#### Update `admin_create_plan`
- Before enabling a feature, check `min_tier`: if `tier_rank(plan.tier) < tier_rank(feature.min_tier)`, reject
- Before enabling a feature, check dependencies: all `depends_on_key` features must also be enabled
- `custom` tier bypasses min_tier checks (but not dependency checks)

#### Update `admin_update_plan_feature`
- When ENABLING: check `min_tier` constraint + dependency rules
- When DISABLING: check reverse dependencies — REJECT if other enabled features depend on this one
- Return clear error message listing conflicting features

#### New: `admin_update_plan_tier` (or add to existing plan update RPC)
- When DOWNGRADING tier: check all currently enabled features have `min_tier <= new_tier`
- If any violate, REJECT with list of conflicting features
- `custom` tier has no restrictions

#### Circular Dependency Validation
- When inserting into `feature_dependencies`, walk the graph to ensure no cycles
- Reject insert if cycle detected

---

## Files Modified

- `supabase/migrations/YYYYMMDD_tier_constraints_schema.sql` (new migration file)
- No application code changes

---

## Testing Checklist

- [ ] Migration applies cleanly
- [ ] Plan names: "Trial" -> "Individual", "Pro" -> "Team"
- [ ] Plan slugs: "trial" -> "individual", "pro" -> "team"
- [ ] Feature keys renamed (old keys no longer exist in `feature_definitions`)
- [ ] `plan_features` rows intact (UUID FK, not key-based)
- [ ] `organization_plans.feature_overrides` JSONB keys updated
- [ ] `min_tier` set correctly for all features
- [ ] New feature_definitions inserted with correct categories
- [ ] `plan_features` seeded for ALL new features across ALL plans
- [ ] `feature_dependencies` table created with correct seed data
- [ ] `admin_create_plan` rejects `sso_login` on `individual` tier
- [ ] `admin_update_plan_feature` rejects `broker_submission` on `individual` tier
- [ ] `admin_update_plan_feature` rejects enabling feature with unmet dependencies
- [ ] `admin_update_plan_feature` rejects disabling feature that others depend on
- [ ] Tier downgrade rejected when enabled features violate new tier
- [ ] `custom` tier can enable any feature
- [ ] `check_feature_access` and `get_org_features` still work unchanged
- [ ] No circular dependency chains in seed data
- [ ] Circular dependency insertion blocked by RPC

---

## Acceptance Criteria

1. Single migration file handles all schema changes
2. All RPCs enforce tier constraints server-side
3. Feature dependency rules enforced (enable checks deps, disable checks reverse deps)
4. Tier downgrade is REJECTED (not cascaded) when constraints would be violated
5. All existing functionality continues to work (check_feature_access, get_org_features, broker_get_org_features)
6. Migration is idempotent-safe (uses IF NOT EXISTS / conditional updates where possible)

---

## Implementation Summary

**Agent ID:** agent-aeaf4018
**Status:** Complete
**Branch:** `feature/task-2156-tier-constraints-schema`
**File:** `supabase/migrations/20260312_tier_constraints_schema.sql`

### Approach

Single migration file (~687 lines) implementing all 16 scope items in order:

1. **Plan name/slug renames** - UPDATE plans for trial->Individual and pro->Team (slug and name only; tier values were already renamed by prior migration)
2. **min_tier column** - Added to feature_definitions with CHECK constraint allowing individual/team/enterprise (NULL = all tiers)
3. **Category constraint** - Dropped old CHECK, added new one including 'access' category
4. **Feature key renames** - 4 existing keys renamed to broker-prefixed names (text_export->broker_text_view, etc.)
5. **JSONB fix** - organization_plans.feature_overrides keys renamed to match new feature keys
6. **Category/description updates** - Renamed features get updated names and descriptions
7. **New feature definitions** - 9 new features inserted (4 desktop export/attachments, broker_submission, team_management, multi_seat, ai_detection, broker_portal_access)
8. **min_tier values** - Set for all features: NULL for export/sync/general, team for collaboration/broker, enterprise for compliance/SSO
9. **plan_features seeding** - All 9 new features seeded across all existing plans with correct enabled/disabled per tier
10. **feature_dependencies table** - Created with PK, self-join CHECK, ON UPDATE CASCADE FKs, RLS, GRANT
11. **Dependency seed data** - 8 dependency rules: attachments->view/export, all broker keys->broker_portal_access
12. **tier_rank() function** - IMMUTABLE SQL function: individual=1, team=2, enterprise=3, custom=4
13. **admin_create_plan** - Replaced with tier validation (already starts features disabled, so no constraint issues at creation)
14. **admin_update_plan_feature** - Major update: min_tier check on enable, dependency check on enable, reverse dependency check on disable. All return clear error messages with feature lists.
15. **admin_update_plan_tier** - New RPC: rejects tier downgrade when enabled features violate new tier's constraints. Returns list of conflicting features.
16. **Circular dependency trigger** - BFS-based trigger on feature_dependencies that prevents cycle insertion

### Key Decisions

- Circular dependency validation uses a trigger (BEFORE INSERT OR UPDATE) rather than an RPC check, so it catches all insertion paths including direct SQL
- admin_create_plan seeds all features as disabled, so tier constraints are not violated at creation time
- Custom tier bypasses min_tier checks but NOT dependency checks (dependencies are structural, not tier-based)
- The trigger is created AFTER seed data insertion since seed data is known-good

### Deviations

None. All 16 scope items implemented as specified.

### Issues/Blockers

None.

### Engineer Checklist

- [x] All acceptance criteria met
- [x] Single migration file
- [x] All RPCs enforce tier constraints
- [x] Feature dependency rules enforced
- [x] Tier downgrade REJECTS (not cascades)
- [x] Existing RPCs (check_feature_access, get_org_features, broker_get_org_features) unchanged
- [x] Migration uses IF NOT EXISTS / ON CONFLICT where appropriate
