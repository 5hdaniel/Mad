// TODO: This is a staging area (~600 lines). As the product grows,
// break this down into feature-focused flows:
// - useAuthFlow.ts (login, pending OAuth, logout)
// - useSecureStorageFlow.ts (key store + DB init)
// - usePhoneOnboardingFlow.ts (phone type + drivers)
// - useEmailOnboardingFlow.ts (email onboarding + tokens)
// - usePermissionsFlow.ts (macOS permissions)

/**
 * useAppStateMachine Hook
 *
 * Central state machine for the application.
 * Orchestrates all application state, navigation, and business logic.
 * Uses specialized flow hooks for domain-specific state management.
 *
 * Returns a typed AppStateMachine interface with:
 * - Read-only state properties
 * - Semantic transition methods (openProfile, closeProfile, etc.)
 * - Handler methods for complex operations
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth, useNetwork, usePlatform } from "../../contexts";
import { useSecureStorage } from "./flows/useSecureStorage";
import { useEmailOnboardingApi } from "./flows/useEmailOnboardingApi";
import { usePhoneTypeApi } from "./flows/usePhoneTypeApi";
import type {
  AppStep,
  AppExportResult,
  PendingOnboardingData,
  PendingEmailTokens,
  Conversation,
  Subscription,
  AppStateMachine,
} from "./types";
import type { PendingOAuthData } from "../../components/Login";

// Default pending onboarding state
const DEFAULT_PENDING_ONBOARDING: PendingOnboardingData = {
  termsAccepted: false,
  phoneType: null,
  emailConnected: false,
  emailProvider: null,
};

export function useAppStateMachine(): AppStateMachine {
  // ============================================
  // CONTEXT HOOKS
  // ============================================
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    currentUser,
    sessionToken,
    authProvider,
    subscription,
    needsTermsAcceptance,
    login,
    logout,
    acceptTerms,
    declineTerms,
  } = useAuth();

  const {
    isOnline,
    isChecking,
    connectionError,
    checkConnection,
    setConnectionError,
  } = useNetwork();

  const { isMacOS, isWindows } = usePlatform();

  // ============================================
  // LOCAL STATE
  // ============================================
  const [currentStep, setCurrentStep] = useState<AppStep>("loading");
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [outlookConnected, setOutlookConnected] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<AppExportResult | null>(
    null,
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<
    Set<string>
  >(new Set());
  const [isNewUserFlow, setIsNewUserFlow] = useState<boolean>(false);
  const [pendingOAuthData, setPendingOAuthData] =
    useState<PendingOAuthData | null>(null);
  const [pendingOnboardingData, setPendingOnboardingData] =
    useState<PendingOnboardingData>(DEFAULT_PENDING_ONBOARDING);
  const [pendingEmailTokens, setPendingEmailTokens] =
    useState<PendingEmailTokens | null>(null);
  const [showSetupPromptDismissed, setShowSetupPromptDismissed] =
    useState<boolean>(false);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [appPath, setAppPath] = useState<string>("");

  // Modal state
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showTransactions, setShowTransactions] = useState<boolean>(false);
  const [showContacts, setShowContacts] = useState<boolean>(false);
  const [showAuditTransaction, setShowAuditTransaction] =
    useState<boolean>(false);
  const [showVersion, setShowVersion] = useState<boolean>(false);
  const [showMoveAppPrompt, setShowMoveAppPrompt] = useState<boolean>(false);
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [showIPhoneSync, setShowIPhoneSync] = useState<boolean>(false);

  // ============================================
  // FLOW HOOKS
  // ============================================
  const {
    hasCompletedEmailOnboarding,
    hasEmailConnected,
    isCheckingEmailOnboarding,
    setHasCompletedEmailOnboarding,
    setHasEmailConnected,
    completeEmailOnboarding,
  } = useEmailOnboardingApi({ userId: currentUser?.id });

  const {
    hasSelectedPhoneType,
    selectedPhoneType,
    isLoadingPhoneType,
    needsDriverSetup,
    setHasSelectedPhoneType,
    setSelectedPhoneType,
    setNeedsDriverSetup,
    savePhoneType,
  } = usePhoneTypeApi({ userId: currentUser?.id, isWindows });

  const {
    hasSecureStorageSetup,
    isCheckingSecureStorage,
    isDatabaseInitialized,
    isInitializingDatabase,
    skipKeychainExplanation,
    initializeSecureStorage,
  } = useSecureStorage({
    isWindows,
    isMacOS,
    pendingOAuthData,
    pendingOnboardingData,
    pendingEmailTokens,
    isAuthenticated,
    login,
    onPendingOAuthClear: () => setPendingOAuthData(null),
    onPendingOnboardingClear: () =>
      setPendingOnboardingData(DEFAULT_PENDING_ONBOARDING),
    onPendingEmailTokensClear: () => setPendingEmailTokens(null),
    onPhoneTypeSet: setHasSelectedPhoneType,
    onEmailOnboardingComplete: (completed, connected) => {
      setHasCompletedEmailOnboarding(completed);
      setHasEmailConnected(connected);
    },
    onNewUserFlowSet: setIsNewUserFlow,
    onNeedsDriverSetup: setNeedsDriverSetup,
  });

  // ============================================
  // NAVIGATION EFFECTS
  // ============================================

  // Auto-initialize database for returning Windows users (no keychain UI needed)
  // On macOS, users see keychain-explanation screen which triggers init on Continue.
  // On Windows, returning users skip all pre-DB onboarding, so we auto-init here.
  useEffect(() => {
    const isReturningUser = pendingOAuthData && !!pendingOAuthData.cloudUser.terms_accepted_at;

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
  }, [isWindows, pendingOAuthData, isAuthenticated, isDatabaseInitialized, isInitializingDatabase, currentStep, initializeSecureStorage]);

  // Handle auth state changes to update navigation
  // IMPORTANT: Guards prevent infinite loops by only updating state when values differ
  useEffect(() => {
    // Wait for ALL loading to complete before making routing decisions
    // This prevents race conditions where routing happens before user data loads
    const isStillLoading = isAuthLoading || isCheckingSecureStorage || isLoadingPhoneType || isCheckingEmailOnboarding;

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
          if (!showTermsModal) setShowTermsModal(true);
          if (currentStep !== "phone-type-selection")
            setCurrentStep("phone-type-selection");
          return;
        }

        // Step 2: Phone type selection (separate screen)
        if (!pendingOnboardingData.phoneType) {
          if (showTermsModal) setShowTermsModal(false);
          if (currentStep !== "phone-type-selection")
            setCurrentStep("phone-type-selection");
          return;
        }

        // Step 3: Email onboarding (after phone type is selected)
        if (!pendingOnboardingData.emailConnected) {
          if (currentStep !== "phone-type-selection") {
            if (showTermsModal) setShowTermsModal(false);
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
        // Onboarding steps handled by the new OnboardingFlow - don't interfere
        const onboardingSteps = [
          "phone-type-selection",
          "email-onboarding",
          "apple-driver-setup",
          "android-coming-soon",
          "keychain-explanation",
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
        const needsEmailOnboarding = !hasCompletedEmailOnboarding && !hasEmailConnected;
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
  ]);

  // Initial permission and app location check
  useEffect(() => {
    checkPermissions();
    checkAppLocation();
  }, []);

  // Windows: Skip permissions screen automatically
  useEffect(() => {
    if (isWindows && currentStep === "permissions") {
      setCurrentStep("dashboard");
    }
  }, [isWindows, currentStep]);

  // ============================================
  // PERMISSION HANDLERS
  // ============================================
  const checkPermissions = async (): Promise<void> => {
    if (isWindows) {
      setHasPermissions(true);
      return;
    }
    const result = await window.electron.checkPermissions();
    if (result.hasPermission) {
      setHasPermissions(true);
    }
  };

  const checkAppLocation = async (): Promise<void> => {
    try {
      const result = await window.electron.checkAppLocation();
      setAppPath(result.appPath || "");
      const hasIgnored = localStorage.getItem("ignoreMoveAppPrompt");
      if (result.shouldPrompt && !hasIgnored) {
        setShowMoveAppPrompt(true);
      }
    } catch (error) {
      console.error("[useAppStateMachine] Error checking app location:", error);
    }
  };

  // ============================================
  // AUTH HANDLERS
  // ============================================
  const handleLoginSuccess = (
    user: {
      id: string;
      email: string;
      display_name?: string;
      avatar_url?: string;
    },
    token: string,
    provider: string,
    subscriptionData: Subscription | undefined,
    isNewUser: boolean,
  ): void => {
    setIsNewUserFlow(isNewUser);
    setPendingOAuthData(null);
    login(user, token, provider, subscriptionData, isNewUser);
  };

  const handleLoginPending = (oauthData: PendingOAuthData): void => {
    setPendingOAuthData(oauthData);
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    setShowProfile(false);
    setIsNewUserFlow(false);
    setHasSelectedPhoneType(false);
    setSelectedPhoneType(null);
    setCurrentStep("login");
  };

  // ============================================
  // TERMS HANDLERS
  // ============================================
  const handleAcceptTerms = async (): Promise<void> => {
    try {
      if (pendingOAuthData && !isAuthenticated) {
        const authApi = window.api.auth as typeof window.api.auth & {
          acceptTermsToSupabase: (userId: string) => Promise<{
            success: boolean;
            error?: string;
          }>;
        };
        const result = await authApi.acceptTermsToSupabase(
          pendingOAuthData.cloudUser.id,
        );
        if (result.success) {
          setPendingOnboardingData((prev) => ({
            ...prev,
            termsAccepted: true,
          }));
          setShowTermsModal(false);
        } else {
          console.error(
            "[useAppStateMachine] Failed to save terms to Supabase:",
            result.error,
          );
        }
        return;
      }
      await acceptTerms();
    } catch (error) {
      console.error("[useAppStateMachine] Failed to accept terms:", error);
    }
  };

  const handleDeclineTerms = async (): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOAuthData(null);
      setPendingOnboardingData(DEFAULT_PENDING_ONBOARDING);
      setShowTermsModal(false);
      setCurrentStep("login");
      return;
    }
    await declineTerms();
  };

  // ============================================
  // PHONE TYPE HANDLERS
  // ============================================
  const handleSelectIPhone = async (): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      setSelectedPhoneType("iphone");
      setPendingOnboardingData((prev) => ({ ...prev, phoneType: "iphone" }));
      setCurrentStep("email-onboarding");
      return;
    }

    if (!currentUser?.id) return;

    const success = await savePhoneType("iphone");
    if (success) {
      setHasSelectedPhoneType(true);
      // Windows flow: Phone Type → Email → Driver Setup → Dashboard
      // macOS flow: Phone Type → Email → Permissions → Dashboard
      // Both start with email onboarding after phone type
      setCurrentStep("email-onboarding");
    }
  };

  const handleSelectAndroid = (): void => {
    setSelectedPhoneType("android");
    setCurrentStep("android-coming-soon");
  };

  const handleAndroidGoBack = (): void => {
    setSelectedPhoneType(null);
    setPendingOnboardingData((prev) => ({ ...prev, phoneType: null }));
    setCurrentStep("phone-type-selection");
  };

  const handleAndroidContinueWithEmail = async (): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOnboardingData((prev) => ({ ...prev, phoneType: "android" }));
      setCurrentStep("email-onboarding");
      return;
    }

    if (!currentUser?.id) return;

    const success = await savePhoneType("android");
    if (success) {
      setHasSelectedPhoneType(true);
      setCurrentStep("email-onboarding");
    }
  };

  const handlePhoneTypeChange = async (
    phoneType: "iphone" | "android",
  ): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      setSelectedPhoneType(phoneType);
      setPendingOnboardingData((prev) => ({ ...prev, phoneType }));
      return;
    }

    if (!currentUser?.id) return;
    await savePhoneType(phoneType);
  };

  const handleAppleDriverSetupComplete = async (): Promise<void> => {
    // Mark all onboarding as complete - driver setup is the final step on Windows
    setNeedsDriverSetup(false);
    setHasSelectedPhoneType(true);
    setHasCompletedEmailOnboarding(true);
    // hasEmailConnected should already be true from email step

    // On Windows, driver setup is the last step - now navigate to dashboard
    if (pendingOAuthData && !isAuthenticated) {
      // Pre-DB flow: need to initialize database before going to dashboard
      try {
        await window.api.auth.completePendingLogin(pendingOAuthData);
      } catch (error) {
        console.error("[handleAppleDriverSetupComplete] Failed to complete pending login:", error);
      }
    }
    // Navigation to dashboard is handled by the onboarding flow hook's onComplete callback
  };

  const handleAppleDriverSetupSkip = async (): Promise<void> => {
    // Mark all onboarding as complete - even if skipped, we're done with onboarding on Windows
    setNeedsDriverSetup(false);
    setHasSelectedPhoneType(true);
    setHasCompletedEmailOnboarding(true);

    // Same logic as complete - driver setup is the last onboarding step on Windows
    if (pendingOAuthData && !isAuthenticated) {
      try {
        await window.api.auth.completePendingLogin(pendingOAuthData);
      } catch (error) {
        console.error("[handleAppleDriverSetupSkip] Failed to complete pending login:", error);
      }
    }
    // Note: Don't call setCurrentStep here - let the onboarding flow hook handle navigation
  };

  // ============================================
  // EMAIL ONBOARDING HANDLERS
  // ============================================
  const handleEmailOnboardingComplete = async (
    emailTokens?: PendingEmailTokens,
  ): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      if (emailTokens) {
        setPendingEmailTokens(emailTokens);
      }
      setPendingOnboardingData((prev) => ({
        ...prev,
        emailConnected: !!emailTokens,
        emailProvider: emailTokens?.provider || null,
      }));
      if (isMacOS) {
        setCurrentStep("keychain-explanation");
      } else if (isWindows) {
        // On Windows, go to Apple driver setup for iPhone users
        setCurrentStep("apple-driver-setup");
      }
      return;
    }

    await completeEmailOnboarding();
    setHasEmailConnected(true);

    // Windows iPhone users need driver setup after email onboarding
    if (isWindows && selectedPhoneType === "iphone" && needsDriverSetup) {
      setCurrentStep("apple-driver-setup");
      return;
    }

    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
    }
  };

  const handleEmailOnboardingSkip = async (): Promise<void> => {
    if (pendingOAuthData && !isAuthenticated) {
      setPendingOnboardingData((prev) => ({
        ...prev,
        emailConnected: false, // Skipped, not connected
      }));
      if (isMacOS) {
        setCurrentStep("keychain-explanation");
      } else if (isWindows) {
        // On Windows, go to Apple driver setup for iPhone users
        setCurrentStep("apple-driver-setup");
      }
      return;
    }

    await completeEmailOnboarding();

    // Windows iPhone users need driver setup after email onboarding
    if (isWindows && selectedPhoneType === "iphone" && needsDriverSetup) {
      setCurrentStep("apple-driver-setup");
      return;
    }

    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
    }
  };

  const handleEmailOnboardingBack = (): void => {
    setCurrentStep("phone-type-selection");
  };

  /**
   * Start Google OAuth flow for email connection.
   * Handles both pre-DB (pending) and post-DB flows.
   * Sets up IPC listeners to update state when OAuth completes.
   */
  const handleStartGoogleEmailConnect = async (): Promise<void> => {
    const usePendingApi = pendingOAuthData && !isAuthenticated;
    const emailHint = pendingOAuthData?.userInfo?.email || currentUser?.email;

    try {
      let result;
      let actuallyUsedPendingApi = usePendingApi;

      if (usePendingApi) {
        result = await window.api.auth.googleConnectMailboxPending(emailHint);
      } else if (currentUser?.id) {
        result = await window.api.auth.googleConnectMailbox(currentUser.id);
        // If regular API fails due to DB not initialized, fall back to pending API
        if (!result.success && result.error?.includes("Database is not initialized")) {
          actuallyUsedPendingApi = true;
          result = await window.api.auth.googleConnectMailboxPending(emailHint);
        }
      }

      if (!result?.success) {
        console.error("[AppStateMachine] Failed to start Google OAuth:", result?.error);
        return;
      }

      // Set up IPC listeners for OAuth completion
      if (actuallyUsedPendingApi) {
        const cleanup = window.api.onGoogleMailboxPendingConnected(
          (connectionResult: { success: boolean; email?: string; tokens?: PendingEmailTokens["tokens"]; error?: string }) => {
            if (connectionResult.success && connectionResult.email && connectionResult.tokens) {
              setPendingEmailTokens({
                provider: "google",
                email: connectionResult.email,
                tokens: connectionResult.tokens,
              });
              setHasEmailConnected(true);
              setPendingOnboardingData((prev) => ({
                ...prev,
                emailProvider: "google",
              }));
            }
            cleanup();
          }
        );
      } else {
        const cleanup = window.api.onGoogleMailboxConnected(
          (connectionResult: { success: boolean; email?: string; error?: string }) => {
            if (connectionResult.success) {
              setHasEmailConnected(true);
              // Also set email provider so EmailConnectStep shows as connected
              setPendingOnboardingData((prev) => ({
                ...prev,
                emailProvider: "google",
              }));
            }
            cleanup();
          }
        );
      }
    } catch (error) {
      console.error("[AppStateMachine] Error starting Google OAuth:", error);
    }
  };

  /**
   * Start Microsoft OAuth flow for email connection.
   * Handles both pre-DB (pending) and post-DB flows.
   * Sets up IPC listeners to update state when OAuth completes.
   */
  const handleStartMicrosoftEmailConnect = async (): Promise<void> => {
    const usePendingApi = pendingOAuthData && !isAuthenticated;
    const emailHint = pendingOAuthData?.userInfo?.email || currentUser?.email;

    try {
      let result;
      let actuallyUsedPendingApi = usePendingApi;

      if (usePendingApi) {
        result = await window.api.auth.microsoftConnectMailboxPending(emailHint);
      } else if (currentUser?.id) {
        result = await window.api.auth.microsoftConnectMailbox(currentUser.id);
        // If regular API fails due to DB not initialized, fall back to pending API
        if (!result.success && result.error?.includes("Database is not initialized")) {
          actuallyUsedPendingApi = true;
          result = await window.api.auth.microsoftConnectMailboxPending(emailHint);
        }
      }

      if (!result?.success) {
        console.error("[AppStateMachine] Failed to start Microsoft OAuth:", result?.error);
        return;
      }

      // Set up IPC listeners for OAuth completion
      if (actuallyUsedPendingApi) {
        const cleanup = window.api.onMicrosoftMailboxPendingConnected(
          (connectionResult: { success: boolean; email?: string; tokens?: PendingEmailTokens["tokens"]; error?: string }) => {
            if (connectionResult.success && connectionResult.email && connectionResult.tokens) {
              setPendingEmailTokens({
                provider: "microsoft",
                email: connectionResult.email,
                tokens: connectionResult.tokens,
              });
              setHasEmailConnected(true);
              setPendingOnboardingData((prev) => ({
                ...prev,
                emailProvider: "microsoft",
              }));
            }
            cleanup();
          }
        );
      } else {
        const cleanup = window.api.onMicrosoftMailboxConnected(
          (connectionResult: { success: boolean; email?: string; error?: string }) => {
            if (connectionResult.success) {
              setHasEmailConnected(true);
              // Also set email provider so EmailConnectStep shows as connected
              setPendingOnboardingData((prev) => ({
                ...prev,
                emailProvider: "microsoft",
              }));
            }
            cleanup();
          }
        );
      }
    } catch (error) {
      console.error("[AppStateMachine] Error starting Microsoft OAuth:", error);
    }
  };

  // ============================================
  // KEYCHAIN HANDLERS
  // ============================================
  const handleKeychainExplanationContinue = async (
    dontShowAgain: boolean,
  ): Promise<void> => {
    await initializeSecureStorage(dontShowAgain);
  };

  const handleKeychainBack = (): void => {
    setCurrentStep("email-onboarding");
  };

  // ============================================
  // PERMISSION HANDLERS
  // ============================================
  const handlePermissionsGranted = (): void => {
    setHasPermissions(true);
    setCurrentStep("dashboard");
  };

  // ============================================
  // EXPORT HANDLERS
  // ============================================
  const handleExportComplete = (result: unknown): void => {
    setExportResult(result as AppExportResult);
    setCurrentStep("complete");
  };

  const handleOutlookExport = async (
    selectedIds: Set<string>,
  ): Promise<void> => {
    if (conversations.length === 0) {
      const result = await window.electron.getConversations();
      if (result.success && result.conversations) {
        setConversations(result.conversations as Conversation[]);
      }
    }
    setSelectedConversationIds(selectedIds);
    setCurrentStep("outlook");
  };

  const handleOutlookCancel = (): void => {
    setCurrentStep("dashboard");
  };

  const handleStartOver = (): void => {
    setExportResult(null);
    setSelectedConversationIds(new Set());
    setCurrentStep("dashboard");
  };

  // ============================================
  // MICROSOFT HANDLERS
  // ============================================
  const handleMicrosoftLogin = (_userInfo: unknown): void => {
    setOutlookConnected(true);
    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
    }
  };

  const handleMicrosoftSkip = (): void => {
    setOutlookConnected(false);
    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
    }
  };

  const handleConnectOutlook = (): void => {
    setCurrentStep("microsoft-login");
  };

  // ============================================
  // NETWORK HANDLERS
  // ============================================
  const handleRetryConnection = useCallback(async () => {
    const online = await checkConnection();
    if (!online) {
      setConnectionError(
        "Unable to connect. Please check your internet connection.",
      );
    }
  }, [checkConnection, setConnectionError]);

  // ============================================
  // UI HANDLERS
  // ============================================
  const handleDismissSetupPrompt = (): void => {
    setShowSetupPromptDismissed(true);
  };

  const handleDismissMovePrompt = (): void => {
    setShowMoveAppPrompt(false);
  };

  const handleNotNowMovePrompt = (): void => {
    setShowMoveAppPrompt(false);
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  const getPageTitle = (): string => {
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
  };

  // ============================================
  // SEMANTIC MODAL METHODS
  // ============================================
  const openProfile = useCallback(() => setShowProfile(true), []);
  const closeProfile = useCallback(() => setShowProfile(false), []);

  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  const openTransactions = useCallback(() => setShowTransactions(true), []);
  const closeTransactions = useCallback(() => setShowTransactions(false), []);

  const openContacts = useCallback(() => setShowContacts(true), []);
  const closeContacts = useCallback(() => setShowContacts(false), []);

  const openAuditTransaction = useCallback(
    () => setShowAuditTransaction(true),
    [],
  );
  const closeAuditTransaction = useCallback(
    () => setShowAuditTransaction(false),
    [],
  );

  const toggleVersion = useCallback(() => setShowVersion((prev) => !prev), []);
  const closeVersion = useCallback(() => setShowVersion(false), []);

  const openTermsModal = useCallback(() => setShowTermsModal(true), []);
  const closeTermsModal = useCallback(() => setShowTermsModal(false), []);

  const openMoveAppPrompt = useCallback(() => setShowMoveAppPrompt(true), []);
  const closeMoveAppPrompt = useCallback(() => setShowMoveAppPrompt(false), []);

  const openIPhoneSync = useCallback(() => setShowIPhoneSync(true), []);
  const closeIPhoneSync = useCallback(() => setShowIPhoneSync(false), []);

  // ============================================
  // NAVIGATION METHODS
  // ============================================
  const goToStep = useCallback((step: AppStep) => setCurrentStep(step), []);
  const goToEmailOnboarding = useCallback(
    () => setCurrentStep("email-onboarding"),
    [],
  );

  // ============================================
  // MEMOIZED MODAL STATE
  // ============================================
  const modalState = useMemo(
    () => ({
      showProfile,
      showSettings,
      showTransactions,
      showContacts,
      showAuditTransaction,
      showVersion,
      showMoveAppPrompt,
      showTermsModal,
      showIPhoneSync,
    }),
    [
      showProfile,
      showSettings,
      showTransactions,
      showContacts,
      showAuditTransaction,
      showVersion,
      showMoveAppPrompt,
      showTermsModal,
      showIPhoneSync,
    ],
  );

  // ============================================
  // RETURN STATE MACHINE
  // ============================================
  return {
    // Navigation state
    currentStep,

    // Auth state
    isAuthenticated,
    isAuthLoading,
    currentUser,
    sessionToken,
    authProvider,
    subscription,
    needsTermsAcceptance,

    // Network state
    isOnline,
    isChecking,
    connectionError,

    // Platform state
    isMacOS,
    isWindows,

    // Permissions state
    hasPermissions,

    // Secure storage state
    hasSecureStorageSetup,
    isCheckingSecureStorage,
    isDatabaseInitialized,
    isInitializingDatabase,
    skipKeychainExplanation,

    // Email onboarding state
    hasCompletedEmailOnboarding,
    hasEmailConnected,
    isCheckingEmailOnboarding,

    // Phone type state
    hasSelectedPhoneType,
    selectedPhoneType,
    isLoadingPhoneType,
    needsDriverSetup,

    // New user flow state
    isNewUserFlow,

    // Pending data
    pendingOAuthData,
    pendingOnboardingData,
    pendingEmailTokens,

    // Export state
    exportResult,
    conversations,
    selectedConversationIds,
    outlookConnected,

    // Modal state (grouped)
    modalState,

    // UI state
    showSetupPromptDismissed,
    isTourActive,
    appPath,

    // Semantic modal transitions
    openProfile,
    closeProfile,
    openSettings,
    closeSettings,
    openTransactions,
    closeTransactions,
    openContacts,
    closeContacts,
    openAuditTransaction,
    closeAuditTransaction,
    toggleVersion,
    closeVersion,
    openTermsModal,
    closeTermsModal,
    openMoveAppPrompt,
    closeMoveAppPrompt,
    openIPhoneSync,
    closeIPhoneSync,

    // Navigation transitions
    goToStep,
    goToEmailOnboarding,

    // Auth handlers
    handleLoginSuccess,
    handleLoginPending,
    handleLogout,

    // Terms handlers
    handleAcceptTerms,
    handleDeclineTerms,

    // Phone type handlers
    handleSelectIPhone,
    handleSelectAndroid,
    handleAndroidGoBack,
    handleAndroidContinueWithEmail,
    handlePhoneTypeChange,
    handleAppleDriverSetupComplete,
    handleAppleDriverSetupSkip,

    // Email onboarding handlers
    handleEmailOnboardingComplete,
    handleEmailOnboardingSkip,
    handleEmailOnboardingBack,
    handleStartGoogleEmailConnect,
    handleStartMicrosoftEmailConnect,

    // Keychain handlers
    handleKeychainExplanationContinue,
    handleKeychainBack,

    // Permission handlers
    handlePermissionsGranted,
    checkPermissions,

    // Export handlers
    handleExportComplete,
    handleOutlookExport,
    handleOutlookCancel,
    handleStartOver,
    setExportResult,

    // Microsoft handlers
    handleMicrosoftLogin,
    handleMicrosoftSkip,
    handleConnectOutlook,

    // Network handlers
    handleRetryConnection,

    // UI handlers
    handleDismissSetupPrompt,
    setIsTourActive,
    handleDismissMovePrompt,
    handleNotNowMovePrompt,

    // Utility
    getPageTitle,
  };
}
