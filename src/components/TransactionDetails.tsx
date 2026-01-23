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
  TransactionMessagesTab,
  TransactionAttachmentsTab,
  DeleteConfirmModal,
  UnlinkEmailModal,
  EmailViewModal,
  RejectReasonModal,
  EditContactsModal,
} from "./transactionDetailsModule";
// Import ReviewNotesPanel for displaying broker feedback (BACKLOG-395)
import { ReviewNotesPanel } from "./transactionDetailsModule/components/ReviewNotesPanel";
// Import Submit for Review components (BACKLOG-391)
import { SubmitForReviewModal } from "./transactionDetailsModule/components/modals/SubmitForReviewModal";
import { useSubmitForReview } from "./transactionDetailsModule/hooks/useSubmitForReview";
import type { AutoLinkResult } from "./transactionDetailsModule/components/modals/EditContactsModal";

import type { TransactionTab } from "./transactionDetailsModule/types";

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
  /** Initial tab to display when opening TransactionDetails */
  initialTab?: TransactionTab;
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
  initialTab = "overview",
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

  // Tab state hook - use initialTab prop
  const { activeTab, setActiveTab } = useTransactionTabs(initialTab);

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

  // Filter emails only for Details tab
  // Must explicitly check for 'email' to match the SQL count query
  // which uses: communication_type = 'email'
  const emailCommunications = useMemo(() => {
    return communications.filter((comm) => {
      const channel = comm.channel || comm.communication_type;
      // Only include emails - exclude sms, imessage, text, and undefined
      return channel === 'email';
    });
  }, [communications]);

  // Note: conversation/message count for tabs now uses transaction.text_thread_count
  // (stored count) instead of computing from dynamically loaded textMessages array.
  // This ensures correct counts display even before data loads (BACKLOG-415).

  // Modal states
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showRejectReasonModal, setShowRejectReasonModal] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showEditContactsModal, setShowEditContactsModal] = useState<boolean>(false);
  const [syncingCommunications, setSyncingCommunications] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);

  // Submit for Review hook (BACKLOG-391)
  const isResubmit = transaction.submission_status === "needs_changes";
  const {
    isSubmitting,
    progress: submitProgress,
    error: submitError,
    submit: handleSubmitForReview,
    reset: resetSubmit,
  } = useSubmitForReview({
    transactionId: transaction.id,
    isResubmit,
    onSuccess: (submissionId) => {
      showSuccess(`Transaction submitted successfully! ID: ${submissionId.slice(0, 8)}...`);
      // Refresh transaction data
      loadDetails();
      onTransactionUpdated?.();
    },
    onError: (error) => {
      showError(`Submission failed: ${error}`);
    },
  });

  // Check if transaction was rejected
  const isRejected = transaction.detection_status === "rejected";

  // Export handlers
  const handleExportComplete = async (_result: unknown): Promise<void> => {
    setShowExportModal(false);
    // The ExportModal now shows its own success screen (step 5) with buttons
    // No need to show a separate success bar in TransactionDetails

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
    // Note: Close transaction prompt is now handled within ExportModal (step 4)
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
        async () => {
          setCommunications((prev) => prev.filter((c) => c.id !== comm.id));
          // Refresh transaction to update email_count after unlink
          const refreshed = await window.api.transactions.getDetails(transaction.id);
          if (refreshed.success && refreshed.transaction) {
            setTransaction(refreshed.transaction as Transaction);
          }
          showSuccess("Email unlinked from transaction");
        },
        showError
      );
    },
    [handleUnlinkCommunication, setCommunications, showSuccess, showError, transaction.id]
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

  // Handle emails changed (attached/unlinked) - refresh both communications and transaction
  const handleEmailsChanged = useCallback(async () => {
    await loadDetails();
    // Refresh transaction to update email_count
    const refreshed = await window.api.transactions.getDetails(transaction.id);
    if (refreshed.success && refreshed.transaction) {
      setTransaction(refreshed.transaction as Transaction);
    }
  }, [loadDetails, transaction.id]);

  // Sync communications handler - re-runs auto-link for all contacts
  const handleSyncCommunications = useCallback(async () => {
    setSyncingCommunications(true);
    try {
      // Cast to access resyncAutoLink - method is defined in preload but window.d.ts augmentation has issues with tsc
      const result = await (window.api.transactions as typeof window.api.transactions & {
        resyncAutoLink: (transactionId: string) => Promise<{
          success: boolean;
          contactsProcessed?: number;
          totalEmailsLinked?: number;
          totalMessagesLinked?: number;
          totalAlreadyLinked?: number;
          totalErrors?: number;
          error?: string;
        }>;
      }).resyncAutoLink(transaction.id);
      if (result.success) {
        const totalLinked = (result.totalEmailsLinked || 0) + (result.totalMessagesLinked || 0);
        if (totalLinked > 0) {
          showSuccess(`Synced ${totalLinked} communication${totalLinked !== 1 ? "s" : ""} (${result.totalEmailsLinked || 0} emails, ${result.totalMessagesLinked || 0} message threads)`);
          // Refresh to show newly linked communications
          await handleEmailsChanged();
          refreshMessages();
        } else if (result.totalAlreadyLinked && result.totalAlreadyLinked > 0) {
          showSuccess(`All communications already linked (${result.totalAlreadyLinked} found)`);
        } else {
          showSuccess("No new communications found to link");
        }
      } else {
        showError(result.error || "Failed to sync communications");
      }
    } catch (err) {
      console.error("Failed to sync communications:", err);
      showError("Failed to sync communications. Please try again.");
    } finally {
      setSyncingCommunications(false);
    }
  }, [transaction.id, showSuccess, showError, handleEmailsChanged, refreshMessages]);

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
          isSubmitting={isSubmitting}
          onClose={onClose}
          onShowRejectReasonModal={() => setShowRejectReasonModal(true)}
          onShowEditModal={() => setShowEditModal(true)}
          onApprove={handleApprove}
          onRestore={handleRestore}
          onShowExportModal={() => setShowExportModal(true)}
          onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
          onShowSubmitModal={() => setShowSubmitModal(true)}
        />

        {/* Tabs */}
        <TransactionTabs
          activeTab={activeTab}
          conversationCount={transaction.text_thread_count || 0}
          emailCount={transaction.email_count || 0}
          attachmentCount={attachmentCount}
          onTabChange={setActiveTab}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Review Notes Panel - shown when broker requests changes (BACKLOG-395) */}
          {transaction.submission_status === "needs_changes" && transaction.last_review_notes && (
            <ReviewNotesPanel
              reviewNotes={transaction.last_review_notes}
              onResubmit={() => {
                // Will be handled by TransactionHeader submit button
                // This is just a visual shortcut
              }}
            />
          )}

          {activeTab === "overview" && (
            <TransactionDetailsTab
              transaction={transaction}
              contactAssignments={contactAssignments}
              loading={loading}
              onEditContacts={() => setShowEditContactsModal(true)}
              resolvedSuggestions={resolvedSuggestions}
              processingContactId={processingContactId}
              processingAll={processingAll}
              onAcceptSuggestion={handleAcceptSuggestionWithCallbacks}
              onRejectSuggestion={handleRejectSuggestionWithCallbacks}
              onAcceptAll={handleAcceptAllWithCallbacks}
              onSyncCommunications={handleSyncCommunications}
              syncingCommunications={syncingCommunications}
            />
          )}

          {activeTab === "emails" && (
            <TransactionEmailsTab
              communications={emailCommunications}
              loading={loading}
              unlinkingCommId={unlinkingCommId}
              onViewEmail={setViewingEmail}
              onShowUnlinkConfirm={setShowUnlinkConfirm}
              onSyncCommunications={handleSyncCommunications}
              syncingCommunications={syncingCommunications}
              hasContacts={contactAssignments.length > 0}
              userId={userId}
              transactionId={transaction.id}
              propertyAddress={transaction.property_address}
              onEmailsChanged={handleEmailsChanged}
              onShowSuccess={showSuccess}
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
              auditStartDate={transaction.started_at}
              auditEndDate={transaction.closed_at}
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

      {/* Submit for Review Modal (BACKLOG-391) */}
      {showSubmitModal && (
        <SubmitForReviewModal
          transaction={transaction}
          messageCount={emailCommunications.length + textMessages.length}
          attachmentCount={attachmentCount}
          isSubmitting={isSubmitting}
          progress={submitProgress}
          error={submitError}
          onCancel={() => {
            setShowSubmitModal(false);
            resetSubmit();
          }}
          onSubmit={handleSubmitForReview}
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
