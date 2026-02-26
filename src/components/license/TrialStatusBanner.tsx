/**
 * TrialStatusBanner Component
 * SPRINT-062: Trial Days Remaining Banner
 *
 * Shows a banner at the top of the app for trial users indicating how many
 * days remain in their trial. Uses urgent styling when <= 3 days remain.
 */

import React from "react";
import { useLicense } from "../../contexts/LicenseContext";

export function TrialStatusBanner(): React.ReactElement | null {
  const { validationStatus, trialDaysRemaining } = useLicense();

  // Only show for trial users with days remaining info
  if (!validationStatus || validationStatus.licenseType !== "trial") {
    return null;
  }

  if (trialDaysRemaining === null || trialDaysRemaining === undefined) {
    return null;
  }

  // Don't show banner if trial is expired (they'll see the upgrade screen)
  if (trialDaysRemaining <= 0) {
    return null;
  }

  const isUrgent = trialDaysRemaining <= 3;

  const handleUpgrade = () => {
    window.api?.shell?.openExternal?.("https://keeprcompliance.com/pricing");
  };

  return (
    <div
      className={`px-4 py-2 text-center text-sm flex-shrink-0 ${
        isUrgent
          ? "bg-yellow-100 text-yellow-800 border-b border-yellow-200"
          : "bg-blue-50 text-blue-800 border-b border-blue-100"
      }`}
    >
      <span>
        {trialDaysRemaining === 1
          ? "Your trial ends tomorrow!"
          : `${trialDaysRemaining} days left in your free trial.`}
      </span>
      <button
        onClick={handleUpgrade}
        className="ml-2 underline hover:no-underline font-medium"
      >
        Upgrade now
      </button>
    </div>
  );
}
