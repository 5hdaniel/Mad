/**
 * LicenseGate Component
 *
 * Conditionally renders children based on user's license type and AI add-on status.
 * Used to gate features based on license permissions.
 *
 * License Model (BACKLOG-426):
 *   - Individual: Can export locally
 *   - Team/Enterprise: Can submit for broker review
 *   - AI Add-on: Works with ANY base license, enables AI detection features
 *
 * @example
 * ```tsx
 * // Gate Export button to Individual license only
 * <LicenseGate requires="individual">
 *   <Button onClick={handleExport}>Export</Button>
 * </LicenseGate>
 *
 * // Gate Submit button to Team license (includes Enterprise)
 * <LicenseGate requires="team">
 *   <Button onClick={handleSubmit}>Submit for Review</Button>
 * </LicenseGate>
 *
 * // Gate AI features to AI add-on
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
import { useLicense } from "@/contexts/LicenseContext";

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
 * Renders children only if the user has the required license or feature.
 * Returns fallback (or null) if the requirement is not met.
 */
export function LicenseGate({
  requires,
  fallback = null,
  children,
}: LicenseGateProps): React.ReactElement | null {
  const { licenseType, hasAIAddon, isLoading } = useLicense();

  // Don't render anything while loading to prevent UI flicker
  if (isLoading) {
    return null;
  }

  const hasAccess = (() => {
    switch (requires) {
      case "individual":
        // Individual license only (for local export)
        return licenseType === "individual";
      case "team":
        // Team OR Enterprise (for submit to broker)
        return licenseType === "team" || licenseType === "enterprise";
      case "enterprise":
        // Enterprise only
        return licenseType === "enterprise";
      case "ai_addon":
        // AI detection add-on (works with any license)
        return hasAIAddon;
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
