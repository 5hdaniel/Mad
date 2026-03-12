/**
 * LicenseGate Component
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
 * <LicenseGate requires="individual">
 *   <Button onClick={handleExport}>Export</Button>
 * </LicenseGate>
 *
 * // Gate Submit button to plans with broker submission
 * <LicenseGate requires="team">
 *   <Button onClick={handleSubmit}>Submit for Review</Button>
 * </LicenseGate>
 *
 * // Gate AI features to plans with AI detection
 * <LicenseGate requires="ai_addon">
 *   <AutoDetectionButton />
 * </LicenseGate>
 *
 * // Show fallback content when gate fails
 * <LicenseGate requires="team" fallback={<UpgradePrompt />}>
 *   <SubmitButton />
 * </LicenseGate>
 * ```
 */

import React from "react";
import { useFeatureGate } from "@/hooks/useFeatureGate";

export type LicenseRequirement =
  | "individual"
  | "team"
  | "enterprise"
  | "ai_addon";

export interface LicenseGateProps {
  /** Which license/feature is required */
  requires: LicenseRequirement;
  /** What to show if gate fails (default: null) */
  fallback?: React.ReactNode;
  /** Content to show when gate passes */
  children: React.ReactNode;
}

/**
 * LicenseGate Component
 *
 * Renders children only if the user's plan allows the required feature.
 * Uses useFeatureGate (plan-based) instead of license_type checks.
 * Returns fallback (or null) if the requirement is not met.
 */
export function LicenseGate({
  requires,
  fallback = null,
  children,
}: LicenseGateProps): React.ReactElement | null {
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

export default LicenseGate;
