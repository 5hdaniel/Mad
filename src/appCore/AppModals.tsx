/**
 * AppModals Component
 *
 * Renders all modal components that can appear over the main application.
 * This keeps modal logic centralized and separate from routing.
 */

import React from "react";
import Profile from "../components/Profile";
import Settings from "../components/Settings";
import Transactions from "../components/Transactions";
import Contacts from "../components/Contacts";
import WelcomeTerms from "../components/WelcomeTerms";
import AuditTransactionModal from "../components/AuditTransactionModal";
import MoveAppPrompt from "../components/MoveAppPrompt";
import type { PendingOAuthData } from "../components/Login";
import type { Subscription, ModalState } from "./state/types";

interface AppModalsProps {
  // Modal visibility state
  modalState: ModalState;

  // User state
  currentUser: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
  authProvider: string | null;
  subscription: Subscription | undefined;

  // Pending data for terms modal
  pendingOAuthData: PendingOAuthData | null;
  needsTermsAcceptance: boolean;

  // Move app state
  appPath: string;

  // Modal handlers
  onCloseProfile: () => void;
  onCloseSettings: () => void;
  onCloseTransactions: () => void;
  onCloseContacts: () => void;
  onCloseAuditTransaction: () => void;

  // Profile actions
  onLogout: () => Promise<void>;
  onViewTransactions: () => void;
  onOpenSettings: () => void;

  // Audit transaction actions
  onAuditTransactionSuccess: () => void;

  // Terms actions
  onAcceptTerms: () => Promise<void>;
  onDeclineTerms: () => Promise<void>;

  // Move app actions
  onDismissMovePrompt: () => void;
  onNotNowMovePrompt: () => void;
}

export function AppModals({
  modalState,
  currentUser,
  authProvider,
  subscription,
  pendingOAuthData,
  needsTermsAcceptance,
  appPath,
  onCloseProfile,
  onCloseSettings,
  onCloseTransactions,
  onCloseContacts,
  onCloseAuditTransaction,
  onLogout,
  onViewTransactions,
  onOpenSettings,
  onAuditTransactionSuccess,
  onAcceptTerms,
  onDeclineTerms,
  onDismissMovePrompt,
  onNotNowMovePrompt,
}: AppModalsProps) {
  return (
    <>
      {/* Move App Prompt */}
      {modalState.showMoveAppPrompt && (
        <MoveAppPrompt
          appPath={appPath}
          onDismiss={onDismissMovePrompt}
          onNotNow={onNotNowMovePrompt}
        />
      )}

      {/* Profile Modal */}
      {modalState.showProfile && currentUser && authProvider && (
        <Profile
          user={currentUser}
          provider={authProvider}
          subscription={subscription}
          onLogout={onLogout}
          onClose={onCloseProfile}
          onViewTransactions={onViewTransactions}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* Settings Modal */}
      {modalState.showSettings && currentUser && (
        <Settings
          userId={currentUser.id}
          onClose={onCloseSettings}
        />
      )}

      {/* Transactions View */}
      {modalState.showTransactions && currentUser && authProvider && (
        <Transactions
          userId={currentUser.id}
          provider={authProvider}
          onClose={onCloseTransactions}
        />
      )}

      {/* Contacts View */}
      {modalState.showContacts && currentUser && (
        <Contacts
          userId={currentUser.id}
          onClose={onCloseContacts}
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
          onAccept={onAcceptTerms}
          onDecline={onDeclineTerms}
        />
      )}

      {/* Audit Transaction Modal */}
      {modalState.showAuditTransaction && currentUser && authProvider && (
        <AuditTransactionModal
          userId={currentUser.id as any}
          provider={authProvider}
          onClose={onCloseAuditTransaction}
          onSuccess={onAuditTransactionSuccess}
        />
      )}
    </>
  );
}
