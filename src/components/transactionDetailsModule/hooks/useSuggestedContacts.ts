/**
 * useSuggestedContacts Hook
 * Manages AI-suggested contact acceptance/rejection operations
 */
import { useState, useCallback } from "react";
import type { Transaction } from "@/types";
import type { ResolvedSuggestedContact, SuggestedContact } from "../types";

interface UseSuggestedContactsResult {
  processingContactId: string | null;
  processingAll: boolean;
  handleAcceptSuggestion: (
    suggestion: ResolvedSuggestedContact,
    callbacks: AcceptRejectCallbacks
  ) => Promise<void>;
  handleRejectSuggestion: (
    suggestion: ResolvedSuggestedContact,
    callbacks: AcceptRejectCallbacks
  ) => Promise<void>;
  handleAcceptAll: (
    suggestions: ResolvedSuggestedContact[],
    callbacks: AcceptAllCallbacks
  ) => Promise<void>;
}

interface AcceptRejectCallbacks {
  onUpdateResolvedSuggestions: (
    updater: (prev: ResolvedSuggestedContact[]) => ResolvedSuggestedContact[]
  ) => void;
  resolvedSuggestions: ResolvedSuggestedContact[];
  updateSuggestedContacts: (remaining: SuggestedContact[]) => Promise<void>;
  loadDetails: () => Promise<void>;
  onTransactionUpdated?: () => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

interface AcceptAllCallbacks extends AcceptRejectCallbacks {
  clearSuggestions: () => void;
}

/**
 * Hook for managing suggested contact operations
 */
export function useSuggestedContacts(
  transaction: Transaction
): UseSuggestedContactsResult {
  const [processingContactId, setProcessingContactId] = useState<string | null>(null);
  const [processingAll, setProcessingAll] = useState<boolean>(false);

  /**
   * Handle accepting a single suggested contact
   */
  const handleAcceptSuggestion = useCallback(
    async (
      suggestion: ResolvedSuggestedContact,
      callbacks: AcceptRejectCallbacks
    ): Promise<void> => {
      if (processingContactId || processingAll) return;

      const {
        onUpdateResolvedSuggestions,
        resolvedSuggestions,
        updateSuggestedContacts,
        loadDetails,
        onTransactionUpdated,
        showSuccess,
        showError,
      } = callbacks;

      try {
        setProcessingContactId(suggestion.contact_id);

        // Assign the contact to the transaction
        // Note: Backend auto-links text messages after assignment
        await window.api.transactions.assignContact(
          transaction.id,
          suggestion.contact_id,
          suggestion.role,
          undefined, // roleCategory
          suggestion.is_primary || false,
          suggestion.notes
        );

        // Record feedback (accepted as-is)
        if (window.api.feedback?.recordRole) {
          await window.api.feedback.recordRole(transaction.user_id, {
            transactionId: transaction.id,
            contactId: suggestion.contact_id,
            originalRole: suggestion.role,
            correctedRole: suggestion.role,
          });
        }

        // Remove from local state
        onUpdateResolvedSuggestions((prev) =>
          prev.filter((s) => s.contact_id !== suggestion.contact_id)
        );

        // Update database
        const remaining = resolvedSuggestions.filter(
          (s) => s.contact_id !== suggestion.contact_id
        );
        await updateSuggestedContacts(remaining);

        // Refresh transaction data
        await loadDetails();
        if (onTransactionUpdated) {
          onTransactionUpdated();
        }
        showSuccess("Contact suggestion accepted");
      } catch (err) {
        console.error("Failed to accept suggestion:", err);
        showError("Failed to accept contact suggestion. Please try again.");
      } finally {
        setProcessingContactId(null);
      }
    },
    [processingContactId, processingAll, transaction.id, transaction.user_id]
  );

  /**
   * Handle rejecting a single suggested contact
   */
  const handleRejectSuggestion = useCallback(
    async (
      suggestion: ResolvedSuggestedContact,
      callbacks: AcceptRejectCallbacks
    ): Promise<void> => {
      if (processingContactId || processingAll) return;

      const {
        onUpdateResolvedSuggestions,
        resolvedSuggestions,
        updateSuggestedContacts,
        onTransactionUpdated,
        showSuccess,
        showError,
      } = callbacks;

      try {
        setProcessingContactId(suggestion.contact_id);

        // Record feedback (rejected - empty correctedRole indicates rejection)
        if (window.api.feedback?.recordRole) {
          await window.api.feedback.recordRole(transaction.user_id, {
            transactionId: transaction.id,
            contactId: suggestion.contact_id,
            originalRole: suggestion.role,
            correctedRole: "", // Empty indicates rejection
          });
        }

        // Remove from local state
        onUpdateResolvedSuggestions((prev) =>
          prev.filter((s) => s.contact_id !== suggestion.contact_id)
        );

        // Update database
        const remaining = resolvedSuggestions.filter(
          (s) => s.contact_id !== suggestion.contact_id
        );
        await updateSuggestedContacts(remaining);

        // Notify parent
        if (onTransactionUpdated) {
          onTransactionUpdated();
        }
        showSuccess("Contact suggestion rejected");
      } catch (err) {
        console.error("Failed to reject suggestion:", err);
        showError("Failed to reject contact suggestion. Please try again.");
      } finally {
        setProcessingContactId(null);
      }
    },
    [processingContactId, processingAll, transaction.id, transaction.user_id]
  );

  /**
   * Handle accepting all suggested contacts
   */
  const handleAcceptAll = useCallback(
    async (
      suggestions: ResolvedSuggestedContact[],
      callbacks: AcceptAllCallbacks
    ): Promise<void> => {
      if (processingContactId || processingAll || suggestions.length === 0) return;

      const {
        clearSuggestions,
        updateSuggestedContacts,
        loadDetails,
        onTransactionUpdated,
        showSuccess,
        showError,
      } = callbacks;

      try {
        setProcessingAll(true);

        for (const suggestion of suggestions) {
          // Assign the contact
          await window.api.transactions.assignContact(
            transaction.id,
            suggestion.contact_id,
            suggestion.role,
            undefined,
            suggestion.is_primary || false,
            suggestion.notes
          );

          // Record feedback
          if (window.api.feedback?.recordRole) {
            await window.api.feedback.recordRole(transaction.user_id, {
              transactionId: transaction.id,
              contactId: suggestion.contact_id,
              originalRole: suggestion.role,
              correctedRole: suggestion.role,
            });
          }
        }

        // Note: Backend auto-links text messages after each assignment

        // Clear all suggestions
        await updateSuggestedContacts([]);
        clearSuggestions();

        // Refresh transaction data
        await loadDetails();
        if (onTransactionUpdated) {
          onTransactionUpdated();
        }
        showSuccess("All contact suggestions accepted");
      } catch (err) {
        console.error("Failed to accept all suggestions:", err);
        showError("Failed to accept all suggestions. Please try again.");
      } finally {
        setProcessingAll(false);
      }
    },
    [processingContactId, processingAll, transaction.id, transaction.user_id]
  );

  return {
    processingContactId,
    processingAll,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    handleAcceptAll,
  };
}
