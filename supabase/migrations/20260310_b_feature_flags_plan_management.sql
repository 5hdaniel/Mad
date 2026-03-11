-- ============================================
-- FEATURE FLAGS & PLAN MANAGEMENT DATA MODEL
-- ============================================
-- Task: TASK-2126
-- Sprint: SPRINT-124
-- Description: Creates tables, RPCs, RLS policies, indexes, and seed data
--              for feature flag and plan management system.
--
-- Tables: feature_definitions, plans, plan_features, organization_plans
-- RPCs: check_feature_access, get_org_features
-- ============================================

-- ============================================
-- TABLE: feature_definitions
-- Canonical list of all feature flags
-- ============================================

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

-- ============================================
-- TABLE: plans
-- Named bundles of features (trial, pro, enterprise, custom)
-- ============================================

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

-- ============================================
-- TABLE: plan_features
-- Junction: plans -> features with value overrides
-- ============================================

CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.feature_definitions(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,  -- Whether this feature is included in the plan
  value TEXT,                              -- Override value (for integer/string features like max_transaction_size)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(plan_id, feature_id)
);

-- ============================================
-- TABLE: organization_plans
-- Links orgs to their active plan with per-org overrides
-- Each org has exactly one active plan (UNIQUE on organization_id)
-- ============================================

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

-- ============================================
-- INDEXES
-- ============================================

-- Fast plan-feature lookups (not covered by UNIQUE constraint which is on (plan_id, feature_id))
CREATE INDEX idx_plan_features_plan ON public.plan_features(plan_id);

-- Ensure only one plan can be the default at any time
CREATE UNIQUE INDEX idx_plans_single_default ON public.plans (is_default) WHERE is_default = true;

-- NOTE: Redundant indexes removed per SR review:
-- idx_feature_definitions_key: covered by UNIQUE constraint on feature_definitions(key)
-- idx_plans_slug: covered by UNIQUE constraint on plans(slug)
-- idx_organization_plans_org: covered by UNIQUE constraint on organization_plans(organization_id)

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

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

-- ============================================
-- RPC: check_feature_access
-- Returns JSONB with allowed (boolean), value, and source
-- Resolution order: org override -> plan feature -> feature default
-- ============================================

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
  -- 0. Verify caller is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'not_authorized');
  END IF;

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

-- ============================================
-- RPC: get_org_features
-- Returns all features with resolved values for an org
-- ============================================

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
  -- Verify caller is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('error', 'not_authorized', 'features', '[]'::jsonb);
  END IF;

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

-- ============================================
-- GRANTS
-- ============================================

-- RPCs accessible by authenticated users
GRANT EXECUTE ON FUNCTION public.check_feature_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_features(UUID) TO authenticated;

-- Tables: read-only for authenticated
GRANT SELECT ON public.feature_definitions TO authenticated;
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.plan_features TO authenticated;
GRANT SELECT ON public.organization_plans TO authenticated;

-- ============================================
-- SEED DATA: Feature Definitions
-- ============================================

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

-- ============================================
-- SEED DATA: Default Plans
-- ============================================

INSERT INTO public.plans (name, slug, tier, description, is_default, sort_order) VALUES
  ('Trial', 'trial', 'trial', 'Free trial with basic features', true, 10),
  ('Pro', 'pro', 'pro', 'Professional plan with full export and sync capabilities', false, 20),
  ('Enterprise', 'enterprise', 'enterprise', 'Enterprise plan with all features and compliance tools', false, 30)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- SEED DATA: Trial Plan Features
-- text_export, email_export, iphone_sync, email_sync (basics only)
-- ============================================

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

-- ============================================
-- SEED DATA: Pro Plan Features
-- Everything except compliance and SSO
-- ============================================

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

-- ============================================
-- SEED DATA: Enterprise Plan Features
-- Everything enabled
-- ============================================

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

-- ============================================
-- SEED DATA: Assign Existing Orgs to Plans
-- Maps existing organizations.plan column to new organization_plans table
-- ============================================

INSERT INTO public.organization_plans (organization_id, plan_id)
SELECT o.id, p.id
FROM public.organizations o
JOIN public.plans p ON p.slug = COALESCE(o.plan, 'trial')
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_plans op WHERE op.organization_id = o.id
)
ON CONFLICT (organization_id) DO NOTHING;
