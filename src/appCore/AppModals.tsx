/**
 * AppModals Component
 *
 * Renders all modal components that can appear over the main application.
 * This keeps modal logic centralized and separate from routing.
 */

import React, { useCallback } from "react";
import Profile from "../components/Profile";
import Settings from "../components/Settings";
import TransactionList from "../components/TransactionList";
import Contacts from "../components/Contacts";
import WelcomeTerms from "../components/WelcomeTerms";
import AuditTransactionModal from "../components/AuditTransactionModal";
import MoveAppPrompt from "../components/MoveAppPrompt";
import IPhoneSyncFlow from "../components/iphone/IPhoneSyncFlow";
import type { AppStateMachine } from "./state/types";
import { useEmailOnboardingApi } from "./state/flows";

interface AppModalsProps {
  app: AppStateMachine;
}

export function AppModals({ app }: AppModalsProps) {
  const {
    // Modal state
    modalState,

    // User state
    currentUser,
    authProvider,
    subscription,

    // Database state (for modal guards)
    isDatabaseInitialized,

    // Pending data for terms modal
    pendingOAuthData,
    needsTermsAcceptance,

    // Move app state
    appPath,

    // Semantic modal transitions
    closeProfile,
    closeSettings,
    closeTransactions,
    closeContacts,
    closeAuditTransaction,
    openSettings,
    openTransactions,

    // Auth handlers
    handleLogout,

    // Terms handlers
    handleAcceptTerms,
    handleDeclineTerms,

    // Move app handlers
    handleDismissMovePrompt,
    handleNotNowMovePrompt,

    // iPhone sync
    closeIPhoneSync,
  } = app;

  // Compound action: close audit transaction modal and open transactions
  const handleAuditTransactionSuccess = useCallback(() => {
    closeAuditTransaction();
    openTransactions();
  }, [closeAuditTransaction, openTransactions]);

  // Get email onboarding API to dispatch EMAIL_CONNECTED/EMAIL_DISCONNECTED when connecting/disconnecting from Settings
  const { setHasEmailConnected } = useEmailOnboardingApi({ userId: currentUser?.id });

  // Callback for when email is connected from Settings
  const handleEmailConnectedFromSettings = useCallback(
    (email: string, provider: "google" | "microsoft") => {
      setHasEmailConnected(true, email, provider);
    },
    [setHasEmailConnected]
  );

  // TASK-1730: Callback for when email is disconnected from Settings
  const handleEmailDisconnectedFromSettings = useCallback(
    (provider: "google" | "microsoft") => {
      setHasEmailConnected(false, undefined, provider);
    },
    [setHasEmailConnected]
  );
  return (
    <>
      {/* Move App Prompt */}
      {modalState.showMoveAppPrompt && (
        <MoveAppPrompt
          appPath={appPath}
          onDismiss={handleDismissMovePrompt}
          onNotNow={handleNotNowMovePrompt}
        />
      )}

      {/* Profile Modal */}
      {modalState.showProfile && currentUser && authProvider && (
        <Profile
          user={currentUser}
          provider={authProvider}
          subscription={subscription}
          onLogout={handleLogout}
          onClose={closeProfile}
          onViewTransactions={openTransactions}
          onOpenSettings={openSettings}
        />
      )}

      {/* Settings Modal */}
      {modalState.showSettings && currentUser && (
        <Settings
          userId={currentUser.id}
          onClose={closeSettings}
          onEmailConnected={handleEmailConnectedFromSettings}
          onEmailDisconnected={handleEmailDisconnectedFromSettings}
        />
      )}

      {/* Transactions View */}
      {modalState.showTransactions && currentUser && authProvider && isDatabaseInitialized && (
        <div className="fixed inset-0 z-[60]">
          <TransactionList
            userId={currentUser.id}
            provider={authProvider as "google" | "microsoft"}
            onClose={closeTransactions}
          />
        </div>
      )}

      {/* Contacts View */}
      {modalState.showContacts && currentUser && isDatabaseInitialized && (
        <div className="fixed inset-0 z-[60]">
          <Contacts userId={currentUser.id} onClose={closeContacts} />
        </div>
      )}

      {/* Welcome Terms Modal (New Users Only) */}
      {(modalState.showTermsModal || (needsTermsAcceptance && currentUser)) && (
        <WelcomeTerms
          user={
            currentUser ||
            (pendingOAuthData
              ? {
                  id: pendingOAuthData.cloudUser.id,
                  email: pendingOAuthData.userInfo.email,
                  display_name: pendingOAuthData.userInfo.name,
                  avatar_url: pendingOAuthData.userInfo.picture,
                }
              : { id: "", email: "" })
          }
          onAccept={handleAcceptTerms}
          onDecline={handleDeclineTerms}
        />
      )}

      {/* Audit Transaction Modal */}
      {modalState.showAuditTransaction && currentUser && authProvider && isDatabaseInitialized && (
        <AuditTransactionModal
          userId={currentUser.id}
          provider={authProvider}
          onClose={closeAuditTransaction}
          onSuccess={handleAuditTransactionSuccess}
        />
      )}

      {/* iPhone Sync Flow Modal */}
      {modalState.showIPhoneSync && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <div className="flex justify-end p-4 pb-0">
              <button
                onClick={closeIPhoneSync}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <IPhoneSyncFlow onClose={closeIPhoneSync} />
          </div>
        </div>
      )}
    </>
  );
}
