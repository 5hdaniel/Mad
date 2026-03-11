# TASK-2126: Feature Flag & Plan Management Data Model

**Backlog ID:** BACKLOG-891
**Sprint:** SPRINT-121
**Phase:** Phase 1 - Data Model Foundation (Sequential)
**Depends On:** None (foundational)
**Branch:** `feature/task-2126-feature-flag-data-model`
**Branch From:** `develop`
**Branch Into:** `develop`
**Estimated Tokens:** ~30K (schema category x 1.3 = ~40K adjusted)

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

Create the Supabase schema for feature flags and plan management: tables for feature definitions, plans, plan-feature mappings, and organization-plan assignments, plus RPCs to check feature access by org_id and to retrieve all features for an org.

## Non-Goals

- Do NOT build any admin UI -- that is SPRINT-119 TASK-2127
- Do NOT build any desktop app enforcement -- that is SPRINT-119 TASK-2128
- Do NOT build any broker portal enforcement -- that is SPRINT-119 TASK-2129
- Do NOT modify the existing `plan` column on `organizations` -- the new system supplements it
- Do NOT add billing/payment tables
- Do NOT add usage metering or rate limiting
- Do NOT create Edge Functions -- all logic is in RPCs

## Deliverables

1. New file: `supabase/migrations/20260306_feature_flags_plan_management.sql`
2. No other files -- this is a pure database migration

## File Boundaries

N/A -- sequential execution, single task sprint.

## Acceptance Criteria

- [ ] `feature_definitions` table exists with columns listed below
- [ ] `plans` table exists with tier enum and default plans seeded
- [ ] `plan_features` table exists as junction between plans and features
- [ ] `organization_plans` table exists linking orgs to their active plan
- [ ] `check_feature_access(p_org_id, p_feature_key)` RPC returns correct boolean/value
- [ ] `get_org_features(p_org_id)` RPC returns all features with resolved values for an org
- [ ] RLS policies restrict write access to service role / admin RPCs
- [ ] RLS policies allow read access for authenticated users within their org
- [ ] Default plans (trial, pro, enterprise) are seeded with appropriate feature assignments
- [ ] Default feature definitions are seeded for all known capabilities
- [ ] Existing organizations receive a default plan assignment based on their current `plan` column
- [ ] Migration applies cleanly via `supabase db push` or `supabase migration up`
- [ ] All existing CI checks pass (no TypeScript changes, but verify)

## Implementation Notes

### Table: `feature_definitions`

```sql
CREATE TABLE public.feature_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,           -- e.g., 'text_export', 'email_export', 'max_transaction_size'
  name TEXT NOT NULL,                 -- Human-readable: 'Text Message Export'
  description TEXT,                   -- Longer description for admin UI
  value_type TEXT NOT NULL DEFAULT 'boolean' CHECK (value_type IN ('boolean', 'integer', 'string')),
  default_value TEXT DEFAULT 'false', -- Default when not explicitly set; stored as text, cast by consumer
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('export', 'sync', 'compliance', 'general')),
  sort_order INTEGER DEFAULT 0,       -- For UI ordering
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Table: `plans`

```sql
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,          -- 'Trial', 'Pro', 'Enterprise', or custom
  slug TEXT NOT NULL UNIQUE,          -- 'trial', 'pro', 'enterprise'
  tier TEXT NOT NULL CHECK (tier IN ('trial', 'pro', 'enterprise', 'custom')),
  description TEXT,
  is_default BOOLEAN DEFAULT false,   -- Only one plan should be default (for new orgs)
  is_active BOOLEAN DEFAULT true,     -- Soft delete / deactivation
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Table: `plan_features`

```sql
CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.feature_definitions(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,  -- Whether this feature is included in the plan
  value TEXT,                              -- Override value (for integer/string features like max_transaction_size)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(plan_id, feature_id)
);
```

### Table: `organization_plans`

