/**
 * useAuditContactAssignment Hook
 * Manages contact selection, role assignment, and lazy contact loading.
 * Extracted from useAuditTransaction.ts (TASK-2261)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact, Transaction } from "../../../electron/types/models";
import type { ContactAssignment, ContactAssignments } from "./types";
import logger from "../../utils/logger";

interface UseAuditContactAssignmentProps {
  userId: string;
  propertyAddress: string;
  editTransaction?: Transaction;
}

export interface UseAuditContactAssignmentReturn {
  contactAssignments: ContactAssignments;
  selectedContactIds: string[];
  setSelectedContactIds: React.Dispatch<React.SetStateAction<string[]>>;
  assignContact: (role: string, contactId: string, isPrimary?: boolean, notes?: string) => void;
  removeContact: (role: string, contactId: string) => void;
  // Contact loading state (lazy-loaded when reaching step 2)
  contacts: Contact[];
  contactsLoading: boolean;
  contactsError: string | null;
  refreshContacts: () => Promise<void>;
  silentRefreshContacts: () => Promise<void>;
  // External contacts (from macOS Contacts app, etc.)
  externalContacts: Contact[];
  externalContactsLoading: boolean;
  // Trigger lazy loading of contacts (called when step transitions to 2)
  triggerLazyLoad: () => void;
}

export function useAuditContactAssignment({
  userId,
  propertyAddress,
  editTransaction,
}: UseAuditContactAssignmentProps): UseAuditContactAssignmentReturn {
  // Contact assignments state
  const [contactAssignments, setContactAssignments] = useState<ContactAssignments>({});

  // Selected contact IDs for step 2 (select contacts)
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Contact loading state (lazy-loaded when reaching step 2)
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState<boolean>(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // External contacts state (from macOS Contacts app, etc.)
  const [externalContacts, setExternalContacts] = useState<Contact[]>([]);
  const [externalContactsLoading, setExternalContactsLoading] = useState<boolean>(false);

  // Track if contacts have been loaded (prevents duplicate loads in StrictMode and step navigation)
  const contactsLoadedRef = useRef(false);
  const externalContactsLoadedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Load contacts - called lazily when reaching step 2, or when explicitly refreshed
   */
  const loadContacts = useCallback(async (forceRefresh = false, showLoading = true) => {
    if (contactsLoadedRef.current && !forceRefresh) {
      return;
    }

    if (!isMountedRef.current) return;

    if (showLoading) {
      setContactsLoading(true);
    }
    setContactsError(null);

    try {
      const result = propertyAddress
        ? await window.api.contacts.getSortedByActivity(userId, propertyAddress)
        : await window.api.contacts.getAll(userId);

      if (!isMountedRef.current) return;

      if (result.success) {
        setContacts(result.contacts || []);
        contactsLoadedRef.current = true;
      } else {
        setContactsError(result.error || "Failed to load contacts");
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      logger.error("Failed to load contacts:", err);
      setContactsError("Unable to load contacts");
    } finally {
      if (isMountedRef.current) {
        setContactsLoading(false);
      }
    }
  }, [userId, propertyAddress]);

  /**
   * Load external contacts (from macOS Contacts app, etc.)
   */
  const loadExternalContacts = useCallback(async () => {
    if (externalContactsLoadedRef.current) return;
    if (!isMountedRef.current) return;

    setExternalContactsLoading(true);
    try {
      const result = await window.api.contacts.getAvailable(userId);
      if (!isMountedRef.current) return;

      if (result.success && result.contacts) {
        const external = result.contacts.map((c: Contact) => ({
          ...c,
          is_message_derived: true,
        }));
        setExternalContacts(external);
        externalContactsLoadedRef.current = true;
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      logger.error("Failed to load external contacts:", err);
    } finally {
      if (isMountedRef.current) {
        setExternalContactsLoading(false);
      }
    }
  }, [userId]);

  /**
   * Trigger lazy load of contacts and external contacts.
   * Called by the composition hook when step transitions to 2.
   */
  const triggerLazyLoad = useCallback(() => {
    if (!contactsLoadedRef.current) {
      loadContacts();
    }
    if (!externalContactsLoadedRef.current) {
      loadExternalContacts();
    }
  }, [loadContacts, loadExternalContacts]);

  // Wrapper to expose refresh functionality that always forces reload
  const refreshContacts = useCallback((): Promise<void> => {
    return loadContacts(true, true);
  }, [loadContacts]);

  // Silent refresh - forces reload without showing loading state
  const silentRefreshContacts = useCallback((): Promise<void> => {
    return loadContacts(true, false);
  }, [loadContacts]);

  /**
   * Pre-fill contact assignments when editing an existing transaction
   * TASK-1038: Fetch full transaction details (including contact_assignments)
   */
  useEffect(() => {
    if (!editTransaction) return;

    const populateContactAssignments = (
      contactAssignmentsData: Array<{
        id: string;
        contact_id: string;
        contact_name?: string;
        contact_email?: string;
        contact_phone?: string;
        contact_company?: string;
        role?: string;
        specific_role?: string;
        is_primary?: number;
        notes?: string;
      }> | undefined,
      suggestedContactsJson: string | undefined
    ) => {
      if (contactAssignmentsData && contactAssignmentsData.length > 0) {
        const assignments: ContactAssignments = {};
        contactAssignmentsData.forEach((ca) => {
          const role = ca.role || ca.specific_role;
          if (role && ca.contact_id) {
            if (!assignments[role]) {
              assignments[role] = [];
            }
            assignments[role].push({
              contactId: ca.contact_id,
              contactName: ca.contact_name || "",
              contactEmail: ca.contact_email,
              contactPhone: ca.contact_phone,
              contactCompany: ca.contact_company,
              isPrimary: ca.is_primary === 1,
              notes: ca.notes || "",
            });
          }
        });
        setContactAssignments(assignments);
      } else if (suggestedContactsJson) {
        try {
          const suggestedContacts = JSON.parse(suggestedContactsJson);
          const assignments: ContactAssignments = {};
          if (Array.isArray(suggestedContacts)) {
            suggestedContacts.forEach((sc: { role?: string; contact_id?: string; is_primary?: boolean; notes?: string }) => {
              if (sc.role && sc.contact_id) {
                if (!assignments[sc.role]) {
                  assignments[sc.role] = [];
                }
                assignments[sc.role].push({
                  contactId: sc.contact_id,
                  isPrimary: sc.is_primary || false,
                  notes: sc.notes || "",
                });
              }
            });
          }
          setContactAssignments(assignments);
        } catch {
          // Invalid JSON, leave assignments empty
        }
      }
    };

    const fetchFullDetails = async () => {
      try {
        const result = await window.api.transactions.getDetails(editTransaction.id);
        if (result.success && result.transaction) {
          const fullTransaction = result.transaction as Transaction & {
            contact_assignments?: Array<{
              id: string;
              contact_id: string;
              contact_name?: string;
              contact_email?: string;
              contact_phone?: string;
              contact_company?: string;
              role?: string;
              specific_role?: string;
              is_primary?: number;
              notes?: string;
            }>;
          };

          populateContactAssignments(
            fullTransaction.contact_assignments,
            fullTransaction.suggested_contacts
          );
        } else {
          const extendedTransaction = editTransaction as Transaction & {
            contact_assignments?: Array<{
              id: string;
              contact_id: string;
              contact_name?: string;
              contact_email?: string;
              contact_phone?: string;
              contact_company?: string;
              role?: string;
              specific_role?: string;
              is_primary?: number;
              notes?: string;
            }>;
          };
          populateContactAssignments(
            extendedTransaction.contact_assignments,
            editTransaction.suggested_contacts
          );
        }
      } catch (err) {
        logger.error("[useAuditContactAssignment] Failed to fetch transaction details:", err);
        const extendedTransaction = editTransaction as Transaction & {
          contact_assignments?: Array<{
            id: string;
            contact_id: string;
            contact_name?: string;
            contact_email?: string;
            contact_phone?: string;
            contact_company?: string;
            role?: string;
            specific_role?: string;
            is_primary?: number;
            notes?: string;
          }>;
        };
        populateContactAssignments(
          extendedTransaction.contact_assignments,
          editTransaction.suggested_contacts
        );
      }
    };

    fetchFullDetails();
  }, [editTransaction]);

  /**
   * Assign contact to a role
   */
  const assignContact = useCallback((
    role: string,
    contactId: string,
    isPrimary: boolean = false,
    notes: string = "",
  ): void => {
    setContactAssignments(prev => {
      const existing = prev[role] || [];
      const existingIndex = existing.findIndex(
        (c: ContactAssignment) => c.contactId === contactId,
      );

      if (existingIndex !== -1) {
        const updated = [...existing];
        updated[existingIndex] = { contactId, isPrimary, notes };
        return { ...prev, [role]: updated };
      } else {
        return { ...prev, [role]: [...existing, { contactId, isPrimary, notes }] };
      }
    });
  }, []);

  /**
   * Remove contact from a role
   */
  const removeContact = useCallback((role: string, contactId: string): void => {
    setContactAssignments(prev => {
      const existing = prev[role] || [];
      const filtered = existing.filter(
        (c: ContactAssignment) => c.contactId !== contactId,
      );
      return { ...prev, [role]: filtered };
    });
  }, []);

  return {
    contactAssignments,
    selectedContactIds,
    setSelectedContactIds,
    assignContact,
    removeContact,
    contacts,
    contactsLoading,
    contactsError,
    refreshContacts,
    silentRefreshContacts,
    externalContacts,
    externalContactsLoading,
    triggerLazyLoad,
  };
}
