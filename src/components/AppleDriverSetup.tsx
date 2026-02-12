/**
 * @deprecated Use `onboarding/steps/AppleDriverStep.tsx` instead.
 *
 * Migration guide:
 * 1. New step file has `meta` object with configuration
 * 2. Content component receives `onAction` callback
 * 3. Layout/navigation handled by OnboardingShell
 *
 * This file will be removed after migration is complete.
 */
import React, { useState, useEffect } from "react";
import { usePlatform } from "../contexts/PlatformContext";

// Type for the drivers API (accessed via type assertion due to TypeScript limitations with window.d.ts)
interface DriversAPI {
  checkApple: () => Promise<{
    installed: boolean;
    version?: string;
    serviceRunning: boolean;
    error?: string;
  }>;
  hasBundled: () => Promise<{ hasBundled: boolean }>;
  installApple: () => Promise<{
    success: boolean;
    cancelled?: boolean;
    error?: string;
    rebootRequired?: boolean;
  }>;
  openITunesStore: () => Promise<{ success: boolean; error?: string }>;
  checkUpdate?: () => Promise<{
    updateAvailable: boolean;
    installedVersion: string | null;
    bundledVersion: string | null;
  }>;
}

/**
 * Get the drivers API with proper typing
 * TypeScript doesn't properly pick up the drivers property from window.d.ts
 */
function getDriversAPI(): DriversAPI | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window.api as any)?.drivers as DriversAPI | null;
}

// Windows + iPhone setup steps (includes driver installation)
const WINDOWS_IPHONE_SETUP_STEPS = [
  { id: 1, label: "Phone Type" },
  { id: 2, label: "Connect Email" },
  { id: 3, label: "Install Tools" },
];

/**
 * Progress indicator component showing setup steps
 */
function SetupProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {WINDOWS_IPHONE_SETUP_STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                step.id < currentStep
                  ? "bg-green-500 text-white"
                  : step.id === currentStep
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {step.id < currentStep ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                step.id
              )}
            </div>
            <span
              className={`text-xs mt-1 ${step.id === currentStep ? "text-blue-600 font-medium" : "text-gray-500"}`}
            >
              {step.label}
            </span>
          </div>
          {index < WINDOWS_IPHONE_SETUP_STEPS.length - 1 && (
            <div
              className={`w-6 h-0.5 mb-5 transition-all ${
                step.id < currentStep ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

type InstallStatus =
  | "checking"
  | "not-installed"
  | "needs-update"
  | "installing"
  | "installed"
  | "already-installed"
  | "error"
  | "cancelled";

interface AppleDriverSetupProps {
  onComplete: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

/**
 * AppleDriverSetup Component
 * Guides Windows + iPhone users through Apple driver installation.
 * This appears after phone type selection for iPhone users on Windows.
 *
 * The component explains what tools are being installed and obtains
 * user consent before triggering the installation (which shows UAC prompt).
 */
function AppleDriverSetup({ onComplete, onSkip, onBack }: AppleDriverSetupProps) {
  const [status, setStatus] = useState<InstallStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasBundled, setHasBundled] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [bundledVersion, setBundledVersion] = useState<string | null>(null);
  const { isWindows } = usePlatform();

  // Check driver status on mount
  useEffect(() => {
    const checkDriverStatus = async () => {
      const drivers = getDriversAPI();
      if (!drivers) {
        console.error("[AppleDriverSetup] Drivers API not available");
        setStatus("error");
        setErrorMessage("Driver management is not available on this platform.");
        return;
      }

      try {
        // Check if drivers are already installed
        const driverResult = await drivers.checkApple();

        if (driverResult.installed && driverResult.serviceRunning) {
          // Drivers installed - check if update is available
          if (drivers.checkUpdate) {
            try {
              const updateResult = await drivers.checkUpdate();
              setInstalledVersion(updateResult.installedVersion);
              setBundledVersion(updateResult.bundledVersion);

              if (updateResult.updateAvailable) {
                // Update available
                const bundledResult = await drivers.hasBundled();
                setHasBundled(bundledResult.hasBundled);
                setStatus("needs-update");
                return;
              }
            } catch (updateError) {
              console.warn(
                "[AppleDriverSetup] Could not check for updates:",
                updateError,
              );
            }
          }
          // Already installed, no update needed - show green continue button
          setInstalledVersion(driverResult.version || null);
          setStatus("already-installed");
          return;
        }

        // Not installed - check if we have bundled MSI
        const bundledResult = await drivers.hasBundled();
        setHasBundled(bundledResult.hasBundled);
        setStatus("not-installed");
      } catch (error) {
        console.error("[AppleDriverSetup] Error checking drivers:", error);
        setStatus("not-installed");
      }
    };

    checkDriverStatus();
  }, []);

  const handleInstall = async () => {
    setStatus("installing");
    setErrorMessage(null);

    const drivers = getDriversAPI();
    if (!drivers) {
      setStatus("error");
      setErrorMessage("Driver management is not available.");
      return;
    }

    try {
      const result = await drivers.installApple();

      if (result.success) {
        setStatus("installed");
      } else if (result.cancelled) {
        setStatus("cancelled");
        setErrorMessage(
          "Installation was cancelled. You can try again or skip for now.",
        );
      } else {
        setStatus("error");
        setErrorMessage(
          result.error ||
            "Installation failed. Please try again or install iTunes manually.",
        );
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    }
  };

  const handleOpenITunesStore = async () => {
    const drivers = getDriversAPI();
    if (!drivers) return;

    try {
      await drivers.openITunesStore();
    } catch (error) {
      console.error("[AppleDriverSetup] Error opening iTunes store:", error);
    }
  };

  // Auto-continue when installation completes
  useEffect(() => {
    if (status === "installed") {
      // Small delay to show success message, then continue
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onComplete]);

  // On non-Windows platforms, trigger onComplete via effect (not during render)
  useEffect(() => {
    if (!isWindows) {
      onComplete();
    }
  }, [isWindows, onComplete]);

  // Only show on Windows
  if (!isWindows) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header with Progress Indicator */}
      <div className="w-full p-4 flex justify-center">
        <SetupProgressIndicator currentStep={3} />
      </div>

      {/* Centered Content */}
      <div className="flex-1 flex items-start justify-center pt-8 px-4">
        <div className="max-w-xl w-full">
          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  status === "installed" || status === "already-installed"
                    ? "bg-green-100"
                    : status === "needs-update"
                      ? "bg-amber-100"
                      : status === "error" || status === "cancelled"
                        ? "bg-red-100"
                        : "bg-blue-100"
                }`}
              >
                {status === "checking" || status === "installing" ? (
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : status === "installed" || status === "already-installed" ? (
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : status === "needs-update" ? (
                  <svg
                    className="w-8 h-8 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                ) : status === "error" || status === "cancelled" ? (
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-8 h-8 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                )}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {status === "checking"
                  ? "Checking System..."
                  : status === "installing"
                    ? "Installing Tools..."
                    : status === "installed" || status === "already-installed"
                      ? "Tools Ready!"
                      : status === "needs-update"
                        ? "Update Available"
                        : status === "error" || status === "cancelled"
                          ? "Installation Issue"
                          : "Install iPhone Tools"}
              </h1>

              <p className="text-gray-600">
                {status === "checking"
                  ? "Checking if Apple tools are already installed..."
                  : status === "installing"
                    ? "Please approve the installation when prompted..."
                    : status === "installed" || status === "already-installed"
                      ? "Your computer is ready to sync with your iPhone."
                      : status === "needs-update"
                        ? "A newer version of Apple tools is available."
                        : status === "error" || status === "cancelled"
                          ? errorMessage
                          : "To sync messages from your iPhone, we need to install Apple's official tools."}
              </p>
            </div>

            {/* Needs Update State - Show update option */}
            {status === "needs-update" && (
              <>
                {/* Version info */}
                <div className="bg-amber-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-amber-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Update Details
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>
                        Current version:{" "}
                        <strong>{installedVersion || "Unknown"}</strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span>
                        New version:{" "}
                        <strong>{bundledVersion || "Available"}</strong>
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Consent notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">
                        Administrator Permission Required
                      </p>
                      <p>
                        Updating will require administrator permission. Your
                        existing settings will be preserved.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Update Button */}
                {hasBundled ? (
                  <button
                    onClick={handleInstall}
                    className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all shadow-md hover:shadow-lg mb-3"
                  >
                    Update Tools
                  </button>
                ) : (
                  <>
                    <p className="text-sm text-amber-600 mb-3 text-center">
                      Bundled update not found. You can update via iTunes from
                      the Microsoft Store.
                    </p>
                    <button
                      onClick={handleOpenITunesStore}
                      className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all shadow-md hover:shadow-lg mb-3"
                    >
                      Open Microsoft Store (iTunes)
                    </button>
                  </>
                )}

              </>
            )}

            {/* Not Installed State - Show consent and explanation */}
            {status === "not-installed" && (
              <>
                {/* What gets installed */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    What gets installed
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span>
                        <strong>Apple Mobile Device Support</strong> - Required
                        to communicate with your iPhone
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span>This is Apple's official software</span>
                    </li>
                  </ul>
                </div>

                {/* Consent notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">
                        Administrator Permission Required
                      </p>
                      <p>
                        By clicking "Install Tools", you consent to installing
                        Apple Mobile Device Support on your computer. Windows
                        will ask for administrator permission to proceed.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Install Button - only shown when bundled MSI is available */}
                {hasBundled ? (
                  <button
                    onClick={handleInstall}
                    className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all shadow-md hover:shadow-lg mb-3"
                  >
                    Install Tools
                  </button>
                ) : (
                  <>
                    <p className="text-sm text-amber-600 mb-3 text-center">
                      Bundled installer not found. Install iTunes to get the
                      required drivers.
                    </p>
                    <button
                      onClick={handleOpenITunesStore}
                      className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all shadow-md hover:shadow-lg mb-3"
                    >
                      Open Microsoft Store (iTunes)
                    </button>
                  </>
                )}

              </>
            )}

            {/* Installing State */}
            {status === "installing" && (
              <div className="text-center py-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm">
                  A Windows dialog will appear asking for permission.
                  <br />
                  Please click "Yes" to continue.
                </p>
              </div>
            )}

            {/* Installed State (just finished installing) - auto-continues */}
            {status === "installed" && (
              <div className="text-center py-4">
                <p className="text-gray-600 text-sm">
                  Continuing to the next step...
                </p>
              </div>
            )}

            {/* Already Installed State (detected on load) - show green continue */}
            {status === "already-installed" && (
              <>
                {/* Version info */}
                <div className="bg-green-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Already Installed
                  </h3>
                  <p className="text-sm text-gray-600">
                    Apple Mobile Device Support is installed and running.
                    {installedVersion && (
                      <span className="block mt-1 text-gray-500">
                        Version: {installedVersion}
                      </span>
                    )}
                  </p>
                </div>

                {/* Green Continue Button */}
                <button
                  onClick={onComplete}
                  className="w-full py-3 px-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all shadow-md hover:shadow-lg"
                >
                  Continue
                </button>
              </>
            )}

            {/* Error/Cancelled State */}
            {(status === "error" || status === "cancelled") && (
              <>
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={handleInstall}
                    className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleOpenITunesStore}
                    className="flex-1 py-3 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    Install iTunes
                  </button>
                </div>
              </>
            )}

            {/* Checking State */}
            {status === "checking" && (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            )}
          </div>

          {/* Additional info */}
          {status === "not-installed" && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Magic Audit does not distribute Apple software. We help you
              install Apple's official tools which are required to communicate
              with iPhone devices.
            </p>
          )}

          {/* Navigation Footer - shown for states where user can navigate */}
          {(status === "not-installed" || status === "needs-update" || status === "error" || status === "cancelled") && (
            <>
              {/* Back Button */}
              <div className="flex items-center justify-start pt-4 mt-4 border-t border-gray-200">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-gray-700 hover:bg-gray-100"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    <span>Back</span>
                  </button>
                )}
              </div>

              {/* Skip Option */}
              <div className="text-center mt-4">
                <button
                  onClick={onSkip}
                  className="text-gray-500 hover:text-gray-700 py-2 text-sm font-medium transition-colors"
                >
                  Skip for Now
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  You can install these tools later via the iPhone sync option
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AppleDriverSetup;