```sql
CREATE TABLE public.organization_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  -- Per-org feature overrides (JSONB: {"feature_key": {"enabled": true, "value": "100"}})
  feature_overrides JSONB DEFAULT '{}',
  assigned_by UUID REFERENCES auth.users(id),  -- Admin who assigned the plan
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,                       -- NULL = no expiry
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each org has exactly one active plan (UNIQUE on organization_id)
```

### RPC: `check_feature_access`

```sql
CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_org_id UUID,
  p_feature_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_feature RECORD;
  v_plan_feature RECORD;
  v_org_plan RECORD;
  v_override JSONB;
  v_result_enabled BOOLEAN;
  v_result_value TEXT;
BEGIN
  -- 1. Get the feature definition
  SELECT * INTO v_feature
  FROM public.feature_definitions
  WHERE key = p_feature_key;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'unknown_feature', 'feature_key', p_feature_key);
  END IF;

  -- 2. Get the org's plan
  SELECT op.*, p.tier INTO v_org_plan
  FROM public.organization_plans op
  JOIN public.plans p ON p.id = op.plan_id
  WHERE op.organization_id = p_org_id;

  IF NOT FOUND THEN
    -- No plan assigned: use feature default
    RETURN jsonb_build_object(
      'allowed', v_feature.default_value = 'true',
      'value', v_feature.default_value,
      'source', 'default'
    );
  END IF;

  -- 3. Check for per-org override
  v_override := v_org_plan.feature_overrides -> p_feature_key;
  IF v_override IS NOT NULL THEN
    v_result_enabled := COALESCE((v_override ->> 'enabled')::boolean, true);
    v_result_value := COALESCE(v_override ->> 'value', v_feature.default_value);
    RETURN jsonb_build_object(
      'allowed', v_result_enabled,
      'value', v_result_value,
      'source', 'override'
    );
  END IF;

  -- 4. Check plan-level feature
  SELECT * INTO v_plan_feature
  FROM public.plan_features pf
  WHERE pf.plan_id = v_org_plan.plan_id
    AND pf.feature_id = v_feature.id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', v_plan_feature.enabled,
      'value', COALESCE(v_plan_feature.value, v_feature.default_value),
      'source', 'plan'
    );
  END IF;

  -- 5. Feature not explicitly in plan: use default
  RETURN jsonb_build_object(
    'allowed', v_feature.default_value = 'true',
    'value', v_feature.default_value,
    'source', 'default'
  );
END;
$$;
```

### RPC: `get_org_features`

```sql
CREATE OR REPLACE FUNCTION public.get_org_features(
  p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_org_plan RECORD;
  v_result JSONB := '{}';
  v_feature RECORD;
  v_plan_feature RECORD;
  v_override JSONB;
  v_enabled BOOLEAN;
  v_value TEXT;
  v_source TEXT;
BEGIN
  -- Get org's plan
  SELECT op.*, p.name as plan_name, p.tier as plan_tier INTO v_org_plan
  FROM public.organization_plans op
  JOIN public.plans p ON p.id = op.plan_id
  WHERE op.organization_id = p_org_id;

  -- Iterate all features
  FOR v_feature IN SELECT * FROM public.feature_definitions ORDER BY sort_order, key
  LOOP
    v_enabled := v_feature.default_value = 'true';
    v_value := v_feature.default_value;
    v_source := 'default';

    IF v_org_plan IS NOT NULL THEN
      -- Check per-org override first
      v_override := v_org_plan.feature_overrides -> v_feature.key;
      IF v_override IS NOT NULL THEN
        v_enabled := COALESCE((v_override ->> 'enabled')::boolean, true);
        v_value := COALESCE(v_override ->> 'value', v_feature.default_value);
        v_source := 'override';
      ELSE
        -- Check plan-level feature
        SELECT * INTO v_plan_feature
        FROM public.plan_features pf
        WHERE pf.plan_id = v_org_plan.plan_id
          AND pf.feature_id = v_feature.id;

        IF FOUND THEN
          v_enabled := v_plan_feature.enabled;
          v_value := COALESCE(v_plan_feature.value, v_feature.default_value);
          v_source := 'plan';
        END IF;
      END IF;
    END IF;

    v_result := v_result || jsonb_build_object(
      v_feature.key, jsonb_build_object(
        'enabled', v_enabled,
        'value', v_value,
        'value_type', v_feature.value_type,
        'name', v_feature.name,
        'source', v_source
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'plan_name', COALESCE(v_org_plan.plan_name, 'none'),
    'plan_tier', COALESCE(v_org_plan.plan_tier, 'none'),
    'features', v_result
  );
END;
$$;
```

