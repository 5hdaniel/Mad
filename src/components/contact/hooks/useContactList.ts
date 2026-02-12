import { useState, useCallback, useEffect, useRef } from "react";
import { ExtendedContact, TransactionWithRoles } from "../types";

interface UseContactListOptions {
  onContactDeleted?: (contactId: string) => void;
}

interface UseContactListResult {
  contacts: ExtendedContact[];
  loading: boolean;
  error: string | undefined;
  loadContacts: () => Promise<void>;
  silentLoadContacts: () => Promise<void>;
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
  // External contacts (from macOS Contacts app, etc.)
  externalContacts: ExtendedContact[];
  externalContactsLoading: boolean;
  reloadExternalContacts: () => void;
}

/**
 * Hook for managing contact list operations
 * Handles loading, removing contacts, and related modal states
 */
export function useContactList(userId: string, options?: UseContactListOptions): UseContactListResult {
  const { onContactDeleted } = options || {};
  const [contacts, setContacts] = useState<ExtendedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [blockingTransactions, setBlockingTransactions] = useState<
    TransactionWithRoles[]
  >([]);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [contactToRemove, setContactToRemove] = useState<string | null>(null);

  // External contacts state (from macOS Contacts app, etc.)
  const [externalContacts, setExternalContacts] = useState<ExtendedContact[]>([]);
  const [externalContactsLoading, setExternalContactsLoading] = useState(false);
  const externalContactsLoadedRef = useRef(false);
  const isMountedRef = useRef(true);

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

  // Silent refresh - doesn't show loading state (use after importing contacts)
  const silentLoadContacts = useCallback(async () => {
    try {
      const result = await window.api.contacts.getAll(userId);
      if (!isMountedRef.current) return;

      if (result.success) {
        setContacts(result.contacts || []);
      }
      // Don't set error on silent refresh - keep existing state
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("Silent refresh failed:", err);
    }
  }, [userId]);

  useEffect(() => {
    isMountedRef.current = true;
    loadContacts();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadContacts]);

  /**
   * Load external contacts (from macOS Contacts app, etc.)
   * These are contacts not yet imported into the database.
   */
  const loadExternalContacts = useCallback(async () => {
    if (externalContactsLoadedRef.current) return;
    if (!isMountedRef.current) return;

    setExternalContactsLoading(true);
    try {
      const result = await window.api.contacts.getAvailable(userId);
      if (!isMountedRef.current) return;

      if (result.success && result.contacts) {
        // Mark as external for visual distinction (SourcePill display)
        const external = result.contacts.map((c: ExtendedContact) => ({
          ...c,
          is_message_derived: true,
        }));
        setExternalContacts(external);
        externalContactsLoadedRef.current = true;
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("Failed to load external contacts:", err);
    } finally {
      if (isMountedRef.current) {
        setExternalContactsLoading(false);
      }
    }
  }, [userId]);

  // Load external contacts on mount
  useEffect(() => {
    loadExternalContacts();
  }, [loadExternalContacts]);

  // Force reload external contacts (resets cache and fetches fresh data)
  const reloadExternalContacts = useCallback(() => {
    externalContactsLoadedRef.current = false;
    loadExternalContacts();
  }, [loadExternalContacts]);

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
        // Optimistic update - remove from state directly without full reload
        setContacts((prev) => prev.filter((c) => c.id !== contactToRemove));
        // Notify parent of deletion (for clearing stale visual state)
        onContactDeleted?.(contactToRemove);
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
  }, [contactToRemove, onContactDeleted]);

  return {
    contacts,
    loading,
    error,
    loadContacts,
    silentLoadContacts,
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
    // External contacts (from macOS Contacts app, etc.)
    externalContacts,
    externalContactsLoading,
    reloadExternalContacts,
  };
}

export default useContactList;
