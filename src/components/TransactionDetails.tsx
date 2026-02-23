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
  useAttachmentCounts,
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
import { isEmailMessage } from '@/utils/channelHelpers';
import logger from '../utils/logger';
import { OfflineNotice } from './common/OfflineNotice';

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
    loadCommunications,
    setCommunications,
    setResolvedSuggestions,
    updateSuggestedContacts,
  } = useTransactionDetails(transaction);

  // Tab state hook - use initialTab prop
  const { activeTab, setActiveTab } = useTransactionTabs(initialTab);

  // PERF: Load only the channel needed for the active tab.
  // Overview only needs contacts (loaded by loadOverview on mount).
  // Emails tab loads only email comms; Messages tab loads only text comms.
  const loadedChannelsRef = React.useRef<Set<string>>(new Set());
  // Reset loaded channels when transaction changes
  useEffect(() => {
    loadedChannelsRef.current.clear();
  }, [transaction.id]);
  useEffect(() => {
    if (activeTab === "emails" && !loadedChannelsRef.current.has("email")) {
      loadedChannelsRef.current.add("email");
      loadCommunications("email");
    } else if (activeTab === "messages" && !loadedChannelsRef.current.has("text")) {
      loadedChannelsRef.current.add("text");
      loadCommunications("text");
    } else if (activeTab === "attachments" && !loadedChannelsRef.current.has("email")) {
      // Attachments come from emails
      loadedChannelsRef.current.add("email");
      loadCommunications("email");
    }
  }, [activeTab, loadCommunications]);

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

  // Messages hook — uses pre-loaded communications to avoid duplicate getDetails call
  const {
    messages: textMessages,
    loading: messagesLoading,
    error: messagesError,
  } = useTransactionMessages(transaction, communications);

  // Refresh messages by reloading text communications from the parent state.
  // This ensures derivedMessages (from useTransactionMessages) updates correctly,
  // unlike the local refresh which updates fetchedMessages but gets overridden
  // by the non-null derivedMessages. (TASK-2023)
  const refreshMessages = useCallback(async () => {
    await loadCommunications("text");
  }, [loadCommunications]);

  // Attachments hook — uses pre-loaded communications to avoid duplicate getDetails call
  const {
    attachments,
    loading: attachmentsLoading,
    error: attachmentsError,
    count: attachmentCount,
  } = useTransactionAttachments(transaction, communications);

  // Accurate attachment counts from database (TASK-1781)
  // PERF: Lazy-loaded — only fetched when Submit modal opens (takes ~1.3s)
  const { counts: dbAttachmentCounts, refresh: loadAttachmentCounts } = useAttachmentCounts(
    transaction.id,
    undefined,
    undefined,
    true, // lazy: don't auto-load on mount
  );

  // Transaction status update hook
  const { state: statusState, approve, reject, restore } = useTransactionStatusUpdate(userId);
  const { isApproving, isRejecting, isRestoring } = statusState;

  // Filter emails only for Details tab
  const emailCommunications = useMemo(() => {
    return communications.filter((comm) => isEmailMessage(comm));
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
  const [syncingMessages, setSyncingMessages] = useState<boolean>(false);
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
      logger.error("Failed to refresh transaction after export:", err);
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
      logger.error("Failed to delete transaction:", err);
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

  // Sync communications handler - fetches from provider and auto-links
  // BACKLOG-457: Now fetches NEW emails from Gmail/Outlook, not just local DB
  const handleSyncCommunications = useCallback(async () => {
    setSyncingCommunications(true);
    try {
      // Cast to access syncAndFetchEmails - method is defined in preload but window.d.ts augmentation has issues with tsc
      const result = await (window.api.transactions as typeof window.api.transactions & {
        syncAndFetchEmails: (transactionId: string) => Promise<{
          success: boolean;
          provider?: "gmail" | "outlook";
          emailsFetched?: number;
          emailsStored?: number;
          totalEmailsLinked?: number;
          totalMessagesLinked?: number;
          totalAlreadyLinked?: number;
          totalErrors?: number;
          error?: string;
          message?: string;
        }>;
      }).syncAndFetchEmails(transaction.id);
      if (result.success) {
        const emailsFetched = result.emailsFetched || 0;
        const emailsStored = result.emailsStored || 0;
        const totalLinked = (result.totalEmailsLinked || 0) + (result.totalMessagesLinked || 0);

        if (emailsStored > 0 || totalLinked > 0) {
          const parts: string[] = [];
          if (emailsStored > 0) {
            parts.push(`${emailsStored} new email${emailsStored !== 1 ? "s" : ""} fetched`);
          }
          if (result.totalEmailsLinked && result.totalEmailsLinked > 0) {
            parts.push(`${result.totalEmailsLinked} email${result.totalEmailsLinked !== 1 ? "s" : ""} linked`);
          }
          if (result.totalMessagesLinked && result.totalMessagesLinked > 0) {
            parts.push(`${result.totalMessagesLinked} message thread${result.totalMessagesLinked !== 1 ? "s" : ""} linked`);
          }
          showSuccess(parts.join(", "));
          // Refresh to show newly fetched/linked communications
          loadDetails();
          refreshMessages();
        } else if (emailsFetched > 0 && emailsStored === 0) {
          showSuccess(`Checked ${emailsFetched} emails - all already in database`);
        } else if (result.totalAlreadyLinked && result.totalAlreadyLinked > 0) {
          showSuccess(`All communications already linked (${result.totalAlreadyLinked} found)`);
        } else if (result.message) {
          showSuccess(result.message);
        } else {
          showSuccess("No new communications found");
        }
      } else {
        showError(result.error || "Failed to sync communications");
      }
    } catch (err) {
      logger.error("Failed to sync communications:", err);
      showError("Failed to sync communications. Please try again.");
    } finally {
      setSyncingCommunications(false);
    }
  }, [transaction.id, showSuccess, showError, loadDetails, refreshMessages]);

  // Sync messages handler - re-links text messages from assigned contacts (phone-based matching)
  const handleSyncMessages = useCallback(async () => {
    setSyncingMessages(true);
    try {
      const result = await (window.api.transactions as typeof window.api.transactions & {
        resyncAutoLink: (transactionId: string) => Promise<{
          success: boolean;
          totalEmailsLinked?: number;
          totalMessagesLinked?: number;
          totalAlreadyLinked?: number;
          totalErrors?: number;
          message?: string;
          error?: string;
        }>;
      }).resyncAutoLink(transaction.id);

      if (result.success) {
        const messagesLinked = result.totalMessagesLinked || 0;
        const alreadyLinked = result.totalAlreadyLinked || 0;

        if (messagesLinked > 0) {
          showSuccess(`${messagesLinked} message thread${messagesLinked !== 1 ? "s" : ""} linked`);
          refreshMessages();
        } else if (alreadyLinked > 0) {
          showSuccess(`All messages already linked (${alreadyLinked} found)`);
        } else if (result.message === "No contacts to sync") {
          showSuccess("No contacts assigned — assign contacts first to sync messages");
        } else {
          showSuccess("No new messages found for assigned contacts");
        }
      } else {
        showError(result.error || "Failed to sync messages");
      }
    } catch (err) {
      logger.error("Failed to sync messages:", err);
      showError("Failed to sync messages. Please try again.");
    } finally {
      setSyncingMessages(false);
    }
  }, [transaction.id, showSuccess, showError, refreshMessages]);

  // Show a loading overlay while initial data loads
  if (loading && contactAssignments.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[70vh] max-h-[90vh] flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 mt-4">Loading transaction...</p>
        </div>
      </div>
    );
  }

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
          onShowSubmitModal={async () => {
            try {
              const refreshed = await window.api.transactions.getDetails(transaction.id);
              if (refreshed.success && refreshed.transaction) {
                setTransaction(refreshed.transaction as Transaction);
              }
            } catch (err) {
              logger.error("Failed to refresh transaction before submit:", err);
            }
            // Load attachment counts now (deferred from mount for perf)
            loadAttachmentCounts();
            setShowSubmitModal(true);
          }}
        />

        {/* Tabs */}
        <TransactionTabs
          activeTab={activeTab}
          conversationCount={transaction.text_thread_count || 0}
          emailCount={transaction.email_count || 0}
          attachmentCount={attachmentCount}
          onTabChange={setActiveTab}
        />

        <OfflineNotice />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Review Notes Panel - shown when broker requests changes (BACKLOG-395) */}
          {transaction.submission_status === "needs_changes" && transaction.last_review_notes && (
            <ReviewNotesPanel
              reviewNotes={transaction.last_review_notes}
            />
          )}

          {activeTab === "overview" && (
            <TransactionDetailsTab
              transaction={transaction}
              contactAssignments={contactAssignments}
              loading={loading}
              userId={userId}
              onEdit={() => setShowEditModal(true)}
              onEditContacts={() => setShowEditContactsModal(true)}
              onDelete={() => setShowDeleteConfirm(true)}
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
              onEmailsChanged={loadDetails}
              onShowSuccess={showSuccess}
              auditStartDate={transaction.started_at ? String(transaction.started_at) : undefined}
              auditEndDate={transaction.closed_at ? String(transaction.closed_at) : undefined}
            />
          )}


          {activeTab === "messages" && (
            <TransactionMessagesTab
              messages={textMessages}
              loading={messagesLoading || loading}
              error={messagesError}
              userId={userId}
              transactionId={transaction.id}
              propertyAddress={transaction.property_address}
              onMessagesChanged={refreshMessages}
              onShowSuccess={showSuccess}
              onShowError={showError}
              auditStartDate={transaction.started_at}
              auditEndDate={transaction.closed_at}
              onSyncMessages={handleSyncMessages}
              syncingMessages={syncingMessages}
              hasContacts={contactAssignments.length > 0}
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
                showSuccess("Contacts updated. Use 'Sync' on the Emails tab to fetch new emails from your provider.");
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
          emailThreadCount={transaction.email_count || 0}
          textThreadCount={transaction.text_thread_count || 0}
          attachmentCount={dbAttachmentCounts.total}
          emailAttachmentCount={dbAttachmentCounts.emailAttachments}
          totalSizeBytes={dbAttachmentCounts.totalSizeBytes}
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
