/**
 * FeatureGate Component
 * BACKLOG-1113: Renamed from common/LicenseGate to FeatureGate to avoid
 * confusion with license/LicenseGate (which gates the entire app).
 *
 * SPRINT-127 / TASK-2159: Migrated from LicenseContext to useFeatureGate
 *
 * Conditionally renders children based on plan-level feature access.
 * Uses useFeatureGate hook to check feature permissions from plan definitions
 * instead of checking license_type directly.
 *
 * Feature Mapping:
 *   - "individual" -> isAllowed("text_export") || isAllowed("email_export")
 *   - "team"       -> isAllowed("broker_submission")
 *   - "enterprise" -> isAllowed("broker_submission") (same gate, enterprise is a tier)
 *   - "ai_addon"   -> isAllowed("ai_detection")
 *
 * @example
 * ```tsx
 * // Gate Export button to plans with export features
 * <FeatureGate requires="individual">
 *   <Button onClick={handleExport}>Export</Button>
 * </FeatureGate>
 *
 * // Gate AI features to plans with AI detection
 * <FeatureGate requires="ai_addon">
 *   <AutoDetectionButton />
 * </FeatureGate>
 *
 * // Show fallback content when gate fails
 * <FeatureGate requires="team" fallback={<UpgradePrompt />}>
 *   <SubmitButton />
 * </FeatureGate>
 * ```
 */

import React from "react";
import { useFeatureGate } from "@/hooks/useFeatureGate";

export type FeatureRequirement =
  | "individual"
  | "team"
  | "enterprise"
  | "ai_addon";

/** @deprecated Use FeatureRequirement instead */
export type LicenseRequirement = FeatureRequirement;

export interface FeatureGateProps {
  /** Which feature/plan tier is required */
  requires: FeatureRequirement;
  /** What to show if gate fails (default: null) */
  fallback?: React.ReactNode;
  /** Content to show when gate passes */
  children: React.ReactNode;
}

/** @deprecated Use FeatureGateProps instead */
export type LicenseGateProps = FeatureGateProps;

/**
 * FeatureGate Component
 *
 * Renders children only if the user's plan allows the required feature.
 * Uses useFeatureGate (plan-based) instead of license_type checks.
 * Returns fallback (or null) if the requirement is not met.
 */
export function FeatureGate({
  requires,
  fallback = null,
  children,
}: FeatureGateProps): React.ReactElement | null {
  const { isAllowed, loading, hasInitialized } = useFeatureGate();

  // Don't render anything until feature gate data has loaded at least once.
  // After initialization, we trust the cached features even during refreshes
  // to prevent gated content from disappearing (flicker regression).
  if (loading && !hasInitialized) {
    return null;
  }

  const hasAccess = (() => {
    switch (requires) {
      case "individual":
        // Plans with export capability (text or email export)
        return isAllowed("text_export") || isAllowed("email_export");
      case "team":
        // Plans with broker submission capability
        return isAllowed("broker_submission");
      case "enterprise":
        // Plans with broker submission capability (enterprise is a tier, same gate)
        return isAllowed("broker_submission");
      case "ai_addon":
        // Plans with AI detection feature
        return isAllowed("ai_detection");
      default:
        return false;
    }
  })();

  if (hasAccess) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

/**
 * @deprecated Use FeatureGate instead. This alias exists for backward compatibility.
 */
export const LicenseGate = FeatureGate;

export default FeatureGate;
