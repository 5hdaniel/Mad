/**
 * Admin Queries - Helper functions for admin RPC calls
 *
 * Uses the browser Supabase client for client-side data fetching.
 */

import { createClient } from '@/lib/supabase/client';

export interface AdminSearchUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  org_name: string | null;
  org_slug: string | null;
  org_role: string | null;
  status: string | null;
  last_login_at: string | null;
}

/** Build a display name from available fields */
export function getUserDisplayName(user: AdminSearchUser): string {
  if (user.display_name) return user.display_name;
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ');
  }
  return 'Unnamed User';
}

/**
 * Search users across all organizations via admin_search_users RPC.
 *
 * @param searchQuery - Search term (name, email, org, or user ID)
 * @returns Array of matching users
 */
export async function searchUsers(
  searchQuery: string
): Promise<{ data: AdminSearchUser[] | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_search_users', {
    search_query: searchQuery,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as AdminSearchUser[], error: null };
}

// ---------------------------------------------------------------------------
// Write Operations (Suspend / Unsuspend / License Edit)
// ---------------------------------------------------------------------------

interface RpcResult<T = Record<string, unknown>> {
  data: T | null;
  error: Error | null;
}

/**
 * Suspend a user via admin_suspend_user RPC.
 *
 * @param userId - The target user's UUID
 * @param reason - Optional reason for suspension
 */
export async function suspendUser(
  userId: string,
  reason?: string
): Promise<RpcResult<{ success: boolean; previous_status: string }>> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_suspend_user', {
    p_user_id: userId,
    ...(reason ? { p_reason: reason } : {}),
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as { success: boolean; previous_status: string }, error: null };
}

/**
 * Unsuspend a user via admin_unsuspend_user RPC.
 *
 * @param userId - The target user's UUID
 */
export async function unsuspendUser(
  userId: string
): Promise<RpcResult<{ success: boolean; previous_status: string }>> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_unsuspend_user', {
    p_user_id: userId,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as { success: boolean; previous_status: string }, error: null };
}

/**
 * Update a license via admin_update_license RPC.
 *
 * @param licenseId - The license UUID
 * @param changes - Object of fields to update (status, expires_at, license_type, transaction_limit)
 */
export async function updateLicense(
  licenseId: string,
  changes: Record<string, unknown>
): Promise<
  RpcResult<{ success: boolean; old_values: Record<string, unknown>; new_values: Record<string, unknown> }>
> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_update_license', {
    p_license_id: licenseId,
    p_changes: changes,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: data as {
      success: boolean;
      old_values: Record<string, unknown>;
      new_values: Record<string, unknown>;
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Plan Management
// ---------------------------------------------------------------------------

export interface Plan {
  id: string;
  name: string;
  tier: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FeatureDefinition {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  value_type: string;
  default_value: string | null;
  created_at: string;
}

export interface PlanFeature {
  id: string;
  plan_id: string;
  feature_id: string;
  enabled: boolean;
  value: string | null;
  feature_definitions: FeatureDefinition;
}

export interface PlanWithFeatureCount extends Plan {
  feature_count: number;
}

export interface OrganizationPlan {
  id: string;
  organization_id: string;
  plan_id: string;
  assigned_at: string;
  assigned_by: string | null;
  plans: Plan;
}

/**
 * Fetch all plans with feature counts.
 */
export async function getPlans(): Promise<{ data: PlanWithFeatureCount[] | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('plans')
    .select('*, plan_features(count)')
    .order('sort_order');

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  const plans: PlanWithFeatureCount[] = (data ?? []).map((plan) => {
    const featureAgg = plan.plan_features as unknown as { count: number }[];
    return {
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      description: plan.description,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
      feature_count: featureAgg?.[0]?.count ?? 0,
    };
  });

  return { data: plans, error: null };
}

/**
 * Fetch a single plan with all its feature assignments and definitions.
 */
export async function getPlanWithFeatures(
  planId: string
): Promise<{ data: { plan: Plan; features: PlanFeature[]; allFeatures: FeatureDefinition[] } | null; error: Error | null }> {
  const supabase = createClient();

  const [planResult, featuresResult, allFeaturesResult] = await Promise.all([
    supabase.from('plans').select('*').eq('id', planId).single(),
    supabase
      .from('plan_features')
      .select('*, feature_definitions(*)')
      .eq('plan_id', planId),
    supabase.from('feature_definitions').select('*').order('category').order('name'),
  ]);

  if (planResult.error) {
    return { data: null, error: new Error(planResult.error.message) };
  }

  return {
    data: {
      plan: planResult.data as Plan,
      features: (featuresResult.data ?? []) as unknown as PlanFeature[],
      allFeatures: (allFeaturesResult.data ?? []) as FeatureDefinition[],
    },
    error: null,
  };
}

/**
 * Update a single plan feature (upsert enabled + value).
 */
export async function updatePlanFeature(
  planId: string,
  featureId: string,
  enabled: boolean,
  value?: string | null
): Promise<RpcResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('plan_features')
    .upsert(
      {
        plan_id: planId,
        feature_id: featureId,
        enabled,
        value: value ?? null,
      },
      { onConflict: 'plan_id,feature_id' }
    )
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as Record<string, unknown>, error: null };
}

/**
 * Create a new plan.
 */
export async function createPlan(
  name: string,
  tier: string,
  description?: string
): Promise<RpcResult<Plan>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('plans')
    .insert({
      name,
      tier,
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as Plan, error: null };
}

/**
 * Assign a plan to an organization (upsert so changing plan just updates).
 */
export async function assignOrgPlan(
  orgId: string,
  planId: string
): Promise<RpcResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('organization_plans')
    .upsert(
      {
        organization_id: orgId,
        plan_id: planId,
      },
      { onConflict: 'organization_id' }
    )
    .select()
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as Record<string, unknown>, error: null };
}

/**
 * Get the current plan assignment for an organization.
 */
export async function getOrgPlan(
  orgId: string
): Promise<{ data: OrganizationPlan | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('organization_plans')
    .select('*, plans(*)')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as OrganizationPlan | null, error: null };
}

/**
 * Fetch all active plans (for dropdown selectors).
 */
export async function getActivePlans(): Promise<{ data: Plan[] | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as Plan[], error: null };
}

// ---------------------------------------------------------------------------
// Impersonation
// ---------------------------------------------------------------------------

interface ImpersonationResult {
  success: boolean;
  token: string;
  session_id: string;
  expires_at: string;
  error?: string;
}

/**
 * Start an impersonation session via admin_start_impersonation RPC.
 *
 * @param targetUserId - The target user's UUID to impersonate
 */
export async function startImpersonation(
  targetUserId: string
): Promise<RpcResult<ImpersonationResult>> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('admin_start_impersonation', {
    p_target_user_id: targetUserId,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return { data: data as ImpersonationResult, error: null };
}
