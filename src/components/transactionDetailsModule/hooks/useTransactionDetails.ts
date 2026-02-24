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
import { isTextMessage, isEmailMessage } from "@/utils/channelHelpers";
import logger from '../../../utils/logger';

interface UseTransactionDetailsResult {
  // Data
  communications: Communication[];
  contactAssignments: ContactAssignment[];
  resolvedSuggestions: ResolvedSuggestedContact[];
  loading: boolean;

  // Actions
  loadDetails: () => Promise<void>;
  loadCommunications: (channelFilter: "email" | "text") => Promise<void>;
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
   * Load full transaction details (including communications).
   * Called on-demand when user navigates to emails/messages/attachments tabs.
   */
  const loadDetails = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getDetails(transaction.id);

      if (result.success && result.transaction) {
        setCommunications(result.transaction.communications || []);
        setContactAssignments(
          result.transaction.contact_assignments || []
        );
      }
    } catch (err) {
      logger.error("Failed to load details:", err);
    } finally {
      setLoading(false);
    }
  }, [transaction.id]);

  /**
   * PERF: Load only emails or only texts — avoids fetching all 74K+ communications.
   * Used when user navigates to the Emails or Messages tab.
   */
  const loadCommunications = useCallback(async (channelFilter: "email" | "text"): Promise<void> => {
    try {
      setLoading(true);
      // getCommunications returns { success, transaction: { communications, contact_assignments } }
      const result = await window.api.transactions.getCommunications(transaction.id, channelFilter) as {
        success: boolean;
        transaction?: { communications?: Communication[]; contact_assignments?: ContactAssignment[] };
      };

      if (result.success && result.transaction) {
        // Merge with existing communications (don't overwrite other channel)
        setCommunications(prev => {
          const newComms: Communication[] = result.transaction?.communications || [];
          // Keep only comms from the OTHER channel; replace the fetched channel entirely.
          const kept = channelFilter === "text"
            ? prev.filter((c: Communication) => !isTextMessage(c))
            : prev.filter((c: Communication) => !isEmailMessage(c));
          return [...kept, ...newComms];
        });
        setContactAssignments(result.transaction.contact_assignments || []);
      }
    } catch (err) {
      logger.error(`Failed to load ${channelFilter} communications:`, err);
    } finally {
      setLoading(false);
    }
  }, [transaction.id]);

  /**
   * PERF: Load lightweight overview (contacts only, no communications).
   * Used for initial render of overview tab — avoids expensive 3-way JOIN.
   */
  const loadOverview = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const result = await window.api.transactions.getOverview(transaction.id);

      if (result.success && result.transaction) {
        setContactAssignments(
          result.transaction.contact_assignments || []
        );
      }
    } catch (err) {
      logger.error("Failed to load overview:", err);
      // Fallback to full details if overview not available
      try {
        const fallback = await window.api.transactions.getDetails(transaction.id);
        if (fallback.success && fallback.transaction) {
          setContactAssignments(fallback.transaction.contact_assignments || []);
        }
      } catch (e) {
        logger.error("Fallback getDetails also failed:", e);
      }
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
        logger.error("Failed to resolve suggested contacts:", err);
        // Still show suggestions without contact details
        setResolvedSuggestions(suggestedContacts.map((sc) => ({ ...sc })));
      }
    };

    resolveContacts();
  }, [suggestedContacts, transaction.user_id]);

  /**
   * PERF: Load lightweight overview on mount (contacts only, no communications).
   * Full details (loadDetails) are loaded on-demand when user navigates to
   * emails/messages/attachments tabs.
   */
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

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
    loadCommunications,
    setCommunications,
    setResolvedSuggestions,
    updateSuggestedContacts,
  };
}
