/**
 * TransactionDetails Component
 * Shows full details of a single transaction
 *
 * This is the main orchestration component that composes:
 * - TransactionHeader: Header with dynamic styling and action buttons
 * - TransactionTabs: Tab navigation
 * - TransactionDetailsTab: Details tab content
 * - TransactionContactsTab: Contacts tab with AI suggestions
 * - Various modal dialogs
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Transaction } from "@/types";
import ExportModal from "./ExportModal";
import AuditTransactionModal from "./AuditTransactionModal";
import { ToastContainer } from "./Toast";
import { useToast } from "../hooks/useToast";
import { useTransactionStatusUpdate } from "../hooks/useTransactionStatusUpdate";

// Import from transactionDetails module
import {
  useTransactionDetails,
  useTransactionTabs,
  useTransactionCommunications,
  useSuggestedContacts,
  useTransactionMessages,
  useTransactionAttachments,
  TransactionHeader,
  TransactionTabs,
  TransactionDetailsTab,
  TransactionEmailsTab,
  TransactionContactsTab,
  TransactionMessagesTab,
  TransactionAttachmentsTab,
  ExportSuccessMessage,
  ArchivePromptModal,
  DeleteConfirmModal,
  UnlinkEmailModal,
  EmailViewModal,
  RejectReasonModal,
  EditContactsModal,
} from "./transactionDetailsModule";
import type { AutoLinkResult } from "./transactionDetailsModule/components/modals/EditContactsModal";

interface TransactionDetailsComponentProps {
  transaction: Transaction;
  onClose: () => void;
  onTransactionUpdated?: () => void;
  /** If true, shows approve/reject buttons instead of export/delete (for pending review) */
  isPendingReview?: boolean;
  /** User ID for feedback recording */
  userId?: string;
  /** Toast handler for success messages - if provided, uses parent's toast system */
  onShowSuccess?: (message: string) => void;
  /** Toast handler for error messages - if provided, uses parent's toast system */
  onShowError?: (message: string) => void;
}

/**
 * TransactionDetails Component
 * Shows full details of a single transaction
 */
