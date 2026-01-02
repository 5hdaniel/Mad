/**
 * useNavigationFlow Hook
 *
 * Manages navigation state and step transitions.
 * Contains the complex navigation effects that determine which step to show.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { AppStep, PendingOnboardingData } from "../types";
import type { PendingOAuthData } from "../../../components/Login";

export interface UseNavigationFlowOptions {
  // Auth state
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  needsTermsAcceptance: boolean;

  // Platform
  isMacOS: boolean;
  isWindows: boolean;

  // Pending data
  pendingOAuthData: PendingOAuthData | null;
  pendingOnboardingData: PendingOnboardingData;

  // Storage state
  isCheckingSecureStorage: boolean;
  isDatabaseInitialized: boolean;
  isInitializingDatabase: boolean;
  initializeSecureStorage: (dontShowAgain: boolean) => Promise<boolean>;

  // Onboarding state
  hasSelectedPhoneType: boolean;
  isLoadingPhoneType: boolean;
  needsDriverSetup: boolean;
  hasCompletedEmailOnboarding: boolean;
  hasEmailConnected: boolean;
  isCheckingEmailOnboarding: boolean;

  // Permissions
  hasPermissions: boolean;

  // Modal state (for terms modal control)
  showTermsModal: boolean;
  onSetShowTermsModal: (show: boolean) => void;
}

export interface UseNavigationFlowReturn {
  // State
  currentStep: AppStep;
  showSetupPromptDismissed: boolean;
  isTourActive: boolean;

  // Setters
  setCurrentStep: (step: AppStep) => void;
  setIsTourActive: (active: boolean) => void;

  // Navigation methods
  goToStep: (step: AppStep) => void;
  goToEmailOnboarding: () => void;

  // Handlers
  handleDismissSetupPrompt: () => void;

  // Utility
  getPageTitle: () => string;
}

export function useNavigationFlow({
  isAuthenticated,
  isAuthLoading,
  needsTermsAcceptance,
  isMacOS,
  isWindows,
  pendingOAuthData,
  pendingOnboardingData,
  isCheckingSecureStorage,
  isDatabaseInitialized,
  isInitializingDatabase,
  initializeSecureStorage,
  hasSelectedPhoneType,
  isLoadingPhoneType,
  needsDriverSetup,
  hasCompletedEmailOnboarding,
  hasEmailConnected,
  isCheckingEmailOnboarding,
  hasPermissions,
  showTermsModal,
  onSetShowTermsModal,
}: UseNavigationFlowOptions): UseNavigationFlowReturn {
  const [currentStep, setCurrentStep] = useState<AppStep>("loading");
  const [showSetupPromptDismissed, setShowSetupPromptDismissed] =
    useState<boolean>(false);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);

  // Auto-initialize database for returning Windows users (no keychain UI needed)
  // On macOS, users see keychain-explanation screen which triggers init on Continue.
  // On Windows, returning users skip all pre-DB onboarding, so we auto-init here.
  useEffect(() => {
    const isReturningUser =
      pendingOAuthData && !!pendingOAuthData.cloudUser.terms_accepted_at;

    if (
      isWindows &&
      pendingOAuthData &&
      !isAuthenticated &&
      isReturningUser &&
      !isDatabaseInitialized &&
      !isInitializingDatabase &&
      currentStep === "loading"
    ) {
      initializeSecureStorage(true);
    }
  }, [
    isWindows,
    pendingOAuthData,
    isAuthenticated,
    isDatabaseInitialized,
    isInitializingDatabase,
    currentStep,
    initializeSecureStorage,
  ]);

  // Handle auth state changes to update navigation
  // IMPORTANT: Guards prevent infinite loops by only updating state when values differ
  useEffect(() => {
    // Wait for ALL loading to complete before making routing decisions
    // This prevents race conditions where routing happens before user data loads
    // CRITICAL: Include isDatabaseInitialized to prevent navigation to dashboard
    // before database is ready (fixes "Database is not initialized" error)
    const isStillLoading =
      isAuthLoading ||
      isCheckingSecureStorage ||
      isLoadingPhoneType ||
      isCheckingEmailOnboarding ||
      (isAuthenticated && !isDatabaseInitialized);

    if (!isAuthLoading && !isCheckingSecureStorage) {
      // PRE-DB FLOW: OAuth succeeded but database not initialized yet
      if (pendingOAuthData && !isAuthenticated) {
        const isNewUser = !pendingOAuthData.cloudUser.terms_accepted_at;

        // RETURNING USERS: Skip pre-DB onboarding, go straight to DB initialization
        // Their phone type and email settings are in the local database
        if (!isNewUser) {
          if (isMacOS) {
            if (currentStep !== "keychain-explanation") {
              setCurrentStep("keychain-explanation");
            }
          } else {
            // Windows: Initialize database directly (no keychain setup needed)
            // The useSecureStorage hook will handle this
            if (currentStep !== "loading") {
              setCurrentStep("loading");
            }
          }
          return;
        }

        // NEW USERS ONLY: Go through full pre-DB onboarding flow

        // Step 1: New users must accept terms first (shows as modal)
        if (!pendingOnboardingData.termsAccepted) {
          if (!showTermsModal) onSetShowTermsModal(true);
          if (currentStep !== "phone-type-selection")
            setCurrentStep("phone-type-selection");
          return;
        }

        // Step 2: Phone type selection (separate screen)
        if (!pendingOnboardingData.phoneType) {
          if (showTermsModal) onSetShowTermsModal(false);
          if (currentStep !== "phone-type-selection")
            setCurrentStep("phone-type-selection");
          return;
        }

        // Step 3: Email onboarding (after phone type is selected)
        if (!pendingOnboardingData.emailConnected) {
          if (currentStep !== "phone-type-selection") {
            if (showTermsModal) onSetShowTermsModal(false);
            if (currentStep !== "email-onboarding")
              setCurrentStep("email-onboarding");
          }
          return;
        }

        // Step 4: All pre-DB onboarding complete - now initialize database
        if (
          isMacOS &&
          currentStep !== "email-onboarding" &&
          currentStep !== "phone-type-selection" &&
          currentStep !== "keychain-explanation"
        ) {
          setCurrentStep("keychain-explanation");
        }
        return;
      }

      // POST-DB FLOW: Database initialized, user authenticated
      if (isAuthenticated && !needsTermsAcceptance) {
        // Special case: Returning user just completed login via keychain-explanation
        // They need to transition to the appropriate next step (dashboard/permissions)
        // This is NOT part of OnboardingFlow, so we handle it explicitly
        if (currentStep === "keychain-explanation") {
          // Returning users go straight to dashboard or permissions
          const needsPermissions = isMacOS && !hasPermissions;
          if (needsPermissions) {
            setCurrentStep("permissions");
          } else {
            setCurrentStep("dashboard");
          }
          return;
        }

        // Onboarding steps handled by the new OnboardingFlow - don't interfere
        const onboardingSteps = [
          "phone-type-selection",
          "email-onboarding",
          "apple-driver-setup",
          "android-coming-soon",
          "permissions",
        ];

        if (onboardingSteps.includes(currentStep)) {
          // New OnboardingFlow handles all navigation within onboarding
          return;
        }

        // Wait for user data to load before routing to onboarding
        // This prevents showing wrong screens before we know what the user needs
        if (isStillLoading) {
          return;
        }

        // Check what's missing to determine the right starting point
        // Note: hasCompletedEmailOnboarding means user finished the email step (connected OR skipped)
        const needsPhoneSelection = !hasSelectedPhoneType;
        // User needs email onboarding if: not completed AND not already connected
        // (connected users don't need to see the email step even if flag isn't set)
        const needsEmailOnboarding =
          !hasCompletedEmailOnboarding && !hasEmailConnected;
        const needsDrivers = isWindows && needsDriverSetup;
        const needsPermissions = isMacOS && !hasPermissions;

        // Route to the first incomplete step
        if (needsPhoneSelection) {
          // New user - start from phone selection
          if (currentStep !== "phone-type-selection") {
            setCurrentStep("phone-type-selection");
          }
        } else if (needsEmailOnboarding) {
          // Returning user who hasn't completed email step
          if (currentStep !== "email-onboarding") {
            setCurrentStep("email-onboarding");
          }
        } else if (needsDrivers) {
          // Returning user who needs driver setup (Windows + iPhone)
          if (currentStep !== "apple-driver-setup") {
            setCurrentStep("apple-driver-setup");
          }
        } else if (needsPermissions) {
          // Returning user who only needs permissions (macOS)
          if (currentStep !== "permissions") {
            setCurrentStep("permissions");
          }
        } else if (currentStep !== "dashboard") {
          // Everything complete - go to dashboard
          setCurrentStep("dashboard");
        }
      } else if (!isAuthenticated && !pendingOAuthData) {
        if (currentStep !== "login") setCurrentStep("login");
      }
    }
  }, [
    isAuthenticated,
    isAuthLoading,
    isDatabaseInitialized,
    needsTermsAcceptance,
    hasPermissions,
    hasCompletedEmailOnboarding,
    hasEmailConnected,
    isCheckingEmailOnboarding,
    isCheckingSecureStorage,
    pendingOAuthData,
    pendingOnboardingData,
    hasSelectedPhoneType,
    isLoadingPhoneType,
    needsDriverSetup,
    isWindows,
    isMacOS,
    currentStep,
    showTermsModal,
    onSetShowTermsModal,
  ]);

  // Windows: Skip permissions screen automatically
  useEffect(() => {
    if (isWindows && currentStep === "permissions") {
      setCurrentStep("dashboard");
    }
  }, [isWindows, currentStep]);

  const goToStep = useCallback((step: AppStep) => setCurrentStep(step), []);
  const goToEmailOnboarding = useCallback(
    () => setCurrentStep("email-onboarding"),
    [],
  );

  const handleDismissSetupPrompt = useCallback((): void => {
    setShowSetupPromptDismissed(true);
  }, []);

  const getPageTitle = useCallback((): string => {
    switch (currentStep) {
      case "login":
        return "Welcome";
      case "email-onboarding":
        return "Connect Email";
      case "microsoft-login":
        return "Login";
      case "permissions":
        return "Setup Permissions";
      case "dashboard":
        return "Magic Audit";
      case "contacts":
        return "Select Contacts for Export";
      case "outlook":
        return "Export to Outlook";
      case "complete":
        return "Export Complete";
      default:
        return "Magic Audit";
    }
  }, [currentStep]);

  return useMemo(
    () => ({
      currentStep,
      showSetupPromptDismissed,
      isTourActive,
      setCurrentStep,
      setIsTourActive,
      goToStep,
      goToEmailOnboarding,
      handleDismissSetupPrompt,
      getPageTitle,
    }),
    [
      currentStep,
      showSetupPromptDismissed,
      isTourActive,
      goToStep,
      goToEmailOnboarding,
      handleDismissSetupPrompt,
      getPageTitle,
    ],
  );
}
