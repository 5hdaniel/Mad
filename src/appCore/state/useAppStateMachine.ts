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

import { useState, useCallback, useMemo } from "react";
import { useAuth, useNetwork, usePlatform } from "../../contexts";
import {
  useSecureStorage,
  useEmailOnboardingApi,
  usePhoneTypeApi,
  useModalFlow,
  useAuthFlow,
  usePermissionsFlow,
  useExportFlow,
  useNavigationFlow,
  useEmailHandlers,
  usePhoneHandlers,
  useKeychainHandlers,
} from "./flows";
import { useOptionalMachineState } from "./machine/hooks/useOptionalMachineState";
import type { AppStateMachine, PendingEmailTokens } from "./types";

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
  // STATE MACHINE (Optional - feature flagged)
  // ============================================
  const machineState = useOptionalMachineState();

  // ============================================
  // PENDING EMAIL TOKENS STATE
  // ============================================
  const [pendingEmailTokens, setPendingEmailTokens] =
    useState<PendingEmailTokens | null>(null);

  // ============================================
  // MODAL FLOW
  // ============================================
  const modal = useModalFlow();

  // ============================================
  // EMAIL ONBOARDING API (existing)
  // ============================================
  const emailOnboardingApi = useEmailOnboardingApi({ userId: currentUser?.id });

  // ============================================
  // PHONE TYPE API (existing)
  // ============================================
  const phoneTypeApi = usePhoneTypeApi({ userId: currentUser?.id, isWindows });

  // ============================================
  // AUTH FLOW
  // ============================================
  const auth = useAuthFlow({
    login,
    logout,
    acceptTerms,
    declineTerms,
    isAuthenticated,
    onCloseProfile: modal.closeProfile,
    onSetHasSelectedPhoneType: phoneTypeApi.setHasSelectedPhoneType,
    onSetSelectedPhoneType: phoneTypeApi.setSelectedPhoneType,
    onSetCurrentStep: (step) => nav.setCurrentStep(step),
    // Pass state machine dispatch for LOGIN_SUCCESS integration
    stateMachineDispatch: machineState?.dispatch,
    platform: { isMacOS, isWindows },
  });

  // ============================================
  // PERMISSIONS FLOW
  // ============================================
  const permissions = usePermissionsFlow({
    isWindows,
    onSetShowMoveAppPrompt: modal.setShowMoveAppPrompt,
    onSetCurrentStep: (step) => nav.setCurrentStep(step),
  });

  // ============================================
  // SECURE STORAGE (existing)
  // ============================================
  const secureStorage = useSecureStorage({
    isWindows,
    isMacOS,
    pendingOAuthData: auth.pendingOAuthData,
    pendingOnboardingData: auth.pendingOnboardingData,
    pendingEmailTokens,
    isAuthenticated,
    login,
    onPendingOAuthClear: () => auth.setPendingOAuthData(null),
    onPendingOnboardingClear: () =>
      auth.setPendingOnboardingData({
        termsAccepted: false,
        phoneType: null,
        emailConnected: false,
        emailProvider: null,
      }),
    onPendingEmailTokensClear: () => setPendingEmailTokens(null),
    onPhoneTypeSet: phoneTypeApi.setHasSelectedPhoneType,
    onEmailOnboardingComplete: (completed, connected) => {
      emailOnboardingApi.setHasCompletedEmailOnboarding(completed);
      emailOnboardingApi.setHasEmailConnected(connected);
    },
    onNewUserFlowSet: auth.setIsNewUserFlow,
    onNeedsDriverSetup: phoneTypeApi.setNeedsDriverSetup,
  });

  // ============================================
  // NAVIGATION FLOW
  // ============================================
  const nav = useNavigationFlow({
    isAuthenticated,
    isAuthLoading,
    needsTermsAcceptance,
    isMacOS,
    isWindows,
    pendingOAuthData: auth.pendingOAuthData,
    pendingOnboardingData: auth.pendingOnboardingData,
    isCheckingSecureStorage: secureStorage.isCheckingSecureStorage,
    isDatabaseInitialized: secureStorage.isDatabaseInitialized,
    isInitializingDatabase: secureStorage.isInitializingDatabase,
    initializeSecureStorage: secureStorage.initializeSecureStorage,
    hasSelectedPhoneType: phoneTypeApi.hasSelectedPhoneType,
    isLoadingPhoneType: phoneTypeApi.isLoadingPhoneType,
    needsDriverSetup: phoneTypeApi.needsDriverSetup,
    hasCompletedEmailOnboarding: emailOnboardingApi.hasCompletedEmailOnboarding,
    hasEmailConnected: emailOnboardingApi.hasEmailConnected,
    isCheckingEmailOnboarding: emailOnboardingApi.isCheckingEmailOnboarding,
    hasPermissions: permissions.hasPermissions,
    showTermsModal: modal.modalState.showTermsModal,
    onSetShowTermsModal: modal.setShowTermsModal,
  });

  // ============================================
  // EXPORT FLOW
  // ============================================
  const exportFlow = useExportFlow({
    onSetCurrentStep: nav.setCurrentStep,
    hasPermissions: permissions.hasPermissions,
  });

  // ============================================
  // EMAIL HANDLERS
  // ============================================
  const emailHandlers = useEmailHandlers({
    pendingOAuthData: auth.pendingOAuthData,
    isAuthenticated,
    currentUserId: currentUser?.id,
    currentUserEmail: currentUser?.email,
    isMacOS,
    isWindows,
    selectedPhoneType: phoneTypeApi.selectedPhoneType,
    needsDriverSetup: phoneTypeApi.needsDriverSetup,
    hasPermissions: permissions.hasPermissions,
    setPendingEmailTokens,
    setPendingOnboardingData: auth.setPendingOnboardingData,
    setHasEmailConnected: emailOnboardingApi.setHasEmailConnected,
    setCurrentStep: nav.setCurrentStep,
    completeEmailOnboarding: emailOnboardingApi.completeEmailOnboarding,
  });

  // ============================================
  // PHONE HANDLERS
  // ============================================
  const phoneHandlers = usePhoneHandlers({
    pendingOAuthData: auth.pendingOAuthData,
    isAuthenticated,
    currentUserId: currentUser?.id,
    isWindows,
    selectedPhoneType: phoneTypeApi.selectedPhoneType,
    setSelectedPhoneType: phoneTypeApi.setSelectedPhoneType,
    setHasSelectedPhoneType: phoneTypeApi.setHasSelectedPhoneType,
    setNeedsDriverSetup: phoneTypeApi.setNeedsDriverSetup,
    savePhoneType: phoneTypeApi.savePhoneType,
    setHasCompletedEmailOnboarding:
      emailOnboardingApi.setHasCompletedEmailOnboarding,
    setPendingOnboardingData: auth.setPendingOnboardingData,
    setCurrentStep: nav.setCurrentStep,
  });

  // ============================================
  // KEYCHAIN HANDLERS
  // ============================================
  const keychainHandlers = useKeychainHandlers({
    initializeSecureStorage: secureStorage.initializeSecureStorage,
    setCurrentStep: nav.setCurrentStep,
  });

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
  const handleDismissMovePrompt = useCallback((): void => {
    modal.closeMoveAppPrompt();
  }, [modal]);

  const handleNotNowMovePrompt = useCallback((): void => {
    modal.closeMoveAppPrompt();
  }, [modal]);

  // ============================================
  // RETURN STATE MACHINE
  // ============================================
  return useMemo<AppStateMachine>(
    () => ({
      // Navigation state
      currentStep: nav.currentStep,

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
      hasPermissions: permissions.hasPermissions,

      // Secure storage state
      hasSecureStorageSetup: secureStorage.hasSecureStorageSetup,
      isCheckingSecureStorage: secureStorage.isCheckingSecureStorage,
      isDatabaseInitialized: secureStorage.isDatabaseInitialized,
      isInitializingDatabase: secureStorage.isInitializingDatabase,
      skipKeychainExplanation: secureStorage.skipKeychainExplanation,

      // Email onboarding state
      hasCompletedEmailOnboarding:
        emailOnboardingApi.hasCompletedEmailOnboarding,
      hasEmailConnected: emailOnboardingApi.hasEmailConnected,
      isCheckingEmailOnboarding: emailOnboardingApi.isCheckingEmailOnboarding,

      // Phone type state
      hasSelectedPhoneType: phoneTypeApi.hasSelectedPhoneType,
      selectedPhoneType: phoneTypeApi.selectedPhoneType,
      isLoadingPhoneType: phoneTypeApi.isLoadingPhoneType,
      needsDriverSetup: phoneTypeApi.needsDriverSetup,

      // New user flow state
      isNewUserFlow: auth.isNewUserFlow,

      // Pending data
      pendingOAuthData: auth.pendingOAuthData,
      pendingOnboardingData: auth.pendingOnboardingData,
      pendingEmailTokens,

      // Export state
      exportResult: exportFlow.exportResult,
      conversations: exportFlow.conversations,
      selectedConversationIds: exportFlow.selectedConversationIds,
      outlookConnected: exportFlow.outlookConnected,

      // Modal state (grouped)
      modalState: modal.modalState,

      // UI state
      showSetupPromptDismissed: nav.showSetupPromptDismissed,
      isTourActive: nav.isTourActive,
      appPath: permissions.appPath,

      // Semantic modal transitions
      openProfile: modal.openProfile,
      closeProfile: modal.closeProfile,
      openSettings: modal.openSettings,
      closeSettings: modal.closeSettings,
      openTransactions: modal.openTransactions,
      closeTransactions: modal.closeTransactions,
      openContacts: modal.openContacts,
      closeContacts: modal.closeContacts,
      openAuditTransaction: modal.openAuditTransaction,
      closeAuditTransaction: modal.closeAuditTransaction,
      toggleVersion: modal.toggleVersion,
      closeVersion: modal.closeVersion,
      openTermsModal: modal.openTermsModal,
      closeTermsModal: modal.closeTermsModal,
      openMoveAppPrompt: modal.openMoveAppPrompt,
      closeMoveAppPrompt: modal.closeMoveAppPrompt,
      openIPhoneSync: modal.openIPhoneSync,
      closeIPhoneSync: modal.closeIPhoneSync,

      // Navigation transitions
      goToStep: nav.goToStep,
      goToEmailOnboarding: nav.goToEmailOnboarding,

      // Auth handlers
      handleLoginSuccess: auth.handleLoginSuccess,
      handleLoginPending: auth.handleLoginPending,
      handleLogout: auth.handleLogout,

      // Terms handlers
      handleAcceptTerms: auth.handleAcceptTerms,
      handleDeclineTerms: auth.handleDeclineTerms,

      // Phone type handlers
      handleSelectIPhone: phoneHandlers.handleSelectIPhone,
      handleSelectAndroid: phoneHandlers.handleSelectAndroid,
      handleAndroidGoBack: phoneHandlers.handleAndroidGoBack,
      handleAndroidContinueWithEmail:
        phoneHandlers.handleAndroidContinueWithEmail,
      handlePhoneTypeChange: phoneHandlers.handlePhoneTypeChange,
      handleAppleDriverSetupComplete:
        phoneHandlers.handleAppleDriverSetupComplete,
      handleAppleDriverSetupSkip: phoneHandlers.handleAppleDriverSetupSkip,

      // Email onboarding handlers
      handleEmailOnboardingComplete: emailHandlers.handleEmailOnboardingComplete,
      handleEmailOnboardingSkip: emailHandlers.handleEmailOnboardingSkip,
      handleEmailOnboardingBack: emailHandlers.handleEmailOnboardingBack,
      handleStartGoogleEmailConnect: emailHandlers.handleStartGoogleEmailConnect,
      handleStartMicrosoftEmailConnect:
        emailHandlers.handleStartMicrosoftEmailConnect,

      // Keychain handlers
      handleKeychainExplanationContinue:
        keychainHandlers.handleKeychainExplanationContinue,
      handleKeychainBack: keychainHandlers.handleKeychainBack,

      // Permission handlers
      handlePermissionsGranted: permissions.handlePermissionsGranted,
      checkPermissions: permissions.checkPermissions,

      // Export handlers
      handleExportComplete: exportFlow.handleExportComplete,
      handleOutlookExport: exportFlow.handleOutlookExport,
      handleOutlookCancel: exportFlow.handleOutlookCancel,
      handleStartOver: exportFlow.handleStartOver,
      setExportResult: exportFlow.setExportResult,

      // Microsoft handlers
      handleMicrosoftLogin: exportFlow.handleMicrosoftLogin,
      handleMicrosoftSkip: exportFlow.handleMicrosoftSkip,
      handleConnectOutlook: exportFlow.handleConnectOutlook,

      // Network handlers
      handleRetryConnection,

      // UI handlers
      handleDismissSetupPrompt: nav.handleDismissSetupPrompt,
      setIsTourActive: nav.setIsTourActive,
      handleDismissMovePrompt,
      handleNotNowMovePrompt,

      // Utility
      getPageTitle: nav.getPageTitle,
    }),
    [
      nav,
      isAuthenticated,
      isAuthLoading,
      currentUser,
      sessionToken,
      authProvider,
      subscription,
      needsTermsAcceptance,
      isOnline,
      isChecking,
      connectionError,
      isMacOS,
      isWindows,
      permissions,
      secureStorage,
      emailOnboardingApi,
      phoneTypeApi,
      auth,
      pendingEmailTokens,
      exportFlow,
      modal,
      phoneHandlers,
      emailHandlers,
      keychainHandlers,
      handleRetryConnection,
      handleDismissMovePrompt,
      handleNotNowMovePrompt,
    ],
  );
}
