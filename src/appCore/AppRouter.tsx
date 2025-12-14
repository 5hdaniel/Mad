/**
 * AppRouter Component
 *
 * Handles routing between different application screens based on currentStep.
 * This is a pure extraction of the routing logic from App.tsx.
 */

import React from "react";
import Login from "../components/Login";
import MicrosoftLogin from "../components/MicrosoftLogin";
import EmailOnboardingScreen from "../components/EmailOnboardingScreen";
import PermissionsScreen from "../components/PermissionsScreen";
import ConversationList from "../components/ConversationList";
import ExportComplete from "../components/ExportComplete";
import OutlookExport from "../components/OutlookExport";
import KeychainExplanation from "../components/KeychainExplanation";
import Dashboard from "../components/Dashboard";
import OfflineFallback from "../components/OfflineFallback";
import PhoneTypeSelection from "../components/PhoneTypeSelection";
import AndroidComingSoon from "../components/AndroidComingSoon";
import AppleDriverSetup from "../components/AppleDriverSetup";
import { OnboardingFlow } from "../components/onboarding";
import type { AppStateMachine, OutlookExportResults } from "./state/types";

/**
 * Feature flag for new onboarding architecture.
 * Set to true to use the new unified onboarding system.
 * Set to false to use the legacy per-screen components.
 */
const USE_NEW_ONBOARDING = false; // TODO: Enable after adding OAuth handlers to new flow

/**
 * Check if the current step is an onboarding step that should use the new system.
 */
function isOnboardingStep(step: string): boolean {
  return [
    "phone-type-selection",
    "android-coming-soon",
    "email-onboarding",
    "keychain-explanation",
    "permissions",
    "apple-driver-setup",
  ].includes(step);
}

interface AppRouterProps {
  app: AppStateMachine;
}

