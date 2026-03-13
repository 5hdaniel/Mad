-- ============================================================================
-- Migration: Add max_seats Feature Definition
-- Task: TASK-2161 (Sprint 127 - License/Plan/Tier Unification Phase 1)
-- Purpose:
--   1. Insert max_seats feature definition (value_type: integer, category: access)
--   2. Seed plan_features for all plans with tier-specific seat limits
--
-- Design:
--   max_seats has min_tier = NULL because ALL tiers get a seat limit.
--   The limit value itself varies by plan (1, 5, 50).
--   Works alongside multi_seat boolean:
--     - multi_seat = false + max_seats = 1 → Individual (single seat)
--     - multi_seat = true  + max_seats = 5 → Team (capped at 5)
--     - multi_seat = true  + max_seats = 50 → Enterprise (capped at 50)
--
-- Prerequisites:
--   - 20260312_tier_constraints_schema.sql (min_tier column, access category)
-- ============================================================================

-- ============================================================================
-- 1. INSERT max_seats FEATURE DEFINITION
-- ============================================================================

INSERT INTO public.feature_definitions (key, name, description, category, value_type, min_tier)
VALUES (
  'max_seats',
  'Maximum Seats',
  'Maximum number of user seats allowed for the organization',
  'access',
  'integer',
  NULL
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. SEED plan_features FOR ALL PLANS
-- ============================================================================

INSERT INTO public.plan_features (plan_id, feature_id, enabled, value)
SELECT p.id, fd.id, true,
  CASE p.tier
    WHEN 'individual' THEN '1'
    WHEN 'team' THEN '5'
    WHEN 'enterprise' THEN '50'
    WHEN 'custom' THEN '50'
  END
FROM public.plans p
CROSS JOIN public.feature_definitions fd
WHERE fd.key = 'max_seats'
ON CONFLICT (plan_id, feature_id) DO NOTHING;
