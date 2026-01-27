/**
 * Return Helpers for useAppStateMachine
 *
 * Helper functions that construct portions of the AppStateMachine return object.
 * Extracted to reduce line count in the main hook while maintaining readability.
 */

import type {
  AppStateMachine,
  AppStep,
  AppUser,
  ModalState,
  PendingOAuthData,
  PendingOnboardingData,
  PendingEmailTokens,
  AppExportResult,
  Subscription,
  Conversation,
} from "./types";
import type { SyncStatus } from "../../hooks/useAutoRefresh";

// ============================================
// TYPE DEFINITIONS FOR FLOW RETURNS
// ============================================

interface ContextState {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  currentUser: AppUser | null;
  sessionToken: string | null;
  authProvider: string | null;
  subscription: Subscription | undefined;
  needsTermsAcceptance: boolean;
  isOnline: boolean;
  isChecking: boolean;
  connectionError: string | null;
  isMacOS: boolean;
  isWindows: boolean;
}

interface NavigationFlowReturn {
  currentStep: AppStep;
  showSetupPromptDismissed: boolean;
  isTourActive: boolean;
  goToStep: (step: AppStep) => void;
  goToEmailOnboarding: () => void;
  handleDismissSetupPrompt: () => void;
  setIsTourActive: (active: boolean) => void;
  getPageTitle: () => string;
}

interface PermissionsFlowReturn {
  hasPermissions: boolean;
  appPath: string;
  handlePermissionsGranted: () => void;
  checkPermissions: () => Promise<void>;
}

interface SecureStorageReturn {
  hasSecureStorageSetup: boolean;
  isCheckingSecureStorage: boolean;
  isDatabaseInitialized: boolean;
  isInitializingDatabase: boolean;
  skipKeychainExplanation: boolean;
}

interface EmailOnboardingApiReturn {
  hasCompletedEmailOnboarding: boolean;
  hasEmailConnected: boolean;
  isCheckingEmailOnboarding: boolean;
}

interface PhoneTypeApiReturn {
  hasSelectedPhoneType: boolean;
  selectedPhoneType: "iphone" | "android" | null;
  isLoadingPhoneType: boolean;
  needsDriverSetup: boolean;
}

interface AuthFlowReturn {
  isNewUserFlow: boolean;
  pendingOAuthData: PendingOAuthData | null;
  pendingOnboardingData: PendingOnboardingData;
  handleLoginSuccess: AppStateMachine["handleLoginSuccess"];
  handleLoginPending: AppStateMachine["handleLoginPending"];
  handleDeepLinkAuthSuccess: AppStateMachine["handleDeepLinkAuthSuccess"];
  handleLogout: AppStateMachine["handleLogout"];
  handleAcceptTerms: AppStateMachine["handleAcceptTerms"];
  handleDeclineTerms: AppStateMachine["handleDeclineTerms"];
}

interface ExportFlowReturn {
  exportResult: AppExportResult | null;
  conversations: Conversation[];
  selectedConversationIds: Set<string>;
  outlookConnected: boolean;
  handleExportComplete: AppStateMachine["handleExportComplete"];
  handleOutlookExport: AppStateMachine["handleOutlookExport"];
  handleOutlookCancel: AppStateMachine["handleOutlookCancel"];
  handleStartOver: AppStateMachine["handleStartOver"];
  setExportResult: AppStateMachine["setExportResult"];
  handleMicrosoftLogin: AppStateMachine["handleMicrosoftLogin"];
  handleMicrosoftSkip: AppStateMachine["handleMicrosoftSkip"];
  handleConnectOutlook: AppStateMachine["handleConnectOutlook"];
}

interface ModalFlowReturn {
  modalState: ModalState;
  openProfile: () => void;
  closeProfile: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openTransactions: () => void;
  closeTransactions: () => void;
  openContacts: () => void;
  closeContacts: () => void;
  openAuditTransaction: () => void;
  closeAuditTransaction: () => void;
  toggleVersion: () => void;
  closeVersion: () => void;
  openTermsModal: () => void;
  closeTermsModal: () => void;
  openMoveAppPrompt: () => void;
  closeMoveAppPrompt: () => void;
  openIPhoneSync: () => void;
  closeIPhoneSync: () => void;
}

interface PhoneHandlersReturn {
  handleSelectIPhone: AppStateMachine["handleSelectIPhone"];
  handleSelectAndroid: AppStateMachine["handleSelectAndroid"];
  handleAndroidGoBack: AppStateMachine["handleAndroidGoBack"];
  handleAndroidContinueWithEmail: AppStateMachine["handleAndroidContinueWithEmail"];
  handlePhoneTypeChange: AppStateMachine["handlePhoneTypeChange"];
  handleAppleDriverSetupComplete: AppStateMachine["handleAppleDriverSetupComplete"];
  handleAppleDriverSetupSkip: AppStateMachine["handleAppleDriverSetupSkip"];
}

