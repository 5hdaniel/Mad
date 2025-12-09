/**
 * Feature Gate Component
 *
 * Conditionally renders children based on feature availability.
 * Features are mapped to platforms in the platformFeatures config.
 */

import React, { ReactNode } from "react";
import { usePlatform } from "../../contexts/PlatformContext";
import { FeatureName } from "../../utils/platform";

interface FeatureGateProps {
  /** The feature to check availability for */
  feature: FeatureName;
  /** Content to render when feature is available */
  children: ReactNode;
  /** Optional fallback content when feature is not available */
  fallback?: ReactNode;
}

/**
 * Renders children only when a feature is available on the current platform.
 *
 * @example
 * // Show local Messages access on macOS only
 * <FeatureGate feature="localMessagesAccess">
 *   <button>Access Messages.app</button>
 * </FeatureGate>
 *
 * @example
 * // Show USB sync on Windows/Linux with fallback for macOS
 * <FeatureGate
 *   feature="iPhoneUSBSync"
 *   fallback={<p>Use Messages.app directly</p>}
 * >
 *   <button>Sync from iPhone via USB</button>
 * </FeatureGate>
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback = null,
}) => {
  const { isFeatureAvailable } = usePlatform();

  if (isFeatureAvailable(feature)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