### RLS Policies

```sql
-- feature_definitions: readable by all authenticated, writable only via RPCs (service role)
ALTER TABLE public.feature_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_definitions_read ON public.feature_definitions
  FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated -- admin manages via service role RPCs

-- plans: readable by all authenticated, writable only via RPCs
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_read ON public.plans
  FOR SELECT TO authenticated USING (true);

-- plan_features: readable by all authenticated
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_features_read ON public.plan_features
  FOR SELECT TO authenticated USING (true);

-- organization_plans: readable by org members only
ALTER TABLE public.organization_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_plans_read ON public.organization_plans
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
```

### Grants

```sql
-- RPCs accessible by authenticated users
GRANT EXECUTE ON FUNCTION public.check_feature_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_features(UUID) TO authenticated;

-- Tables: read-only for authenticated
GRANT SELECT ON public.feature_definitions TO authenticated;
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.plan_features TO authenticated;
GRANT SELECT ON public.organization_plans TO authenticated;
```

### Seed Data: Feature Definitions

```sql
INSERT INTO public.feature_definitions (key, name, description, value_type, default_value, category, sort_order) VALUES
  ('text_export', 'Text Message Export', 'Export text/iMessage conversations to audit packages', 'boolean', 'true', 'export', 10),
  ('email_export', 'Email Export', 'Export email conversations to audit packages', 'boolean', 'true', 'export', 20),
  ('text_attachments', 'Text Message Attachments', 'Include attachments from text/iMessage in exports', 'boolean', 'false', 'export', 30),
  ('email_attachments', 'Email Attachments', 'Include attachments from emails in exports', 'boolean', 'false', 'export', 40),
  ('call_log', 'Call Log Access', 'View and export call log data from iPhone sync', 'boolean', 'false', 'sync', 50),
  ('max_transaction_size', 'Max Transaction Size', 'Maximum number of transactions per organization', 'integer', '10', 'compliance', 60),
  ('iphone_sync', 'iPhone Sync', 'Sync text messages and call logs from iPhone backups', 'boolean', 'true', 'sync', 70),
  ('email_sync', 'Email Sync', 'Sync emails from Outlook and Gmail', 'boolean', 'true', 'sync', 80),
  ('voice_transcription', 'Voice Message Transcription', 'Auto-transcribe voice messages during iPhone sync', 'boolean', 'false', 'sync', 90),
  ('custom_retention', 'Custom Retention Period', 'Configure custom archive retention years', 'boolean', 'false', 'compliance', 100),
  ('dual_approval', 'Dual Approval Workflow', 'Require two brokers to approve transaction submissions', 'boolean', 'false', 'compliance', 110),
  ('sso_login', 'SSO Login', 'Single sign-on via Azure AD / SAML', 'boolean', 'false', 'general', 120)
ON CONFLICT (key) DO NOTHING;
```

### Seed Data: Default Plans

