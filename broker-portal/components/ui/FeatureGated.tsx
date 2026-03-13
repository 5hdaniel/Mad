/**
 * FeatureGated - Server component wrapper for feature-gated UI sections
 *
 * Conditionally renders children based on whether a feature is enabled
 * for the organization. When a feature is gated (disabled), the section
 * is simply not rendered -- no upgrade prompts in the broker portal.
 *
 * Usage (in server components only):
 *   <FeatureGated features={orgFeatures} featureKey="broker_text_view">
 *     <SomeComponent />
 *   </FeatureGated>
 *
 * TASK-2129: Broker Portal Feature Gate Enforcement
 */

import { isFeatureEnabled, type OrgFeatures } from '@/lib/feature-gate';

interface FeatureGatedProps {
  /** The org's feature set from getOrgFeatures */
  features: OrgFeatures;
  /** The feature key to check (e.g., 'broker_text_view', 'broker_email_view') */
  featureKey: string;
  /** Content to render when the feature is enabled */
  children: React.ReactNode;
  /** Optional content to render when the feature is gated (default: nothing) */
  fallback?: React.ReactNode;
}

export function FeatureGated({
  features,
  featureKey,
  children,
  fallback = null,
}: FeatureGatedProps) {
  if (!isFeatureEnabled(features, featureKey)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
