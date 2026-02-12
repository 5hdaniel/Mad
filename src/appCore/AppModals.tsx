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
import { IPhoneSyncModal } from "./modals/IPhoneSyncModal";
import type { AppStateMachine } from "./state/types";
import { useEmailSettingsCallbacks } from "./hooks/useEmailSettingsCallbacks";

interface AppModalsProps {
  app: AppStateMachine;
}

export function AppModals({ app }: AppModalsProps) {
  const {
    modalState,
    currentUser,
    authProvider,
    subscription,
    isDatabaseInitialized,
    pendingOAuthData,
    needsTermsAcceptance,
    appPath,
    // Modal transitions
    closeProfile,
    closeSettings,
    closeTransactions,
    closeContacts,
    closeAuditTransaction,
    openSettings,
    openTransactions,
    // Handlers
    handleLogout,
    handleAcceptTerms,
    handleDeclineTerms,
    handleDismissMovePrompt,
    handleNotNowMovePrompt,
    closeIPhoneSync,
  } = app;

  // Compound action: close audit transaction modal and open transactions
  const handleAuditTransactionSuccess = useCallback(() => {
    closeAuditTransaction();
    openTransactions();
  }, [closeAuditTransaction, openTransactions]);

  // Email connect/disconnect callbacks for Settings modal
  const { handleEmailConnectedFromSettings, handleEmailDisconnectedFromSettings } =
    useEmailSettingsCallbacks({ userId: currentUser?.id });

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
        <div className="fixed inset-0 z-[60]" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <TransactionList
            userId={currentUser.id}
            provider={authProvider as "google" | "microsoft"}
            onClose={closeTransactions}
          />
        </div>
      )}

      {/* Contacts View */}
      {modalState.showContacts && currentUser && isDatabaseInitialized && (
        <div className="fixed inset-0 z-[60]" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
      {modalState.showIPhoneSync && <IPhoneSyncModal onClose={closeIPhoneSync} />}
    </>
  );
}
