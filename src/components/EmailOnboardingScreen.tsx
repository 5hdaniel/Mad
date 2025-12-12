import React, { useState, useEffect } from "react";
import { usePlatform } from "../contexts/PlatformContext";
import type { PendingEmailTokens } from "../appCore/state/types";

interface ConnectionStatus {
  connected: boolean;
  email?: string;
}

interface Connections {
  google: ConnectionStatus | null;
  microsoft: ConnectionStatus | null;
}

interface ConnectionResult {
  success: boolean;
}

interface EmailOnboardingScreenProps {
  userId: string;
  authProvider: "google" | "microsoft";
  selectedPhoneType: "iphone" | "android" | null;
  onPhoneTypeChange: (phoneType: "iphone" | "android") => Promise<void>;
  onComplete: (emailTokens?: PendingEmailTokens) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  onBack: () => void;
  isPreDbFlow?: boolean;
  emailHint?: string;
  existingPendingTokens?: PendingEmailTokens | null;
}

// Setup steps for progress indicator - platform specific
// macOS: 4-step flow (Sign In happens before onboarding)
const MACOS_SETUP_STEPS = [
  { id: 1, label: "Phone Type" },
  { id: 2, label: "Secure Storage" },
  { id: 3, label: "Connect Email" },
  { id: 4, label: "Permissions" },
];

// Windows: 3-step flow (Sign In already complete before onboarding)
const WINDOWS_SETUP_STEPS = [
  { id: 1, label: "Phone Type" },
  { id: 2, label: "Connect Email" },
  { id: 3, label: "Install Tools" },
];

/**
 * Progress indicator component showing setup steps
 */
