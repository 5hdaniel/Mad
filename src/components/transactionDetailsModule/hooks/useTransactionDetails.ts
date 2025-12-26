/**
 * useTransactionDetails Hook
 * Manages transaction details data fetching and contact assignment state
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import type { Contact, Transaction } from "@/types";
import type {
  SuggestedContact,
  ResolvedSuggestedContact,
  ContactAssignment,
  Communication,
} from "../types";

interface UseTransactionDetailsResult {
  // Data
  communications: Communication[];
  contactAssignments: ContactAssignment[];
  resolvedSuggestions: ResolvedSuggestedContact[];
  loading: boolean;

  // Actions
  loadDetails: () => Promise<void>;
  setCommunications: React.Dispatch<React.SetStateAction<Communication[]>>;
  setResolvedSuggestions: React.Dispatch<React.SetStateAction<ResolvedSuggestedContact[]>>;
  updateSuggestedContacts: (remainingSuggestions: SuggestedContact[]) => Promise<void>;
}

/**
 * Hook for managing transaction details data
 */
export function useTransactionDetails(
  transaction: Transaction
): UseTransactionDetailsResult {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [contactAssignments, setContactAssignments] = useState<ContactAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvedSuggestions, setResolvedSuggestions] = useState<ResolvedSuggestedContact[]>([]);

  /**
   * Parse and memoize suggested contacts from transaction
   */
  const suggestedContacts = useMemo((): SuggestedContact[] => {
    if (!transaction.suggested_contacts) return [];
    try {
      const parsed = JSON.parse(transaction.suggested_contacts);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (sc: SuggestedContact) => sc.role && sc.contact_id
        );
      }
      return [];
    } catch {
      return [];
    }
  }, [transaction.suggested_contacts]);

  /**
   * Load transaction details
   */
  const loadDetails = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getDetails(transaction.id);

      if (result.success) {
        setCommunications((result.transaction as any).communications || []);
        setContactAssignments(
          (result.transaction as any).contact_assignments || []
        );
      }
    } catch (err) {
      console.error("Failed to load details:", err);
    } finally {
      setLoading(false);
    }
  }, [transaction.id]);

  /**
   * Resolve contact details for all suggested contacts
   */
  useEffect(() => {
    const resolveContacts = async () => {
      if (suggestedContacts.length === 0) {
        setResolvedSuggestions([]);
        return;
      }

      try {
        const contactsResult = await window.api.contacts.getAll(transaction.user_id);
        if (contactsResult.success && contactsResult.contacts) {
          const contactMap = new Map(
            contactsResult.contacts.map((c: Contact) => [c.id, c])
          );
          const resolved = suggestedContacts.map((sc) => ({
            ...sc,
            contact: contactMap.get(sc.contact_id),
          }));
          setResolvedSuggestions(resolved);
        }
      } catch (err) {
        console.error("Failed to resolve suggested contacts:", err);
        // Still show suggestions without contact details
        setResolvedSuggestions(suggestedContacts.map((sc) => ({ ...sc })));
      }
    };

    resolveContacts();
  }, [suggestedContacts, transaction.user_id]);

  /**
   * Load details when transaction changes
   */
  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  /**
   * Helper to update suggested_contacts in database after processing
   */
  const updateSuggestedContacts = useCallback(
    async (remainingSuggestions: SuggestedContact[]): Promise<void> => {
      const newValue =
        remainingSuggestions.length > 0
          ? JSON.stringify(remainingSuggestions)
          : null;
      await window.api.transactions.update(transaction.id, {
        suggested_contacts: newValue,
      });
    },
    [transaction.id]
  );

  return {
    communications,
    contactAssignments,
    resolvedSuggestions,
    loading,
    loadDetails,
    setCommunications,
    setResolvedSuggestions,
    updateSuggestedContacts,
  };
}
