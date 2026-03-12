/**
 * Feature Gate Utility - Server-side feature checking
 *
 * Uses the `broker_get_org_features` RPC to determine which features
 * an organization has access to based on their plan.
 *
 * IMPORTANT: All feature checks happen server-side in server components.
 * Never expose feature gate logic to client-side JavaScript.
 *
 * Fail-open policy: If the RPC call fails or a feature key is unknown,
 * we allow access rather than blocking users due to a feature check error.
 *
 * TASK-2129: Broker Portal Feature Gate Enforcement
 * BACKLOG-933: Uses broker-specific RPC that requires only authentication
 *   (not org membership), and checks JSONB error field in RPC response.
 */

import { createClient } from '@/lib/supabase/server';

export interface OrgFeatureDetail {
  enabled: boolean;
  value: string;
  value_type: string;
  name: string;
  source: string;
}

export interface OrgFeatures {
  org_id: string;
  plan_name: string;
  plan_tier: string;
  features: Record<string, OrgFeatureDetail>;
}

/**
 * Fetch the feature set for a given organization.
 *
 * @param orgId - The organization UUID
 * @returns The org's features, or a fail-open default if the RPC fails
 */
export async function getOrgFeatures(orgId: string): Promise<OrgFeatures> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('broker_get_org_features', {
    p_org_id: orgId,
  });

  if (error) {
    // Fail-open: if we can't check features, allow everything
    console.error('Failed to fetch org features:', error);
    return {
      org_id: orgId,
      plan_name: 'unknown',
      plan_tier: 'unknown',
      features: {},
    };
  }

  // Check for JSONB-level error (RPC returns errors as data, not Supabase errors)
  if (data && (data as any).error) {
    console.error('Broker feature gate RPC error:', (data as any).error, 'for org:', orgId);
    return {
      org_id: orgId,
      plan_name: 'unknown',
      plan_tier: 'unknown',
      features: {},
    };
  }

  return data as OrgFeatures;
}

/**
 * Check if a specific feature is enabled for the org.
 *
 * Fail-open: If the feature key is not found in the features map,
 * we return true (allow access). This ensures that unknown features
 * or missing data don't block users.
 *
 * @param features - The org's feature set from getOrgFeatures
 * @param featureKey - The feature key to check (e.g., 'text_export')
 * @returns true if the feature is enabled or unknown
 */
export function isFeatureEnabled(features: OrgFeatures, featureKey: string): boolean {
  const feature = features.features[featureKey];
  if (!feature) return true; // Unknown feature = allow (fail-open)
  return feature.enabled;
}

/**
 * Get the value of a specific feature flag.
 *
 * @param features - The org's feature set from getOrgFeatures
 * @param featureKey - The feature key to look up
 * @returns The feature's value string, or null if not found
 */
export function getFeatureValue(features: OrgFeatures, featureKey: string): string | null {
  const feature = features.features[featureKey];
  if (!feature) return null;
  return feature.value;
}
