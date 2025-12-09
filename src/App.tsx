/**
 * App.tsx - Main Application Component
 *
 * This is the root component that composes the application from modular pieces:
 * - AppShell: Layout structure (title bar, offline banner, version info)
 * - AppRouter: Screen routing based on current step
 * - AppModals: Modal dialogs (profile, settings, etc.)
 * - BackgroundServices: Background monitors and notifications
 *
 * All state management is handled by useAppStateMachine hook.
 */

import React from "react";
import { AppShell, AppRouter, AppModals, BackgroundServices, useAppStateMachine } from "./appCore";

function App() {
  const state = useAppStateMachine();

  return (
    <AppShell
      currentStep={state.currentStep}
      isAuthenticated={state.isAuthenticated}
      currentUser={state.currentUser}
      isOnline={state.isOnline}
      isChecking={state.isChecking}
      connectionError={state.connectionError}
      showVersion={state.modalState.showVersion}
      onShowProfile={() => state.setShowProfile(true)}
      onRetryConnection={state.handleRetryConnection}
      onToggleVersion={() => state.setShowVersion(!state.modalState.showVersion)}
      onCloseVersion={() => state.setShowVersion(false)}
      getPageTitle={state.getPageTitle}
    >
      <AppRouter
        currentStep={state.currentStep}
        isMacOS={state.isMacOS}
        isWindows={state.isWindows}
        isOnline={state.isOnline}
        isChecking={state.isChecking}
        connectionError={state.connectionError}
        isAuthenticated={state.isAuthenticated}
        currentUser={state.currentUser}
        authProvider={state.authProvider}
        pendingOAuthData={state.pendingOAuthData}
        pendingOnboardingData={state.pendingOnboardingData}
        pendingEmailTokens={state.pendingEmailTokens}
        isInitializingDatabase={state.isInitializingDatabase}
        skipKeychainExplanation={state.skipKeychainExplanation}
        selectedPhoneType={state.selectedPhoneType}
        hasPermissions={state.hasPermissions}
        hasEmailConnected={state.hasEmailConnected}
        showSetupPromptDismissed={state.showSetupPromptDismissed}
        exportResult={state.exportResult}
        conversations={state.conversations}
        selectedConversationIds={state.selectedConversationIds}
        outlookConnected={state.outlookConnected}
        onLoginSuccess={state.handleLoginSuccess}
        onLoginPending={state.handleLoginPending}
        onSelectIPhone={state.handleSelectIPhone}
        onSelectAndroid={state.handleSelectAndroid}
        onAndroidGoBack={state.handleAndroidGoBack}
        onAndroidContinueWithEmail={state.handleAndroidContinueWithEmail}
        onAppleDriverSetupComplete={state.handleAppleDriverSetupComplete}
        onAppleDriverSetupSkip={state.handleAppleDriverSetupSkip}
        onEmailOnboardingComplete={state.handleEmailOnboardingComplete}
        onEmailOnboardingSkip={state.handleEmailOnboardingSkip}
        onEmailOnboardingBack={state.handleEmailOnboardingBack}
        onKeychainExplanationContinue={state.handleKeychainExplanationContinue}
        onKeychainBack={state.handleKeychainBack}
        onMicrosoftLogin={state.handleMicrosoftLogin}
        onMicrosoftSkip={state.handleMicrosoftSkip}
        onConnectOutlook={state.handleConnectOutlook}
        onPermissionsGranted={state.handlePermissionsGranted}
        onCheckPermissions={state.checkPermissions}
        onAuditNew={() => state.setShowAuditTransaction(true)}
        onViewTransactions={() => state.setShowTransactions(true)}
        onManageContacts={() => state.setShowContacts(true)}
        onTourStateChange={state.setIsTourActive}
        onContinueSetup={() => state.setCurrentStep("email-onboarding")}
        onDismissSetupPrompt={state.handleDismissSetupPrompt}
        onExportComplete={state.handleExportComplete}
        onOutlookExport={state.handleOutlookExport}
        onOutlookCancel={state.handleOutlookCancel}
        onStartOver={state.handleStartOver}
        onRetryConnection={state.handleRetryConnection}
        setCurrentStep={state.setCurrentStep}
        setExportResult={state.setExportResult}
      />

      <BackgroundServices
        isAuthenticated={state.isAuthenticated}
        currentUser={state.currentUser}
        authProvider={state.authProvider}
        currentStep={state.currentStep}
        hasPermissions={state.hasPermissions}
        hasEmailConnected={state.hasEmailConnected}
        isTourActive={state.isTourActive}
        needsTermsAcceptance={state.needsTermsAcceptance}
      />

      <AppModals
        modalState={state.modalState}
        currentUser={state.currentUser}
        authProvider={state.authProvider}
        subscription={state.subscription}
        pendingOAuthData={state.pendingOAuthData}
        needsTermsAcceptance={state.needsTermsAcceptance}
        appPath={state.appPath}
        onCloseProfile={() => state.setShowProfile(false)}
        onCloseSettings={() => state.setShowSettings(false)}
        onCloseTransactions={() => state.setShowTransactions(false)}
        onCloseContacts={() => state.setShowContacts(false)}
        onCloseAuditTransaction={() => state.setShowAuditTransaction(false)}
        onLogout={state.handleLogout}
        onViewTransactions={() => state.setShowTransactions(true)}
        onOpenSettings={() => state.setShowSettings(true)}
        onAuditTransactionSuccess={() => {
          state.setShowAuditTransaction(false);
          state.setShowTransactions(true);
        }}
        onAcceptTerms={state.handleAcceptTerms}
        onDeclineTerms={state.handleDeclineTerms}
        onDismissMovePrompt={state.handleDismissMovePrompt}
        onNotNowMovePrompt={state.handleNotNowMovePrompt}
      />
    </AppShell>
  );
}

export default App;