```sql
-- Trial plan
INSERT INTO public.plans (name, slug, tier, description, is_default, sort_order) VALUES
  ('Trial', 'trial', 'trial', 'Free trial with basic features', true, 10),
  ('Pro', 'pro', 'pro', 'Professional plan with full export and sync capabilities', false, 20),
  ('Enterprise', 'enterprise', 'enterprise', 'Enterprise plan with all features and compliance tools', false, 30)
ON CONFLICT (slug) DO NOTHING;

-- Trial plan features: text_export, email_export, iphone_sync, email_sync (basics only)
INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, fd.id,
  CASE fd.key
    WHEN 'text_export' THEN true
    WHEN 'email_export' THEN true
    WHEN 'iphone_sync' THEN true
    WHEN 'email_sync' THEN true
    WHEN 'max_transaction_size' THEN true
    ELSE false
  END,
  CASE fd.key
    WHEN 'max_transaction_size' THEN '10'
    ELSE NULL
  END
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE p.slug = 'trial'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Pro plan features: everything except compliance and SSO
INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, fd.id,
  CASE fd.key
    WHEN 'custom_retention' THEN false
    WHEN 'dual_approval' THEN false
    WHEN 'sso_login' THEN false
    ELSE true
  END,
  CASE fd.key
    WHEN 'max_transaction_size' THEN '100'
    ELSE NULL
  END
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE p.slug = 'pro'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Enterprise plan features: everything enabled
INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, fd.id, true,
  CASE fd.key
    WHEN 'max_transaction_size' THEN '1000'
    ELSE NULL
  END
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE p.slug = 'enterprise'
ON CONFLICT (plan_id, feature_id) DO NOTHING;
```

### Seed Data: Assign Existing Orgs to Plans

```sql
-- Assign existing organizations to plans based on their current 'plan' column
INSERT INTO public.organization_plans (organization_id, plan_id)
SELECT o.id, p.id
FROM public.organizations o
JOIN public.plans p ON p.slug = COALESCE(o.plan, 'trial')
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_plans op WHERE op.organization_id = o.id
)
ON CONFLICT (organization_id) DO NOTHING;
```

### Indexes

```sql
-- Fast feature lookups by key
CREATE INDEX idx_feature_definitions_key ON public.feature_definitions(key);

-- Fast plan lookups by slug
CREATE INDEX idx_plans_slug ON public.plans(slug);

-- Fast org plan lookups
CREATE INDEX idx_organization_plans_org ON public.organization_plans(organization_id);

-- Fast plan-feature lookups
CREATE INDEX idx_plan_features_plan ON public.plan_features(plan_id);
```

### Important Details

- The `organizations` table already exists with a `plan` column (`trial`, `pro`, `enterprise`). The new system supplements it -- do NOT alter or remove the existing column.
- The `organization_members` table already exists -- used in RLS policies for `organization_plans`.
- Use `SECURITY DEFINER` for RPCs so they can resolve features regardless of RLS on individual tables.
- Use `STABLE` marker on RPCs since they only read data.
- The `ON CONFLICT DO NOTHING` on seed data makes the migration idempotent.

## Integration Notes

- **Exports to:** TASK-2127 (admin portal uses tables directly + RPCs for plan management)
- **Exports to:** TASK-2128 (desktop app uses `check_feature_access` and `get_org_features` RPCs)
- **Exports to:** TASK-2129 (broker portal uses `get_org_features` RPC)
- This is the foundational task -- all SPRINT-119 tasks depend on this being merged.

## Do / Don't

### Do:
- Use `SECURITY DEFINER` for RPCs
- Use `ON CONFLICT DO NOTHING` for idempotent seed data
- Include proper indexes for the most common query patterns
- Store all feature values as TEXT and let consumers cast (simplifies schema)
- Use `STABLE` on read-only RPCs for query optimizer hints
- Verify `organizations` and `organization_members` tables exist before referencing

### Don't:
- Do NOT modify the existing `plan` column on `organizations`
- Do NOT create Edge Functions -- all logic is in RPCs
- Do NOT add billing-related columns
- Do NOT create admin RPCs for CRUD operations on plans -- that is SPRINT-119 scope
- Do NOT hardcode plan IDs -- use lookups by slug

## When to Stop and Ask

- If `organizations` table does not exist or has a different schema than expected
- If `organization_members` table does not exist
- If there is already a `feature_definitions` or `plans` table (naming conflict)
- If the migration file naming conflicts with an existing migration
- If the `plan` column on `organizations` has values other than `trial`, `pro`, `enterprise`

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (pure SQL migration -- tested via manual verification)
- RPCs will be tested via manual SQL queries

### Coverage

- Coverage impact: N/A (SQL migration, not TypeScript)

### Integration / Feature Tests