interface EmailHandlersReturn {
  handleEmailOnboardingComplete: AppStateMachine["handleEmailOnboardingComplete"];
  handleEmailOnboardingSkip: AppStateMachine["handleEmailOnboardingSkip"];
  handleEmailOnboardingBack: AppStateMachine["handleEmailOnboardingBack"];
  handleStartGoogleEmailConnect: AppStateMachine["handleStartGoogleEmailConnect"];
  handleStartMicrosoftEmailConnect: AppStateMachine["handleStartMicrosoftEmailConnect"];
}

interface KeychainHandlersReturn {
  handleKeychainExplanationContinue: AppStateMachine["handleKeychainExplanationContinue"];
  handleKeychainBack: AppStateMachine["handleKeychainBack"];
}

interface AutoSyncReturn {
  syncStatus?: SyncStatus;
  isAnySyncing: boolean;
  currentSyncMessage: string | null;
  triggerRefresh: () => Promise<void>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Constructs the state properties portion of the return object.
 * Includes navigation, auth, network, platform, and feature-specific state.
 */
export function constructStateProps(
  context: ContextState,
  nav: NavigationFlowReturn,
  permissions: PermissionsFlowReturn,
  secureStorage: SecureStorageReturn,
  emailOnboardingApi: EmailOnboardingApiReturn,
  phoneTypeApi: PhoneTypeApiReturn,
  auth: Pick<AuthFlowReturn, "isNewUserFlow" | "pendingOAuthData" | "pendingOnboardingData">,
  pendingEmailTokens: PendingEmailTokens | null,
  exportFlow: Pick<ExportFlowReturn, "exportResult" | "conversations" | "selectedConversationIds" | "outlookConnected">,
  modal: Pick<ModalFlowReturn, "modalState">,
  autoSync: AutoSyncReturn,
): Pick<
  AppStateMachine,
  | "currentStep"
  | "isAuthenticated"
  | "isAuthLoading"
  | "currentUser"
  | "sessionToken"
  | "authProvider"
  | "subscription"
  | "needsTermsAcceptance"
  | "isOnline"
  | "isChecking"
  | "connectionError"
  | "isMacOS"
  | "isWindows"
  | "hasPermissions"
  | "hasSecureStorageSetup"
  | "isCheckingSecureStorage"
  | "isDatabaseInitialized"
  | "isInitializingDatabase"
  | "skipKeychainExplanation"
  | "hasCompletedEmailOnboarding"
  | "hasEmailConnected"
  | "isCheckingEmailOnboarding"
  | "hasSelectedPhoneType"
  | "selectedPhoneType"
  | "isLoadingPhoneType"
  | "needsDriverSetup"
  | "isNewUserFlow"
  | "pendingOAuthData"
  | "pendingOnboardingData"
  | "pendingEmailTokens"
  | "exportResult"
  | "conversations"
  | "selectedConversationIds"
  | "outlookConnected"
  | "modalState"
  | "showSetupPromptDismissed"
  | "isTourActive"
  | "appPath"
  | "syncStatus"
  | "isAnySyncing"
  | "currentSyncMessage"
  | "triggerRefresh"
> {
  return {
    // Navigation state
    currentStep: nav.currentStep,

    // Auth state
    isAuthenticated: context.isAuthenticated,
    isAuthLoading: context.isAuthLoading,
    currentUser: context.currentUser,
    sessionToken: context.sessionToken,
    authProvider: context.authProvider,
    subscription: context.subscription,
    needsTermsAcceptance: context.needsTermsAcceptance,

    // Network state
    isOnline: context.isOnline,
    isChecking: context.isChecking,
    connectionError: context.connectionError,

    // Platform state
    isMacOS: context.isMacOS,
    isWindows: context.isWindows,

    // Permissions state
    hasPermissions: permissions.hasPermissions,

    // Secure storage state
    hasSecureStorageSetup: secureStorage.hasSecureStorageSetup,
    isCheckingSecureStorage: secureStorage.isCheckingSecureStorage,
    isDatabaseInitialized: secureStorage.isDatabaseInitialized,
    isInitializingDatabase: secureStorage.isInitializingDatabase,
    skipKeychainExplanation: secureStorage.skipKeychainExplanation,

    // Email onboarding state
    hasCompletedEmailOnboarding: emailOnboardingApi.hasCompletedEmailOnboarding,
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

    // Modal state
    modalState: modal.modalState,

    // UI state
    showSetupPromptDismissed: nav.showSetupPromptDismissed,
    isTourActive: nav.isTourActive,
    appPath: permissions.appPath,

    // Sync status
    syncStatus: autoSync.syncStatus,
    isAnySyncing: autoSync.isAnySyncing,
    currentSyncMessage: autoSync.currentSyncMessage,
    triggerRefresh: autoSync.triggerRefresh,
  };
}

/**
 * Constructs the modal transitions portion of the return object.
 */
export function constructModalTransitions(
  modal: ModalFlowReturn,
): Pick<
  AppStateMachine,
  | "openProfile"
  | "closeProfile"
  | "openSettings"
  | "closeSettings"
  | "openTransactions"
  | "closeTransactions"
  | "openContacts"
  | "closeContacts"
  | "openAuditTransaction"
  | "closeAuditTransaction"
  | "toggleVersion"
  | "closeVersion"
  | "openTermsModal"
  | "closeTermsModal"
  | "openMoveAppPrompt"
  | "closeMoveAppPrompt"
  | "openIPhoneSync"
  | "closeIPhoneSync"
> {
  return {
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
  };
}

/**
 * Constructs the handlers portion of the return object.
 */
export function constructHandlers(
  nav: Pick<NavigationFlowReturn, "goToStep" | "goToEmailOnboarding" | "handleDismissSetupPrompt" | "setIsTourActive" | "getPageTitle">,
  auth: Pick<AuthFlowReturn, "handleLoginSuccess" | "handleLoginPending" | "handleDeepLinkAuthSuccess" | "handleLogout" | "handleAcceptTerms" | "handleDeclineTerms">,
  permissions: Pick<PermissionsFlowReturn, "handlePermissionsGranted" | "checkPermissions">,
  phoneHandlers: PhoneHandlersReturn,
  emailHandlers: EmailHandlersReturn,
  keychainHandlers: KeychainHandlersReturn,
  exportFlow: Pick<
    ExportFlowReturn,
    | "handleExportComplete"
    | "handleOutlookExport"
    | "handleOutlookCancel"
    | "handleStartOver"
    | "setExportResult"
    | "handleMicrosoftLogin"
    | "handleMicrosoftSkip"
    | "handleConnectOutlook"
  >,
  handleRetryConnection: () => Promise<void>,
  handleDismissMovePrompt: () => void,
  handleNotNowMovePrompt: () => void,
): Pick<
  AppStateMachine,
  | "goToStep"
  | "goToEmailOnboarding"
  | "handleLoginSuccess"
  | "handleLoginPending"
  | "handleDeepLinkAuthSuccess"
  | "handleLogout"
  | "handleAcceptTerms"
  | "handleDeclineTerms"
  | "handleSelectIPhone"
  | "handleSelectAndroid"
  | "handleAndroidGoBack"
  | "handleAndroidContinueWithEmail"
  | "handlePhoneTypeChange"
  | "handleAppleDriverSetupComplete"
  | "handleAppleDriverSetupSkip"
  | "handleEmailOnboardingComplete"
  | "handleEmailOnboardingSkip"
  | "handleEmailOnboardingBack"
  | "handleStartGoogleEmailConnect"
  | "handleStartMicrosoftEmailConnect"
  | "handleKeychainExplanationContinue"
  | "handleKeychainBack"
  | "handlePermissionsGranted"
  | "checkPermissions"
  | "handleExportComplete"
  | "handleOutlookExport"
  | "handleOutlookCancel"
  | "handleStartOver"
  | "setExportResult"
  | "handleMicrosoftLogin"
  | "handleMicrosoftSkip"
  | "handleConnectOutlook"
  | "handleRetryConnection"
  | "handleDismissSetupPrompt"
  | "setIsTourActive"
  | "handleDismissMovePrompt"
  | "handleNotNowMovePrompt"
  | "getPageTitle"
> {
  return {
    // Navigation transitions
    goToStep: nav.goToStep,
    goToEmailOnboarding: nav.goToEmailOnboarding,

    // Auth handlers
    handleLoginSuccess: auth.handleLoginSuccess,
    handleLoginPending: auth.handleLoginPending,
    handleDeepLinkAuthSuccess: auth.handleDeepLinkAuthSuccess,
    handleLogout: auth.handleLogout,

    // Terms handlers
    handleAcceptTerms: auth.handleAcceptTerms,
    handleDeclineTerms: auth.handleDeclineTerms,

    // Phone type handlers
    handleSelectIPhone: phoneHandlers.handleSelectIPhone,
    handleSelectAndroid: phoneHandlers.handleSelectAndroid,
    handleAndroidGoBack: phoneHandlers.handleAndroidGoBack,
    handleAndroidContinueWithEmail: phoneHandlers.handleAndroidContinueWithEmail,
    handlePhoneTypeChange: phoneHandlers.handlePhoneTypeChange,
    handleAppleDriverSetupComplete: phoneHandlers.handleAppleDriverSetupComplete,
    handleAppleDriverSetupSkip: phoneHandlers.handleAppleDriverSetupSkip,

    // Email onboarding handlers
    handleEmailOnboardingComplete: emailHandlers.handleEmailOnboardingComplete,
    handleEmailOnboardingSkip: emailHandlers.handleEmailOnboardingSkip,
    handleEmailOnboardingBack: emailHandlers.handleEmailOnboardingBack,
    handleStartGoogleEmailConnect: emailHandlers.handleStartGoogleEmailConnect,
    handleStartMicrosoftEmailConnect: emailHandlers.handleStartMicrosoftEmailConnect,

    // Keychain handlers
    handleKeychainExplanationContinue: keychainHandlers.handleKeychainExplanationContinue,
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
  };
}
