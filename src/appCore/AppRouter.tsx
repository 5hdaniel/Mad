/**
 * AppRouter Component
 *
 * Handles routing between different application screens based on currentStep.
 * This is a pure extraction of the routing logic from App.tsx.
 */

import React, { useState, useCallback } from "react";
import Login from "../components/Login";
import MicrosoftLogin from "../components/MicrosoftLogin";
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
import { UpgradeScreen, type UpgradeReason } from "../components/license/UpgradeScreen";
import type { AppStateMachine } from "./state/types";
import {
  USE_NEW_ONBOARDING,
  isOnboardingStep,
  LoadingScreen,
  transformOutlookResults,
} from "./routing";

interface AppRouterProps {
  app: AppStateMachine;
}

export function AppRouter({ app }: AppRouterProps) {
  const {
    // State
    currentStep, isMacOS, isWindows, isOnline, isChecking, connectionError,
    isAuthenticated, currentUser, authProvider, pendingOAuthData, pendingOnboardingData,
    isInitializingDatabase, skipKeychainExplanation, selectedPhoneType,
    hasEmailConnected, showSetupPromptDismissed, exportResult, conversations,
    selectedConversationIds, outlookConnected,
    // Handlers
    handleLoginSuccess, handleLoginPending, handleDeepLinkAuthSuccess, handleSelectIPhone, handleSelectAndroid,
    handleAndroidGoBack, handleAndroidContinueWithEmail, handlePhoneTypeChange,
    handleAppleDriverSetupComplete, handleAppleDriverSetupSkip, handleEmailOnboardingComplete,
    handleEmailOnboardingSkip, handleEmailOnboardingBack, handleKeychainExplanationContinue,
    handleKeychainBack, handleMicrosoftLogin, handleMicrosoftSkip, handleConnectOutlook,
    handlePermissionsGranted, checkPermissions, handleExportComplete, handleOutlookExport,
    handleOutlookCancel, handleStartOver, setExportResult, handleRetryConnection,
    openAuditTransaction, openTransactions, openContacts, goToStep,
    handleDismissSetupPrompt, setIsTourActive, openIPhoneSync, openSettings,
    handleLogout,
  } = app;

  // Track license blocked state for login screen
  const [licenseBlocked, setLicenseBlocked] = useState<{
    blocked: boolean;
    reason: UpgradeReason;
  }>({ blocked: false, reason: "unknown" });

  // Handle license blocked during login
  const handleLicenseBlocked = useCallback((data: { userId: string; blockReason: string }) => {
    // Map blockReason to UpgradeReason
    let reason: UpgradeReason = "unknown";
    if (data.blockReason === "expired") {
      reason = "trial_expired";
    } else if (data.blockReason === "transaction_limit") {
      reason = "transaction_limit";
    } else if (data.blockReason === "suspended") {
      reason = "suspended";
    }
    setLicenseBlocked({ blocked: true, reason });
  }, []);

  // Handle logout from UpgradeScreen - reset blocked state and call app logout
  const handleUpgradeScreenLogout = useCallback(async () => {
    setLicenseBlocked({ blocked: false, reason: "unknown" });
    await handleLogout();
  }, [handleLogout]);

  // New onboarding architecture (when enabled)
  if (USE_NEW_ONBOARDING && isOnboardingStep(currentStep)) {
    return <OnboardingFlow app={app} />;
  }

  // Loading state
  if (currentStep === "loading") {
    return <LoadingScreen />;
  }

  // Login screen (with offline fallback)
  if (currentStep === "login") {
    // Show UpgradeScreen if license was blocked during login
    if (licenseBlocked.blocked) {
      return <UpgradeScreen reason={licenseBlocked.reason} onLogout={handleUpgradeScreenLogout} />;
    }

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
        onDeepLinkAuthSuccess={handleDeepLinkAuthSuccess}
        onLicenseBlocked={handleLicenseBlocked}
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

  // Microsoft login
  if (currentStep === "microsoft-login") {
    return (
      <MicrosoftLogin
        onLoginComplete={handleMicrosoftLogin}
        onSkip={handleMicrosoftSkip}
      />
    );
  }

  // Dashboard
  if (currentStep === "dashboard") {
    // Show iPhone sync button for Windows + iPhone users
    const showIPhoneSyncButton = isWindows && selectedPhoneType === "iphone";

    // Handler to open Settings and scroll to Email Connections section
    const handleContinueSetup = () => {
      openSettings();
      // Scroll to and highlight email connections section after modal opens
      setTimeout(() => {
        const emailSection = document.getElementById("email-connections");
        if (emailSection) {
          emailSection.scrollIntoView({ behavior: "smooth", block: "start" });
          // Add highlight effect
          emailSection.classList.add("ring-2", "ring-amber-400", "ring-offset-2", "rounded-lg");
          // Remove highlight after 3 seconds
          setTimeout(() => {
            emailSection.classList.remove("ring-2", "ring-amber-400", "ring-offset-2", "rounded-lg");
          }, 3000);
        }
      }, 150);
    };

    return (
      <Dashboard
        onAuditNew={openAuditTransaction}
        onViewTransactions={openTransactions}
        onManageContacts={openContacts}
        onSyncPhone={showIPhoneSyncButton ? openIPhoneSync : undefined}
        onTourStateChange={setIsTourActive}
        showSetupPrompt={!hasEmailConnected && !showSetupPromptDismissed}
        onContinueSetup={handleContinueSetup}
        onDismissSetupPrompt={handleDismissSetupPrompt}
        onTriggerRefresh={app.triggerRefresh}
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
        onComplete={(results) => {
          setExportResult(transformOutlookResults(results));
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