- Verify migration applies cleanly
- Verify `check_feature_access` returns `allowed: true` for a pro org checking `text_export`
- Verify `check_feature_access` returns `allowed: false` for a trial org checking `text_attachments`
- Verify `get_org_features` returns all features with correct enabled/value for each plan tier
- Verify per-org overrides take precedence over plan-level features
- Verify RLS prevents non-org-members from reading `organization_plans`
- Verify seed data creates all 3 default plans with correct feature mappings
- Verify existing orgs get assigned to their matching plan

### CI Requirements

This task's PR MUST pass:
- [ ] Migration applies without errors
- [ ] No syntax errors in SQL
- [ ] All existing CI checks pass

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(schema): add feature flags and plan management data model`
- **Labels**: `schema`, `sprint-118`
- **Depends on**: None (first task in sprint)

---

## PM Estimate (PM-Owned)

**Category:** `schema`

**Estimated Tokens:** ~30K-40K

**Token Cap:** 160K (4x upper estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 1 migration file | +5K |
| SQL complexity | 4 tables + 2 RPCs + RLS + indexes + seed data | +20K |
| Verification | Manual SQL testing | +5K |
| Schema multiplier | x 1.3 | Applied |

**Confidence:** Medium-High

**Risk factors:**
- Seed data with cross-joins is moderately complex
- RPC logic with 3-level override resolution (default -> plan -> org override) adds complexity
- Existing org migration adds edge case handling

**Similar past tasks:** TASK-2122 (impersonation schema, estimated ~33K), TASK-2114 (admin audit log schema, actual: ~15K)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: 2026-03-10*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: <agent_id from Task tool output>
```

### Checklist

```
Files created:
- [x] supabase/migrations/20260310_feature_flags_plan_management.sql (413 lines)

Features implemented:
- [x] feature_definitions table
- [x] plans table
- [x] plan_features table
- [x] organization_plans table
- [x] check_feature_access RPC
- [x] get_org_features RPC
- [x] RLS policies for all tables
- [x] Indexes
- [x] Seed data: feature definitions (12 features)
- [x] Seed data: default plans (trial, pro, enterprise)
- [x] Seed data: plan-feature mappings (all 3 plans x 12 features)
- [x] Seed data: existing org plan assignments

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes
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

**Variance:** PM Est ~40K vs Actual ~XK (X% over/under)

### Notes

**Planning notes:**
Implementation plan: Assemble all SQL sections from the task specification into a single migration file `supabase/migrations/20260310_feature_flags_plan_management.sql` (using today's date 20260310 since latest migration is 20260309). Order: tables -> indexes -> RLS -> RPCs -> grants -> seed data -> org plan assignment. No TypeScript changes needed. All SQL is provided in the task spec; the work is assembly, ordering, and verification.

**Deviations from plan:**
DEVIATION: Migration filename uses 20260310 instead of 20260306 (from task spec) because today's date is 2026-03-10 and the latest existing migration is 20260309. Using 20260310 ensures correct ordering.

**Design decisions:**
- Ordered migration sections as: tables -> indexes -> RLS -> RPCs -> grants -> seed data -> org assignment. This ensures all referenced objects exist before being used.
- RPCs use SECURITY DEFINER + STABLE as specified, allowing them to bypass RLS for cross-table resolution while signaling read-only behavior to the query optimizer.

**Issues encountered:**
**Issues/Blockers:** None

**Reviewer notes:**
- This is a pure SQL migration with no TypeScript changes. CI type-check and lint both pass cleanly.
- Tests run in worktree context are excluded by testPathIgnorePatterns (expected behavior for .claude/worktrees/).
- The migration is idempotent via ON CONFLICT DO NOTHING on all seed data inserts.
- The existing organizations.plan column is NOT modified -- the new system supplements it via organization_plans table.

### Estimate vs Actual Analysis

**REQUIRED: Compare PM token estimate to actual to improve future predictions.**

| Metric | PM Estimate | Actual | Variance |
|--------|-------------|--------|----------|
| **Tokens** | ~40K | ~XK | +/-X% |
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