function SetupProgressIndicator({
  currentStep,
  navigationStep,
  isWindows,
}: {
  currentStep: number;
  navigationStep: number;
  isWindows: boolean;
}) {
  const steps = isWindows ? WINDOWS_SETUP_STEPS : MACOS_SETUP_STEPS;
  return (
    <div className="mb-8">
      {/* Circles and connecting lines */}
      <div className="flex items-center justify-center px-2 mb-3">
        {/* Invisible spacer before first circle */}
        <div className="w-1 h-0.5 flex-shrink-0" />

        {steps.map((step, index) => (
          <React.Fragment key={`circle-${step.id}`}>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all flex-shrink-0 ${
                step.id < currentStep
                  ? "bg-green-500 text-white"
                  : step.id === currentStep
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-500"
              } ${navigationStep === step.id ? "ring-2 ring-offset-2 ring-blue-500" : ""}`}
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
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 transition-all max-w-[48px] ${
                  step.id < currentStep ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}

        {/* Invisible spacer after last circle */}
        <div className="w-1 h-0.5 flex-shrink-0" />
      </div>

      {/* Labels - aligned with circles above */}
      <div className="flex items-start justify-center px-2">
        {/* Invisible spacer to match circle row */}
        <div className="w-1 flex-shrink-0" />

        {steps.map((step, index) => (
          <React.Fragment key={`label-${step.id}`}>
            <div className="flex-shrink-0 w-8 flex items-center justify-center">
              <span
                className={`text-xs text-center max-w-[56px] ${navigationStep === step.id ? "text-blue-600 font-medium" : step.id === currentStep ? "text-blue-600 font-medium" : "text-gray-500"}`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 mx-1 max-w-[48px]" />
            )}
          </React.Fragment>
        ))}

        {/* Invisible spacer to match circle row */}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}

/**
 * EmailOnboardingScreen Component
 * Prompts new users to connect their email accounts (Gmail/Outlook) during onboarding.
 * This screen appears after terms acceptance and before the permissions screen.
 * Shows the primary email service (matching login provider) prominently, with the other as optional.
 */
function EmailOnboardingScreen({
  userId,
  authProvider,
  selectedPhoneType,
  onPhoneTypeChange,
  onComplete,
  onSkip,
  onBack,
  isPreDbFlow = false,
  emailHint,
  existingPendingTokens,
}: EmailOnboardingScreenProps) {
  const { isWindows } = usePlatform();

  const [connections, setConnections] = useState<Connections>({
    google: null,
    microsoft: null,
  });
  const [loadingConnections, setLoadingConnections] = useState<boolean>(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  );
  // Store pending tokens collected during this screen (when using pending API)
  // We can only store one at a time - the most recent connection
  const [pendingTokens, setPendingTokens] = useState<PendingEmailTokens | null>(
    existingPendingTokens || null,
  );
  // Also track if we connected via regular (non-pending) API
  const [connectedViaRegularApi, setConnectedViaRegularApi] = useState(false);
  // Start navigation at the current step for this screen
  // On Windows: currentStep is 2 (Connect Email), so start navigation at 2
  // On macOS: varies based on where user is in the flow
  const [navigationStep, setNavigationStep] = useState<number>(isWindows ? 2 : 1);
  const [phoneTypeChanging, setPhoneTypeChanging] = useState<boolean>(false);

  // Determine primary and secondary providers based on how user logged in
  const isPrimaryGoogle = authProvider === "google";
  const primaryProvider = isPrimaryGoogle ? "google" : "microsoft";
  const secondaryProvider = isPrimaryGoogle ? "microsoft" : "google";

  // Current step differs by platform
  // Windows: step 2 (Phone Type=1, Connect Email=2, Install Tools=3)
  // macOS: step 3 (Phone Type=1, Secure Storage=2, Connect Email=3, Permissions=4)
  const currentStep = isWindows ? 2 : 3;
  const steps = isWindows ? WINDOWS_SETUP_STEPS : MACOS_SETUP_STEPS;

  // Navigation handlers
  const handleBackStep = (): void => {
    if (navigationStep > 1) {
      setNavigationStep(navigationStep - 1);
    } else if (navigationStep === 1 && onBack) {
      // At first step, navigate back to PhoneTypeSelection
      onBack();
    }
  };

  const handleNextStep = (): void => {
    // Only allow navigation forward if not past the current step
    if (navigationStep < currentStep) {
      setNavigationStep(navigationStep + 1);
    }
  };

  // Only consider it the "first step" (disable back button) if at step 1 AND no onBack handler
  const isFirstStep = navigationStep === 1 && !onBack;
  const isLastNavigableStep = navigationStep === currentStep;

  // Check existing connections on mount
  useEffect(() => {
    if (userId) {
      checkConnections();
    }
  }, [userId]);

  const checkConnections = async (): Promise<void> => {
    setLoadingConnections(true);
    try {
      const result = await window.api.system.checkAllConnections(userId);
      if (result.success) {
        setConnections({
          google: result.google || null,
          microsoft: result.microsoft || null,
        });
      }
    } catch (error) {
      console.error("[EmailOnboarding] Failed to check connections:", error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleConnectGoogle = async (): Promise<void> => {
    setConnectingProvider("google");
    let cleanupConnected: (() => void) | undefined;
    let cleanupCancelled: (() => void) | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let usePendingApi = isPreDbFlow;

    const cleanup = () => {
      if (cleanupConnected) cleanupConnected();
      if (cleanupCancelled) cleanupCancelled();
      if (timeoutId) clearTimeout(timeoutId);
    };

    try {
      // Try regular API first if not in pre-DB flow, fall back to pending if DB not ready
      let result;
      if (usePendingApi) {
        result = await window.api.auth.googleConnectMailboxPending(emailHint);
      } else {
        result = await window.api.auth.googleConnectMailbox(userId);
        // If regular API fails due to DB not initialized, fall back to pending API
        if (!result.success && result.error?.includes("Database is not initialized")) {
          console.log("[EmailOnboarding] DB not ready, falling back to pending API for Google");
          usePendingApi = true;
          result = await window.api.auth.googleConnectMailboxPending(emailHint);
        }
      }

      if (result.success) {
        // Set up timeout fallback - if no response in 2 minutes, reset state
        timeoutId = setTimeout(() => {
          console.warn(
            "[EmailOnboarding] Google connection timed out after 2 minutes",
          );
          setConnectingProvider(null);
          cleanup();
        }, 120000);

        // Use appropriate event listeners based on flow type
        if (usePendingApi) {
          cleanupConnected = window.api.onGoogleMailboxPendingConnected(
            async (connectionResult: { success: boolean; email?: string; tokens?: PendingEmailTokens["tokens"]; error?: string }) => {
              try {
                if (connectionResult.success && connectionResult.email && connectionResult.tokens) {
                  console.log("[EmailOnboarding] Google pending connection successful:", connectionResult.email);
                  // Store pending tokens for later saving after DB init
                  setPendingTokens({
                    provider: "google",
                    email: connectionResult.email,
                    tokens: connectionResult.tokens,
                  });
                  setConnections((prev) => ({
                    ...prev,
                    google: { connected: true, email: connectionResult.email! },
                  }));
                }
              } catch (error) {
                console.error(
                  "[EmailOnboarding] Error handling pending Google connect:",
                  error,
                );
              } finally {
                setConnectingProvider(null);
                cleanup();
              }
            },
          );
          cleanupCancelled = window.api.onGoogleMailboxPendingCancelled(() => {
            console.log("[EmailOnboarding] Google pending connection cancelled");
            setConnectingProvider(null);
            cleanup();
          });
        } else {
          cleanupConnected = window.api.onGoogleMailboxConnected(
            async (connectionResult: ConnectionResult) => {
              try {
                if (connectionResult.success) {
                  console.log("[EmailOnboarding] Google regular connection successful");
                  setConnectedViaRegularApi(true);
                  await checkConnections();
                }
              } catch (error) {
                console.error(
                  "[EmailOnboarding] Error checking connections after Google connect:",
                  error,
                );
              } finally {
                setConnectingProvider(null);
                cleanup();
              }
            },
          );
          cleanupCancelled = window.api.onGoogleMailboxCancelled(() => {
            console.log("[EmailOnboarding] Google regular connection cancelled");
            setConnectingProvider(null);
            cleanup();
          });
        }
      } else {
        // API returned success: false - reset state
        console.error("[EmailOnboarding] Google connect returned failure:", result);
        setConnectingProvider(null);
      }
    } catch (error) {
      console.error("[EmailOnboarding] Failed to connect Google:", error);
      setConnectingProvider(null);
      cleanup();
    }
  };

  const handleConnectMicrosoft = async (): Promise<void> => {
    setConnectingProvider("microsoft");
    let cleanupConnected: (() => void) | undefined;
    let cleanupCancelled: (() => void) | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let usePendingApi = isPreDbFlow;

    const cleanup = () => {
      if (cleanupConnected) cleanupConnected();
      if (cleanupCancelled) cleanupCancelled();
      if (timeoutId) clearTimeout(timeoutId);
    };

    try {
      // Try regular API first if not in pre-DB flow, fall back to pending if DB not ready
      let result;
      if (usePendingApi) {
        result = await window.api.auth.microsoftConnectMailboxPending(emailHint);
      } else {
        result = await window.api.auth.microsoftConnectMailbox(userId);
        // If regular API fails due to DB not initialized, fall back to pending API
        if (!result.success && result.error?.includes("Database is not initialized")) {
          console.log("[EmailOnboarding] DB not ready, falling back to pending API for Microsoft");
          usePendingApi = true;
          result = await window.api.auth.microsoftConnectMailboxPending(emailHint);
        }
      }

      if (result.success) {
        // Set up timeout fallback - if no response in 2 minutes, reset state
        timeoutId = setTimeout(() => {
          console.warn(
            "[EmailOnboarding] Microsoft connection timed out after 2 minutes",
          );
          setConnectingProvider(null);
          cleanup();
        }, 120000);

        // Use appropriate event listeners based on flow type
        if (usePendingApi) {
          cleanupConnected = window.api.onMicrosoftMailboxPendingConnected(
            async (connectionResult: { success: boolean; email?: string; tokens?: PendingEmailTokens["tokens"]; error?: string }) => {
              try {
                if (connectionResult.success && connectionResult.email && connectionResult.tokens) {
                  console.log("[EmailOnboarding] Microsoft pending connection successful:", connectionResult.email);
                  // Store pending tokens for later saving after DB init
                  setPendingTokens({
                    provider: "microsoft",
                    email: connectionResult.email,
                    tokens: connectionResult.tokens,
                  });
                  setConnections((prev) => ({
                    ...prev,
                    microsoft: { connected: true, email: connectionResult.email! },
                  }));
                }
              } catch (error) {
                console.error(
                  "[EmailOnboarding] Error handling pending Microsoft connect:",
                  error,
                );
              } finally {
                setConnectingProvider(null);
                cleanup();
              }
            },
          );
          cleanupCancelled = window.api.onMicrosoftMailboxPendingCancelled(() => {
            console.log("[EmailOnboarding] Microsoft pending connection cancelled");
            setConnectingProvider(null);
            cleanup();
          });
        } else {
          cleanupConnected = window.api.onMicrosoftMailboxConnected(
            async (connectionResult: ConnectionResult) => {
              try {
                if (connectionResult.success) {
                  console.log("[EmailOnboarding] Microsoft regular connection successful");
                  setConnectedViaRegularApi(true);
                  await checkConnections();
                }
              } catch (error) {
                console.error(
                  "[EmailOnboarding] Error checking connections after Microsoft connect:",
                  error,
                );
              } finally {
                setConnectingProvider(null);
                cleanup();
              }
            },
          );
          cleanupCancelled = window.api.onMicrosoftMailboxCancelled(() => {
            console.log("[EmailOnboarding] Microsoft regular connection cancelled");
            setConnectingProvider(null);
            cleanup();
          });
        }
      } else {
        // API returned success: false - reset state
        console.error("[EmailOnboarding] Microsoft connect returned failure:", result);
        setConnectingProvider(null);
      }
    } catch (error) {
      console.error("[EmailOnboarding] Failed to connect Microsoft:", error);
      setConnectingProvider(null);
      cleanup();
    }
  };

  const handleContinue = (): void => {
    console.log("[EmailOnboarding] Continue clicked, pendingTokens:", pendingTokens, "connectedViaRegularApi:", connectedViaRegularApi);
    // Pass pending tokens if we collected any during the pending API flow
    if (pendingTokens) {
      onComplete(pendingTokens);
    } else {
      onComplete();
    }
  };

  const handleSkip = (): void => {
    onSkip();
  };

  const handlePhoneTypeSelect = async (
    phoneType: "iphone" | "android",
  ): Promise<void> => {
    if (!onPhoneTypeChange) return;
    setPhoneTypeChanging(true);
    try {
      await onPhoneTypeChange(phoneType);
      // Phone type updated, now advance to next step
      setNavigationStep(navigationStep + 1);
    } catch (error) {
      console.error("[EmailOnboarding] Failed to update phone type:", error);
    } finally {
      setPhoneTypeChanging(false);
    }
  };

  const hasAnyConnection =
    connections.google?.connected || connections.microsoft?.connected;
  const primaryConnection = isPrimaryGoogle
    ? connections.google
    : connections.microsoft;
  const secondaryConnection = isPrimaryGoogle
    ? connections.microsoft
    : connections.google;

  // Provider display info
  const providerInfo = {
    google: {
      name: "Gmail",
      icon: (
        <svg
          className="w-6 h-6 text-red-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z" />
        </svg>
      ),
      hoverBorder: "hover:border-red-300",
      hoverBg: "hover:bg-red-50",
      connectHandler: handleConnectGoogle,
    },
    microsoft: {
      name: "Outlook",
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 21 21" fill="none">
          {/* Microsoft 4-square logo */}
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
      ),
      hoverBorder: "hover:border-blue-300",
      hoverBg: "hover:bg-blue-50",
      connectHandler: handleConnectMicrosoft,
    },
  };

  const primaryInfo = providerInfo[primaryProvider];
  const secondaryInfo = providerInfo[secondaryProvider];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Progress Indicator */}
        <SetupProgressIndicator
          currentStep={currentStep}
          navigationStep={navigationStep}
          isWindows={isWindows}
        />

        {/* Conditional Content Based on Navigation Step */}
        {navigationStep === 1 && (
          <>
            {/* Phone Type Step */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Select Your Phone Type
              </h2>
              <p className="text-gray-600">
                Choose the type of device you'll be using with this application.
              </p>
            </div>

            <div className="mb-8 bg-blue-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">
                Why is this important?
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-blue-800">
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
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
                  <span>Optimizes the application for your device</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-blue-800">
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
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
                  <span>Ensures compatibility with your phone's features</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {/* iPhone Option */}
              <button
                onClick={() => handlePhoneTypeSelect("iphone")}
                disabled={phoneTypeChanging}
                className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedPhoneType === "iphone"
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                }`}
              >
                {/* Checkmark for selected */}
                {selectedPhoneType === "iphone" && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
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
                    </div>
                  </div>
                )}

                {/* Apple Logo */}
                <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-4">
                  <svg
                    className="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">iPhone</h3>
                <p className="text-sm text-gray-500">
                  Sync messages and contacts from your iPhone
                </p>
              </button>

              {/* Android Option */}
              <button
                onClick={() => handlePhoneTypeSelect("android")}
                disabled={phoneTypeChanging}
                className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedPhoneType === "android"
                    ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                    : "border-gray-200 hover:border-green-400 hover:bg-green-50"
                }`}
              >
                {/* Checkmark for selected */}
                {selectedPhoneType === "android" && (
                  <div className="absolute top-3 right-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
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
                    </div>
                  </div>
                )}

                {/* Android Logo */}
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mb-4">
                  <svg
                    className="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.54-.38-.84-.22-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
                  </svg>
                </div>

                <h3 className="font-semibold text-gray-900 mb-1">Android</h3>
                <p className="text-sm text-gray-500">
                  Samsung, Google Pixel, and other Android phones
                </p>
              </button>
            </div>
          </>
        )}

        {navigationStep === 2 && !isWindows && (
          <>
            {/* Secure Storage Step (macOS only) */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-teal-600 rounded-full mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Secure Storage Settings
              </h2>
              <p className="text-gray-600">
                Configure how your data is stored and protected on this device.
              </p>
            </div>

            <div className="mb-8 bg-green-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-green-900 mb-3">
                Security Features
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-green-800">
                  <svg
                    className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
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
                  <span>Encrypt sensitive data at rest</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-green-800">
                  <svg
                    className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
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
                  <span>Protect data with device biometrics</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3 mb-8">
              <button
                onClick={handleNextStep}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md"
              >
                Enable Secure Storage
              </button>
            </div>
          </>
        )}

        {(navigationStep === 3 && !isWindows) ||
        (navigationStep === 2 && isWindows) ? (
          <>
            {/* Connect Email Step */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Connect Your {primaryInfo.name}
              </h2>
              <p className="text-gray-600">
                Connect your {primaryInfo.name} account to export email
                communications alongside text messages for complete audit
                trails.
              </p>
            </div>

            <div className="mb-8 bg-blue-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">
                Why connect your email?
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-blue-800">
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
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
                  <span>
                    Export complete communication history with clients
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm text-blue-800">
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
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
                  <span>Include emails in your audit documentation</span>
                </li>
              </ul>
            </div>
          </>
        ) : null}

        {navigationStep === 4 && !isWindows && (
          <>
            {/* Permissions Step (macOS only) */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-6 shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
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
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                App Permissions
              </h2>
              <p className="text-gray-600">
                Grant necessary permissions for the application to function
                properly.
              </p>
            </div>

            <div className="mb-8 bg-purple-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-purple-900 mb-3">
                Required Permissions
              </h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-purple-800">
                  <svg
                    className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5"
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
                  <span>Access contact information</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-purple-800">
                  <svg
                    className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5"
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
                  <span>Access call history</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleContinue}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md mb-3"
            >
              Grant Permissions
            </button>
          </>
        )}

        {/* Email Connection Cards - Highlighted (only show for email step) */}
        {((navigationStep === 3 && !isWindows) ||
          (navigationStep === 2 && isWindows)) && (
          <>
            <div className="mb-6">
              <div className="p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-lg shadow-md flex items-center justify-center">
                      {primaryInfo.icon}
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">
                        {primaryInfo.name}
                      </h4>
                      {loadingConnections ? (
                        <p className="text-xs text-gray-500">Checking...</p>
                      ) : primaryConnection?.connected ? (
                        <p className="text-xs text-green-600 font-medium">
                          Connected: {primaryConnection.email}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Recommended - matches your login
                        </p>
                      )}
                    </div>
                  </div>
                  {primaryConnection?.connected && (
                    <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
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
                    </div>
                  )}
                </div>
                {primaryConnection?.connected ? (
                  <button
                    onClick={handleContinue}
                    className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <span>Continue</span>
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
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={primaryInfo.connectHandler}
                    disabled={
                      connectingProvider === primaryProvider ||
                      loadingConnections
                    }
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                  >
                    {connectingProvider === primaryProvider ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>Connect {primaryInfo.name}</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Secondary Connection Card - Optional */}
            <div className="mb-8">
              <p className="text-xs text-gray-500 text-center mb-3">
                Or connect another email service (optional)
              </p>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center">
                      {secondaryInfo.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {secondaryInfo.name}
                      </h4>
                      {loadingConnections ? (
                        <p className="text-xs text-gray-500">Checking...</p>
                      ) : secondaryConnection?.connected ? (
                        <p className="text-xs text-green-600 font-medium">
                          Connected: {secondaryConnection.email}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">Optional</p>
                      )}
                    </div>
                  </div>
                  {secondaryConnection?.connected && (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
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
                    </div>
                  )}
                </div>
                {secondaryConnection?.connected ? (
                  <button
                    onClick={handleContinue}
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <span>Continue</span>
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
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={secondaryInfo.connectHandler}
                    disabled={
                      connectingProvider === secondaryProvider ||
                      loadingConnections
                    }
                    className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                  >
                    {connectingProvider === secondaryProvider ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>Connect {secondaryInfo.name}</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-3 mb-6 pt-2 border-t border-gray-200">
          <button
            onClick={handleBackStep}
            disabled={isFirstStep}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isFirstStep
                ? "text-gray-400 cursor-not-allowed bg-gray-100"
                : "text-gray-700 hover:bg-gray-100"
            }`}
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

          <button
            onClick={handleNextStep}
            disabled={isLastNavigableStep}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isLastNavigableStep
                ? "text-gray-400 cursor-not-allowed bg-gray-100"
                : "text-blue-600 hover:bg-blue-50"
            }`}
          >
            <span>Next</span>
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Skip Button - Only show on email step */}
        {((navigationStep === 3 && !isWindows) ||
          (navigationStep === 2 && isWindows)) && (
          <div className="text-center">
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700 py-2 text-sm font-medium transition-colors"
            >
              Skip for Now
            </button>
            <p className="text-xs text-gray-500 mt-1">
              You can always connect your email later in Settings
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmailOnboardingScreen;
