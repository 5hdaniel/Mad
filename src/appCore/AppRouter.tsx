/**
 * AppRouter Component
 *
 * Handles routing between different application screens based on currentStep.
 * This is a pure extraction of the routing logic from App.tsx.
 */

import React from "react";
import Login, { PendingOAuthData } from "../components/Login";
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
import type {
  AppStep,
  AppExportResult,
  OutlookExportResults,
  PendingOnboardingData,
  PendingEmailTokens,
  Conversation,
  Subscription,
} from "./state/types";

interface AppRouterProps {
  // Navigation state
  currentStep: AppStep;

  // Platform state
  isMacOS: boolean;
  isWindows: boolean;

  // Network state
  isOnline: boolean;
  isChecking: boolean;
  connectionError: string | null;

  // Auth state
  isAuthenticated: boolean;
  currentUser: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
  authProvider: string | null;
  pendingOAuthData: PendingOAuthData | null;
  pendingOnboardingData: PendingOnboardingData;
  pendingEmailTokens: PendingEmailTokens | null;

  // Secure storage state
  isInitializingDatabase: boolean;
  skipKeychainExplanation: boolean;

  // Phone type state
  selectedPhoneType: "iphone" | "android" | null;

  // Permissions state
  hasPermissions: boolean;

  // Email state
  hasEmailConnected: boolean;
  showSetupPromptDismissed: boolean;

  // Export state
  exportResult: AppExportResult | null;
  conversations: Conversation[];
  selectedConversationIds: Set<string>;
  outlookConnected: boolean;

  // Auth handlers
  onLoginSuccess: (
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
  ) => void;
  onLoginPending: (oauthData: PendingOAuthData) => void;

  // Phone type handlers
  onSelectIPhone: () => Promise<void>;
  onSelectAndroid: () => void;
  onAndroidGoBack: () => void;
  onAndroidContinueWithEmail: () => Promise<void>;

  // Driver setup handlers
  onAppleDriverSetupComplete: () => void;
  onAppleDriverSetupSkip: () => void;

  // Email onboarding handlers
  onEmailOnboardingComplete: (emailTokens?: PendingEmailTokens) => Promise<void>;
  onEmailOnboardingSkip: () => Promise<void>;
  onEmailOnboardingBack: () => void;

  // Keychain handlers
  onKeychainExplanationContinue: (dontShowAgain: boolean) => Promise<void>;
  onKeychainBack: () => void;

  // Microsoft handlers
  onMicrosoftLogin: (userInfo: unknown) => void;
  onMicrosoftSkip: () => void;
  onConnectOutlook: () => void;

  // Permission handlers
  onPermissionsGranted: () => void;
  onCheckPermissions: () => Promise<void>;

  // Dashboard handlers
  onAuditNew: () => void;
  onViewTransactions: () => void;
  onManageContacts: () => void;
  onTourStateChange: (active: boolean) => void;
  onContinueSetup: () => void;
  onDismissSetupPrompt: () => void;

  // Export handlers
  onExportComplete: (result: unknown) => void;
  onOutlookExport: (selectedIds: Set<string>) => Promise<void>;
  onOutlookCancel: () => void;
  onStartOver: () => void;

  // Network handlers
  onRetryConnection: () => Promise<void>;

  // Step setter for outlook export results
  setCurrentStep: (step: AppStep) => void;
  setExportResult: (result: AppExportResult | null) => void;
}

export function AppRouter({
  currentStep,
  isMacOS,
  isWindows,
  isOnline,
  isChecking,
  connectionError,
  isAuthenticated,
  currentUser,
  authProvider,
  pendingOAuthData,
  pendingOnboardingData,
  pendingEmailTokens,
  isInitializingDatabase,
  skipKeychainExplanation,
  selectedPhoneType,
  hasPermissions: _hasPermissions,
  hasEmailConnected,
  showSetupPromptDismissed,
  exportResult,
  conversations,
  selectedConversationIds,
  outlookConnected,
  onLoginSuccess,
  onLoginPending,
  onSelectIPhone,
  onSelectAndroid,
  onAndroidGoBack,
  onAndroidContinueWithEmail,
  onAppleDriverSetupComplete,
  onAppleDriverSetupSkip,
  onEmailOnboardingComplete,
  onEmailOnboardingSkip,
  onEmailOnboardingBack,
  onKeychainExplanationContinue,
  onKeychainBack,
  onMicrosoftLogin,
  onMicrosoftSkip,
  onConnectOutlook,
  onPermissionsGranted,
  onCheckPermissions,
  onAuditNew,
  onViewTransactions,
  onManageContacts,
  onTourStateChange,
  onContinueSetup,
  onDismissSetupPrompt,
  onExportComplete,
  onOutlookExport,
  onOutlookCancel,
  onStartOver,
  onRetryConnection,
  setCurrentStep,
  setExportResult,
}: AppRouterProps) {
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
          onRetry={onRetryConnection}
          mode="fullscreen"
        />
      );
    }
    return (
      <Login
        onLoginSuccess={onLoginSuccess}
        onLoginPending={onLoginPending}
      />
    );
  }

  // Keychain explanation (macOS only)
  if (currentStep === "keychain-explanation" && isMacOS) {
    return (
      <KeychainExplanation
        onContinue={onKeychainExplanationContinue}
        onBack={onKeychainBack}
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
        onSelectIPhone={onSelectIPhone}
        onSelectAndroid={onSelectAndroid}
        selectedType={selectedPhoneType || pendingOnboardingData.phoneType}
      />
    );
  }

  // Android coming soon
  if (currentStep === "android-coming-soon") {
    return (
      <AndroidComingSoon
        onGoBack={onAndroidGoBack}
        onContinueWithEmail={onAndroidContinueWithEmail}
      />
    );
  }

  // Apple driver setup (Windows only)
  if (currentStep === "apple-driver-setup" && isWindows) {
    return (
      <AppleDriverSetup
        onComplete={onAppleDriverSetupComplete}
        onSkip={onAppleDriverSetupSkip}
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
        onComplete={onEmailOnboardingComplete}
        onSkip={onEmailOnboardingSkip}
        onBack={onEmailOnboardingBack}
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
        onLoginComplete={onMicrosoftLogin}
        onSkip={onMicrosoftSkip}
      />
    );
  }

  // Permissions (macOS only)
  if (currentStep === "permissions" && isMacOS) {
    return (
      <PermissionsScreen
        onPermissionsGranted={onPermissionsGranted}
        onCheckAgain={onCheckPermissions}
      />
    );
  }

  // Dashboard
  if (currentStep === "dashboard") {
    return (
      <Dashboard
        onAuditNew={onAuditNew}
        onViewTransactions={onViewTransactions}
        onManageContacts={onManageContacts}
        onTourStateChange={onTourStateChange}
        showSetupPrompt={!hasEmailConnected && !showSetupPromptDismissed}
        onContinueSetup={onContinueSetup}
        onDismissSetupPrompt={onDismissSetupPrompt}
      />
    );
  }

  // Contacts/Conversation list
  if (currentStep === "contacts") {
    return (
      <ConversationList
        onExportComplete={onExportComplete}
        onOutlookExport={onOutlookExport}
        onConnectOutlook={onConnectOutlook}
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
          setCurrentStep("complete");
        }}
        onCancel={onOutlookCancel}
      />
    );
  }

  // Export complete
  if (currentStep === "complete" && exportResult) {
    return <ExportComplete result={exportResult} onStartOver={onStartOver} />;
  }

  // Fallback - should not reach here
  return null;
}
