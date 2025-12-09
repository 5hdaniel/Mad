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

  // Handle auth state changes to update navigation
  useEffect(() => {
    if (!isAuthLoading && !isCheckingSecureStorage) {
      // PRE-DB FLOW: OAuth succeeded but database not initialized yet
      if (pendingOAuthData && !isAuthenticated) {
        const isNewUser = !pendingOAuthData.cloudUser.terms_accepted_at;

        // Step 1: New users must accept terms first (shows as modal)
        if (isNewUser && !pendingOnboardingData.termsAccepted) {
          setShowTermsModal(true);
          setCurrentStep("phone-type-selection");
          return;
        }

        // Step 2: Phone type selection (separate screen)
        if (!pendingOnboardingData.phoneType) {
          setShowTermsModal(false);
          setCurrentStep("phone-type-selection");
          return;
        }

        // Step 3: Email onboarding (after phone type is selected)
        if (!pendingOnboardingData.emailConnected) {
          if (currentStep !== "phone-type-selection") {
            setShowTermsModal(false);
            setCurrentStep("email-onboarding");
          }
          return;
        }

        // Step 4: All pre-DB onboarding complete - now initialize database
        if (
          isMacOS &&
          currentStep !== "email-onboarding" &&
          currentStep !== "phone-type-selection"
        ) {
          setCurrentStep("keychain-explanation");
        }
        return;
      }

      // POST-DB FLOW: Database initialized, user authenticated
      if (isAuthenticated && !needsTermsAcceptance) {
        if (!isCheckingEmailOnboarding && !isLoadingPhoneType) {
          if (!hasSelectedPhoneType && !needsDriverSetup) {
            setCurrentStep("phone-type-selection");
          } else if (needsDriverSetup && isWindows) {
            setCurrentStep("apple-driver-setup");
          } else if (!hasCompletedEmailOnboarding || !hasEmailConnected) {
            setCurrentStep("email-onboarding");
          } else if (hasPermissions) {
            setCurrentStep("dashboard");
          } else {
            setCurrentStep("permissions");
          }
        }
      } else if (!isAuthenticated && !pendingOAuthData) {
        setCurrentStep("login");
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
      if (isWindows) {
        setCurrentStep("apple-driver-setup");
      } else {
        setCurrentStep("email-onboarding");
      }
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

  const handleAppleDriverSetupComplete = (): void => {
    setNeedsDriverSetup(false);
    setHasSelectedPhoneType(true);
    setCurrentStep("email-onboarding");
  };

  const handleAppleDriverSetupSkip = (): void => {
    setNeedsDriverSetup(false);
    setHasSelectedPhoneType(true);
    setCurrentStep("email-onboarding");
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
      }
      return;
    }

    await completeEmailOnboarding();
    setHasEmailConnected(true);
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
        emailConnected: true,
      }));
      if (isMacOS) {
        setCurrentStep("keychain-explanation");
      }
      return;
    }

    await completeEmailOnboarding();
    if (hasPermissions) {
      setCurrentStep("dashboard");
    } else {
      setCurrentStep("permissions");
    }
  };

  const handleEmailOnboardingBack = (): void => {
    setCurrentStep("phone-type-selection");
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
