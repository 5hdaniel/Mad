import { useState, useCallback, useEffect } from "react";
import { ExtendedContact, TransactionWithRoles } from "../types";

interface UseContactListResult {
  contacts: ExtendedContact[];
  loading: boolean;
  error: string | undefined;
  loadContacts: () => Promise<void>;
  handleRemoveContact: (contactId: string) => Promise<void>;
  handleConfirmRemove: () => Promise<void>;
  showRemoveConfirmation: boolean;
  setShowRemoveConfirmation: (show: boolean) => void;
  contactToRemove: string | null;
  setContactToRemove: (id: string | null) => void;
  showBlockingModal: boolean;
  setShowBlockingModal: (show: boolean) => void;
  blockingTransactions: TransactionWithRoles[];
  setBlockingTransactions: (txns: TransactionWithRoles[]) => void;
}

/**
 * Hook for managing contact list operations
 * Handles loading, removing contacts, and related modal states
 */
export function useContactList(userId: string): UseContactListResult {
  const [contacts, setContacts] = useState<ExtendedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [blockingTransactions, setBlockingTransactions] = useState<
    TransactionWithRoles[]
  >([]);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [contactToRemove, setContactToRemove] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.api.contacts.getAll(userId);

      if (result.success) {
        setContacts(result.contacts || []);
      } else {
        setError(result.error || "Failed to load contacts");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load contacts";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleRemoveContact = useCallback(async (contactId: string) => {
    try {
      // First check if contact has associated transactions
      const checkResult = await window.api.contacts.checkCanDelete(contactId);

      if (checkResult.error) {
        alert(`Failed to check contact: ${checkResult.error}`);
        return;
      }

      // If contact has associated transactions, show blocking modal
      if (!checkResult.canDelete) {
        alert(
          `Cannot delete contact: They are associated with ${checkResult.transactionCount || 0} transactions`,
        );
        return;
      }

      // Otherwise show custom confirmation modal
      setContactToRemove(contactId);
      setShowRemoveConfirmation(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check contact";
      alert(`Failed to check contact: ${errorMessage}`);
    }
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    if (!contactToRemove) return;

    try {
      const result = await window.api.contacts.remove(contactToRemove);
      if (result.success) {
        loadContacts();
      } else {
        alert(`Failed to remove contact: ${result.error}`);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove contact";
      alert(`Failed to remove contact: ${errorMessage}`);
    } finally {
      setShowRemoveConfirmation(false);
      setContactToRemove(null);
    }
  }, [contactToRemove, loadContacts]);

  return {
    contacts,
    loading,
    error,
    loadContacts,
    handleRemoveContact,
    handleConfirmRemove,
    showRemoveConfirmation,
    setShowRemoveConfirmation,
    contactToRemove,
    setContactToRemove,
    showBlockingModal,
    setShowBlockingModal,
    blockingTransactions,
    setBlockingTransactions,
  };
}

export default useContactList;
