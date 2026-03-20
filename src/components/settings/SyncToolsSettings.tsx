/**
 * SyncToolsSettings — Apple driver status & install/repair (Windows only)
 *
 * Uses the existing IPC bridge:
 *   window.api.drivers.checkApple()   → drivers:check-apple
 *   window.api.drivers.installApple() → drivers:install-apple
 *   window.api.drivers.hasBundled()   → drivers:has-bundled
 */

import React, { useState, useEffect, useCallback } from "react";
import logger from "../../utils/logger";

// ---------------------------------------------------------------------------
// Types — mirrors WindowApiDrivers return shapes (no duplicate of AppleDriverStatus)
// ---------------------------------------------------------------------------

interface DriverStatusInfo {
  isInstalled: boolean;
  version: string | null;
  serviceRunning: boolean;
  error: string | null;
}

interface InstallProgress {
  phase: "idle" | "downloading" | "installing" | "complete" | "error";
  message: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncToolsSettings() {
  const [driverStatus, setDriverStatus] = useState<DriverStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [installProgress, setInstallProgress] = useState<InstallProgress>({
    phase: "idle",
    message: "",
  });

  // ------------------------------------------------------------------
  // Check driver status on mount
  // ------------------------------------------------------------------
  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await window.api.drivers?.checkApple();
      if (status) {
        setDriverStatus({
          isInstalled: status.isInstalled,
          version: status.version,
          serviceRunning: status.serviceRunning,
          error: status.error,
        });
      } else {
        setDriverStatus(null);
      }
    } catch (err) {
      logger.error("[SyncTools] Failed to check drivers:", err);
      setDriverStatus({
        isInstalled: false,
        version: null,
        serviceRunning: false,
        error: "Failed to check driver status",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ------------------------------------------------------------------
  // Install / Repair handler
  // ------------------------------------------------------------------
  const handleInstall = useCallback(async () => {
    setInstallProgress({ phase: "downloading", message: "Preparing installation..." });

    try {
      setInstallProgress({ phase: "installing", message: "Installing drivers (admin privileges required)..." });

      const result = await window.api.drivers?.installApple();

      if (result?.success) {
        setInstallProgress({ phase: "complete", message: "Sync tools installed successfully." });
        // Refresh status after a short delay to let services start
        setTimeout(() => {
          refreshStatus();
        }, 2000);
      } else {
        setInstallProgress({
          phase: "error",
          message: result?.error ?? "Installation failed. Try installing iTunes from the Microsoft Store.",
        });
      }
    } catch (err) {
      setInstallProgress({
        phase: "error",
        message: err instanceof Error ? err.message : "Installation failed",
      });
    }
  }, [refreshStatus]);

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const isInstalling = installProgress.phase === "downloading" || installProgress.phase === "installing";

  return (
    <div id="settings-sync" className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sync Tools</h3>

      <div className="space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600">
          iPhone sync requires Apple Mobile Device Support to communicate with your device.
        </p>

        {/* Driver Status Card */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
          {/* Driver install status row */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Apple Mobile Device Support</span>
            {loading ? (
              <span className="text-sm text-gray-500">Checking...</span>
            ) : driverStatus?.error && !driverStatus.isInstalled ? (
              <span className="text-sm text-red-600">Error: {driverStatus.error}</span>
            ) : driverStatus?.isInstalled ? (
              <span className="text-sm text-green-600">
                Installed{driverStatus.version ? ` (v${driverStatus.version})` : ""}
              </span>
            ) : (
              <span className="text-sm text-red-600">Not Installed</span>
            )}
          </div>

          {/* Service status row — only when drivers are installed */}
          {driverStatus?.isInstalled && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Service Status</span>
              <span
                className={`text-sm ${driverStatus.serviceRunning ? "text-green-600" : "text-amber-600"}`}
              >
                {driverStatus.serviceRunning ? "Running" : "Stopped"}
              </span>
            </div>
          )}

          {/* Action buttons */}
          {!loading && !driverStatus?.isInstalled && installProgress.phase === "idle" && (
            <button
              onClick={handleInstall}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Install Sync Tools
            </button>
          )}

          {!loading &&
            driverStatus?.isInstalled &&
            !driverStatus.serviceRunning &&
            installProgress.phase === "idle" && (
              <button
                onClick={handleInstall}
                className="w-full px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors"
              >
                Repair Installation
              </button>
            )}

          {/* Progress indicator */}
          {isInstalling && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-700">{installProgress.message}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  role="progressbar"
                  style={{ width: installProgress.phase === "downloading" ? "30%" : "70%" }}
                />
              </div>
            </div>
          )}

          {/* Success display */}
          {installProgress.phase === "complete" && (
            <div className="text-sm text-green-700 bg-green-50 p-3 rounded border border-green-200">
              {installProgress.message}
            </div>
          )}

          {/* Error display */}
          {installProgress.phase === "error" && (
            <div className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
              {installProgress.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