function TransactionDetails({
  transaction: transactionProp,
  onClose,
  onTransactionUpdated,
  isPendingReview = false,
  userId,
  onShowSuccess,
  onShowError,
}: TransactionDetailsComponentProps) {
  // Local state to track transaction - allows updates from edit modal
  // without requiring parent to re-render
  const [transaction, setTransaction] = useState(transactionProp);

  // Sync with prop when parent updates (e.g., list refresh)
  useEffect(() => {
    setTransaction(transactionProp);
  }, [transactionProp]);

  // Toast notifications - use props if provided, otherwise use local fallback
  const localToast = useToast();
  const showSuccess = onShowSuccess || localToast.showSuccess;
  const showError = onShowError || localToast.showError;

  // Transaction data hook
  const {
    communications,
    contactAssignments,
    resolvedSuggestions,
    loading,
    loadDetails,
    setCommunications,
    setResolvedSuggestions,
    updateSuggestedContacts,
  } = useTransactionDetails(transaction);

  // Tab state hook
  const { activeTab, setActiveTab } = useTransactionTabs();

  // Communications hook
  const {
    unlinkingCommId,
    showUnlinkConfirm,
    viewingEmail,
    setShowUnlinkConfirm,
    setViewingEmail,
    handleUnlinkCommunication,
  } = useTransactionCommunications();

  // Suggested contacts hook
  const {
    processingContactId,
    processingAll,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    handleAcceptAll,
  } = useSuggestedContacts(transaction);

  // Messages hook
  const {
    messages: textMessages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
  } = useTransactionMessages(transaction);

  // Attachments hook
  const {
    attachments,
    loading: attachmentsLoading,
    error: attachmentsError,
    count: attachmentCount,
  } = useTransactionAttachments(transaction);

  // Transaction status update hook
  const { state: statusState, approve, reject, restore } = useTransactionStatusUpdate(userId);
  const { isApproving, isRejecting, isRestoring } = statusState;

  // Filter emails only for Details tab (exclude SMS/iMessage)
  const emailCommunications = useMemo(() => {
    return communications.filter((comm) => {
      const channel = comm.channel || comm.communication_type;
      // Exclude SMS and iMessage - only show emails
      return channel !== 'sms' && channel !== 'imessage';
    });
  }, [communications]);

  // Modal states
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [showArchivePrompt, setShowArchivePrompt] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showRejectReasonModal, setShowRejectReasonModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showEditContactsModal, setShowEditContactsModal] = useState<boolean>(false);

  // Check if transaction was rejected
  const isRejected = transaction.detection_status === "rejected";

  // Export handlers
  const handleExportComplete = async (result: unknown): Promise<void> => {
    const exportResult = result as { path?: string };
    setShowExportModal(false);
    setExportSuccess(exportResult.path || null);
    setTimeout(() => setExportSuccess(null), 5000);

    // Refresh transaction data to reflect any date changes made during export
    try {
      const refreshed = await window.api.transactions.getDetails(transaction.id);
      if (refreshed.success && refreshed.transaction) {
        setTransaction(refreshed.transaction as Transaction);
        loadDetails();
        onTransactionUpdated?.();
      }
    } catch (err) {
      console.error("Failed to refresh transaction after export:", err);
    }

    if (transaction.status === "active") {
      setShowArchivePrompt(true);
    }
  };

  const handleArchive = async (): Promise<void> => {
    try {
      await window.api.transactions.update(transaction.id, { status: "closed" });
      setShowArchivePrompt(false);
      onTransactionUpdated?.();
    } catch (err) {
      console.error("Failed to archive transaction:", err);
    }
  };

  const handleDelete = async (): Promise<void> => {
    try {
      await window.api.transactions.delete(transaction.id);
      setShowDeleteConfirm(false);
      onClose();
      onTransactionUpdated?.();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      showError("Failed to delete transaction. Please try again.");
    }
  };

  // Status update handlers
  const handleApprove = useCallback(async (): Promise<void> => {
    await approve(transaction.id, {
      onSuccess: () => {
        showSuccess("Transaction approved successfully!");
        onClose();
        onTransactionUpdated?.();
      },
      onError: (error) => showError(error),
    });
  }, [approve, transaction.id, onClose, onTransactionUpdated, showSuccess, showError]);

  const handleReject = useCallback(async (): Promise<void> => {
    await reject(transaction.id, rejectReason, {
      onSuccess: () => {
        showSuccess("Transaction rejected");
        setShowRejectReasonModal(false);
        setRejectReason("");
        onClose();
        onTransactionUpdated?.();
      },
      onError: (error) => showError(error),
    });
  }, [reject, transaction.id, rejectReason, onClose, onTransactionUpdated, showSuccess, showError]);

  const handleRestore = useCallback(async (): Promise<void> => {
    await restore(transaction.id, {
      onSuccess: () => {
        showSuccess("Transaction restored to active");
        onClose();
        onTransactionUpdated?.();
      },
      onError: (error) => showError(error),
    });
  }, [restore, transaction.id, onClose, onTransactionUpdated, showSuccess, showError]);

  // Communication handlers
  const handleUnlink = useCallback(
    async (comm: typeof showUnlinkConfirm) => {
      if (!comm) return;
      await handleUnlinkCommunication(
        comm,
        () => {
          setCommunications((prev) => prev.filter((c) => c.id !== comm.id));
          showSuccess("Email unlinked from transaction");
        },
        showError
      );
    },
    [handleUnlinkCommunication, setCommunications, showSuccess, showError]
  );

  // Suggested contacts handlers with callbacks
  const suggestionCallbacks = {
    onUpdateResolvedSuggestions: setResolvedSuggestions,
    resolvedSuggestions,
    updateSuggestedContacts,
    loadDetails,
    onTransactionUpdated,
    showSuccess,
    showError,
  };

  const handleAcceptSuggestionWithCallbacks = useCallback(
    (suggestion: typeof resolvedSuggestions[0]) => {
      handleAcceptSuggestion(suggestion, suggestionCallbacks);
    },
    [handleAcceptSuggestion, suggestionCallbacks]
  );

  const handleRejectSuggestionWithCallbacks = useCallback(
    (suggestion: typeof resolvedSuggestions[0]) => {
      handleRejectSuggestion(suggestion, suggestionCallbacks);
    },
    [handleRejectSuggestion, suggestionCallbacks]
  );

  const handleAcceptAllWithCallbacks = useCallback(() => {
    handleAcceptAll(resolvedSuggestions, {
      ...suggestionCallbacks,
      clearSuggestions: () => setResolvedSuggestions([]),
    });
  }, [handleAcceptAll, resolvedSuggestions, suggestionCallbacks, setResolvedSuggestions]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[70vh] max-h-[90vh] flex flex-col">
        {/* Header */}
        <TransactionHeader
          transaction={transaction}
          isPendingReview={isPendingReview}
          isRejected={isRejected}
          isApproving={isApproving}
          isRejecting={isRejecting}
          isRestoring={isRestoring}
          onClose={onClose}
          onShowRejectReasonModal={() => setShowRejectReasonModal(true)}
          onShowEditModal={() => setShowEditModal(true)}
          onApprove={handleApprove}
          onRestore={handleRestore}
          onShowExportModal={() => setShowExportModal(true)}
          onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
        />

        {/* Export Success Message */}
        {exportSuccess && <ExportSuccessMessage message={exportSuccess} />}

        {/* Tabs */}
        <TransactionTabs
          activeTab={activeTab}
          contactCount={contactAssignments.length}
          messageCount={textMessages.length}
          emailCount={emailCommunications.length}
          attachmentCount={attachmentCount}
          onTabChange={setActiveTab}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && (
            <TransactionDetailsTab
              transaction={transaction}
              contactAssignments={contactAssignments}
              loading={loading}
            />
          )}

          {activeTab === "emails" && (
            <TransactionEmailsTab
              communications={emailCommunications}
              loading={loading}
              unlinkingCommId={unlinkingCommId}
              onViewEmail={setViewingEmail}
              onShowUnlinkConfirm={setShowUnlinkConfirm}
            />
          )}

          {activeTab === "contacts" && (
            <TransactionContactsTab
              resolvedSuggestions={resolvedSuggestions}
              contactAssignments={contactAssignments}
              loading={loading}
              processingContactId={processingContactId}
              processingAll={processingAll}
              onAcceptSuggestion={handleAcceptSuggestionWithCallbacks}
              onRejectSuggestion={handleRejectSuggestionWithCallbacks}
              onAcceptAll={handleAcceptAllWithCallbacks}
              onEditContacts={() => setShowEditContactsModal(true)}
            />
          )}

          {activeTab === "messages" && (
            <TransactionMessagesTab
              messages={textMessages}
              loading={messagesLoading}
              error={messagesError}
              userId={userId}
              transactionId={transaction.id}
              propertyAddress={transaction.property_address}
              onMessagesChanged={refreshMessages}
              onShowSuccess={showSuccess}
              onShowError={showError}
            />
          )}

          {activeTab === "attachments" && (
            <TransactionAttachmentsTab
              attachments={attachments}
              loading={attachmentsLoading}
              error={attachmentsError}
            />
          )}
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          transaction={transaction}
          userId={transaction.user_id}
          onClose={() => setShowExportModal(false)}
          onExportComplete={handleExportComplete}
        />
      )}

      {/* Archive Prompt */}
      {showArchivePrompt && (
        <ArchivePromptModal
          onKeepActive={() => setShowArchivePrompt(false)}
          onArchive={handleArchive}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          propertyAddress={transaction.property_address}
          onCancel={() => setShowDeleteConfirm(false)}
          onDelete={handleDelete}
        />
      )}

      {/* Unlink Email Confirmation */}
      {showUnlinkConfirm && (
        <UnlinkEmailModal
          communication={showUnlinkConfirm}
          isUnlinking={unlinkingCommId === showUnlinkConfirm.id}
          onCancel={() => setShowUnlinkConfirm(null)}
          onUnlink={() => handleUnlink(showUnlinkConfirm)}
        />
      )}

      {/* Full Email View Modal */}
      {viewingEmail && (
        <EmailViewModal
          email={viewingEmail}
          onClose={() => setViewingEmail(null)}
          onRemoveFromTransaction={() => {
            setViewingEmail(null);
            setShowUnlinkConfirm(viewingEmail);
          }}
        />
      )}

      {/* Reject Reason Modal */}
      {showRejectReasonModal && (
        <RejectReasonModal
          rejectReason={rejectReason}
          onRejectReasonChange={setRejectReason}
          isRejecting={isRejecting}
          onCancel={() => {
            setShowRejectReasonModal(false);
            setRejectReason("");
          }}
          onReject={handleReject}
        />
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && (
        <AuditTransactionModal
          userId={transaction.user_id}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updatedTransaction) => {
            setShowEditModal(false);
            // Update local transaction state with fresh data from save
            setTransaction(updatedTransaction);
            loadDetails();
            onTransactionUpdated?.();
          }}
          editTransaction={transaction}
        />
      )}

      {/* Edit Contacts Modal - Direct access to contact assignment */}
      {showEditContactsModal && (
        <EditContactsModal
          transaction={transaction}
          onClose={() => setShowEditContactsModal(false)}
          onSave={(autoLinkResults?: AutoLinkResult[]) => {
            loadDetails();
            onTransactionUpdated?.();
            // TASK-1126: Show detailed toast with auto-link results
            if (autoLinkResults && autoLinkResults.length > 0) {
              const totalEmails = autoLinkResults.reduce(
                (sum, r) => sum + r.emailsLinked,
                0
              );
              const totalMessages = autoLinkResults.reduce(
                (sum, r) => sum + r.messagesLinked,
                0
              );
              if (totalEmails > 0 || totalMessages > 0) {
                const parts: string[] = [];
                if (totalEmails > 0) {
                  parts.push(`${totalEmails} email${totalEmails !== 1 ? "s" : ""}`);
                }
                if (totalMessages > 0) {
                  parts.push(
                    `${totalMessages} message thread${totalMessages !== 1 ? "s" : ""}`
                  );
                }
                showSuccess(`Contacts updated. Linked ${parts.join(" and ")}.`);
              } else {
                showSuccess("Contacts updated successfully");
              }
            } else {
              showSuccess("Contacts updated successfully");
            }
          }}
        />
      )}

      {/* Toast Notifications - only render if using local toast */}
      {!onShowSuccess && !onShowError && (
        <ToastContainer toasts={localToast.toasts} onDismiss={localToast.removeToast} />
      )}
    </div>
  );
}

export default TransactionDetails;
