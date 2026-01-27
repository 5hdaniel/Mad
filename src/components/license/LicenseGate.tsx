/**
 * LicenseGate Component
 * SPRINT-062: License Validation Gate
 *
 * Blocks access to the app when the license is invalid (expired, at limit, etc.)
 * Shows appropriate screens for each block reason.
 *
 * NOTE: This is different from src/components/common/LicenseGate.tsx which
 * gates individual features based on license type. This component gates the
 * entire app based on license validation status.
 */

import React from "react";
import { useLicense } from "../../contexts/LicenseContext";
import { UpgradeScreen } from "./UpgradeScreen";
import { DeviceLimitScreen } from "./DeviceLimitScreen";

interface LicenseGateProps {
  children: React.ReactNode;
}

/**
 * LicenseGate wraps the app content and shows blocking screens when license is invalid
 */
export function LicenseGate({ children }: LicenseGateProps): React.ReactElement {
  const { validationStatus, isLoading, isValid, blockReason } = useLicense();

  // Show loading while checking license
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-gray-600 text-sm">Checking license...</p>
        </div>
      </div>
    );
  }

  // If no validation status yet (user not logged in), allow access
  // The auth flow will handle login requirements separately
  if (!validationStatus) {
    return <>{children}</>;
  }

  // License is valid, render children
  if (isValid) {
    return <>{children}</>;
  }

  // License is blocked - show appropriate screen based on reason
  switch (blockReason) {
    case "expired":
      return <UpgradeScreen reason="trial_expired" />;

    case "limit_reached":
      return <UpgradeScreen reason="transaction_limit" />;

    case "no_license":
      // This shouldn't happen since we auto-create licenses, but handle it
      return <UpgradeScreen reason="unknown" />;

    case "suspended":
      return <UpgradeScreen reason="suspended" />;

    default:
      // Check if it's a device limit issue by looking at the validation status
      if (
        validationStatus.deviceCount >= validationStatus.deviceLimit &&
        validationStatus.deviceLimit > 0
      ) {
        return <DeviceLimitScreen />;
      }
      return <UpgradeScreen reason="unknown" />;
  }
}
