/**
 * AppModals Component
 *
 * Renders all modal components that can appear over the main application.
 * This keeps modal logic centralized and separate from routing.
 */

import React, { useCallback } from "react";
import Profile from "../components/Profile";
import Settings from "../components/Settings";
import Transactions from "../components/Transactions";
import Contacts from "../components/Contacts";
import WelcomeTerms from "../components/WelcomeTerms";
import AuditTransactionModal from "../components/AuditTransactionModal";
import MoveAppPrompt from "../components/MoveAppPrompt";
import type { AppStateMachine } from "./state/types";

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
  } = app;

  // Compound action: close audit transaction modal and open transactions
  const handleAuditTransactionSuccess = useCallback(() => {
    closeAuditTransaction();
    openTransactions();
  }, [closeAuditTransaction, openTransactions]);
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
        />
      )}

      {/* Transactions View */}
      {modalState.showTransactions && currentUser && authProvider && (
        <Transactions
          userId={currentUser.id}
          provider={authProvider}
          onClose={closeTransactions}
        />
      )}

      {/* Contacts View */}
      {modalState.showContacts && currentUser && (
        <Contacts
          userId={currentUser.id}
          onClose={closeContacts}
        />
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
      {modalState.showAuditTransaction && currentUser && authProvider && (
        <AuditTransactionModal
          userId={currentUser.id as any}
          provider={authProvider}
          onClose={closeAuditTransaction}
          onSuccess={handleAuditTransactionSuccess}
        />
      )}
    </>
  );
}