export function AppRouter({ app }: AppRouterProps) {
  const {
    // Navigation state
    currentStep,

    // Platform state
    isMacOS,
    isWindows,

    // Network state
    isOnline,
    isChecking,
    connectionError,

    // Auth state
    isAuthenticated,
    currentUser,
    authProvider,
    pendingOAuthData,
    pendingOnboardingData,
    pendingEmailTokens,

    // Secure storage state
    isInitializingDatabase,
    skipKeychainExplanation,

    // Phone type state
    selectedPhoneType,

    // Email state
    hasEmailConnected,
    showSetupPromptDismissed,

    // Export state
    exportResult,
    conversations,
    selectedConversationIds,
    outlookConnected,

    // Auth handlers
    handleLoginSuccess,
    handleLoginPending,

    // Phone type handlers
    handleSelectIPhone,
    handleSelectAndroid,
    handleAndroidGoBack,
    handleAndroidContinueWithEmail,
    handlePhoneTypeChange,

    // Driver setup handlers
    handleAppleDriverSetupComplete,
    handleAppleDriverSetupSkip,

    // Email onboarding handlers
    handleEmailOnboardingComplete,
    handleEmailOnboardingSkip,
    handleEmailOnboardingBack,

    // Keychain handlers
    handleKeychainExplanationContinue,
    handleKeychainBack,

    // Microsoft handlers
    handleMicrosoftLogin,
    handleMicrosoftSkip,
    handleConnectOutlook,

    // Permission handlers
    handlePermissionsGranted,
    checkPermissions,

    // Export handlers
    handleExportComplete,
    handleOutlookExport,
    handleOutlookCancel,
    handleStartOver,
    setExportResult,

    // Network handlers
    handleRetryConnection,

    // Semantic modal transitions
    openAuditTransaction,
    openTransactions,
    openContacts,

    // Navigation transitions
    goToStep,
    goToEmailOnboarding,

    // UI handlers
    handleDismissSetupPrompt,
    setIsTourActive,

    // iPhone sync
    openIPhoneSync,
  } = app;
  // New onboarding architecture (when enabled)
  if (USE_NEW_ONBOARDING && isOnboardingStep(currentStep)) {
    return <OnboardingFlow app={app} />;
  }

  // Loading state
  if (currentStep === "loading") {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
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
          <p className="text-gray-600 text-sm">Starting Magic Audit...</p>
        </div>
      </div>
    );
  }

  // Login screen (with offline fallback)
  if (currentStep === "login") {
    if (!isOnline) {
      return (
        <OfflineFallback
          isOffline={true}
          isRetrying={isChecking}
          error={connectionError}
          onRetry={handleRetryConnection}
          mode="fullscreen"
        />
      );
    }
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onLoginPending={handleLoginPending}
      />
    );
  }

  // Keychain explanation (macOS only)
  if (currentStep === "keychain-explanation" && isMacOS) {
    return (
      <KeychainExplanation
        onContinue={handleKeychainExplanationContinue}
        onBack={handleKeychainBack}
        isLoading={isInitializingDatabase}
        hasPendingLogin={!!pendingOAuthData}
        skipExplanation={skipKeychainExplanation}
      />
    );
  }

  // Phone type selection
  if (currentStep === "phone-type-selection") {
    return (
      <PhoneTypeSelection
        onSelectIPhone={handleSelectIPhone}
        onSelectAndroid={handleSelectAndroid}
        selectedType={selectedPhoneType || pendingOnboardingData.phoneType}
      />
    );
  }

  // Android coming soon
  if (currentStep === "android-coming-soon") {
    return (
      <AndroidComingSoon
        onGoBack={handleAndroidGoBack}
        onContinueWithEmail={handleAndroidContinueWithEmail}
      />
    );
  }

  // Apple driver setup (Windows only)
  if (currentStep === "apple-driver-setup" && isWindows) {
    return (
      <AppleDriverSetup
        onComplete={handleAppleDriverSetupComplete}
        onSkip={handleAppleDriverSetupSkip}
      />
    );
  }

  // Email onboarding
  if (
    currentStep === "email-onboarding" &&
    (currentUser || pendingOAuthData) &&
    (authProvider || pendingOAuthData?.provider)
  ) {
    return (
      <EmailOnboardingScreen
        userId={currentUser?.id || pendingOAuthData?.cloudUser.id || ""}
        authProvider={
          (authProvider || pendingOAuthData?.provider) as "google" | "microsoft"
        }
        selectedPhoneType={selectedPhoneType || pendingOnboardingData.phoneType}
        onPhoneTypeChange={handlePhoneTypeChange}
        onComplete={handleEmailOnboardingComplete}
        onSkip={handleEmailOnboardingSkip}
        onBack={handleEmailOnboardingBack}
        isPreDbFlow={!!pendingOAuthData && !isAuthenticated}
        emailHint={pendingOAuthData?.userInfo.email || currentUser?.email}
        existingPendingTokens={pendingEmailTokens}
      />
    );
  }

  // Microsoft login
  if (currentStep === "microsoft-login") {
    return (
      <MicrosoftLogin
        onLoginComplete={handleMicrosoftLogin}
        onSkip={handleMicrosoftSkip}
      />
    );
  }

  // Permissions (macOS only)
  if (currentStep === "permissions" && isMacOS) {
    return (
      <PermissionsScreen
        onPermissionsGranted={handlePermissionsGranted}
        onCheckAgain={checkPermissions}
      />
    );
  }

  // Dashboard
  if (currentStep === "dashboard") {
    // Show iPhone sync button for Windows + iPhone users
    const showIPhoneSyncButton = isWindows && selectedPhoneType === "iphone";

    return (
      <Dashboard
        onAuditNew={openAuditTransaction}
        onViewTransactions={openTransactions}
        onManageContacts={openContacts}
        onSyncPhone={showIPhoneSyncButton ? openIPhoneSync : undefined}
        onTourStateChange={setIsTourActive}
        showSetupPrompt={!hasEmailConnected && !showSetupPromptDismissed}
        onContinueSetup={goToEmailOnboarding}
        onDismissSetupPrompt={handleDismissSetupPrompt}
      />
    );
  }

  // Contacts/Conversation list
  if (currentStep === "contacts") {
    return (
      <ConversationList
        onExportComplete={handleExportComplete}
        onOutlookExport={handleOutlookExport}
        onConnectOutlook={handleConnectOutlook}
        outlookConnected={outlookConnected}
      />
    );
  }

  // Outlook export
  if (currentStep === "outlook") {
    return (
      <OutlookExport
        conversations={conversations}
        selectedIds={selectedConversationIds}
        onComplete={(results: OutlookExportResults | null) => {
          if (results) {
            setExportResult({
              exportPath: results.exportPath,
              results: results.results?.map((r) => ({
                contactName: r.contactName,
                success: r.success,
              })),
            });
          } else {
            setExportResult(null);
          }
          goToStep("complete");
        }}
        onCancel={handleOutlookCancel}
      />
    );
  }

  // Export complete
  if (currentStep === "complete" && exportResult) {
    return (
      <ExportComplete result={exportResult} onStartOver={handleStartOver} />
    );
  }

  // Fallback - should not reach here
  return null;
}
