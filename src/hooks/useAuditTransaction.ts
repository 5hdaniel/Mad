/**
 * useAuditTransaction Hook
 * Manages state and business logic for AuditTransactionModal
 * Extracted to support component decomposition (TASK-974)
 *
 * Contact Loading Optimization:
 * Contacts are loaded lazily when user reaches step 2, not on modal open.
 * This eliminates visible lag when opening the modal since contacts aren't
 * needed until step 2 (Contact Assignment). Contacts are loaded once and
 * shared between steps 2 and 3 to prevent repeated API calls when navigating.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  SPECIFIC_ROLES,
  ROLE_TO_CATEGORY,
} from "../constants/contactRoles";
import type { Transaction, Contact } from "../../electron/types/models";
import logger from '../utils/logger';

// Type definitions
export interface AddressData {
  property_address: string;
  property_street: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  property_coordinates: Coordinates | null;
  transaction_type: string;
  started_at: string;  // ISO8601 date string - when representation began
  closing_deadline?: string;  // ISO8601 date string - scheduled closing date
  closed_at?: string;  // ISO8601 date string - when transaction ended (optional, null = ongoing)
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AddressSuggestion {
  placeId?: string;
  place_id?: string;
  description?: string;
  formatted_address?: string;
  main_text?: string;
  secondary_text?: string;
}

export interface ContactAssignment {
  contactId: string;
  contactName?: string;  // TASK-1030: Added for edit mode pre-population
  contactEmail?: string;
  contactPhone?: string;
  contactCompany?: string;
  isPrimary: boolean;
  notes: string;
}

export interface ContactAssignments {
  [role: string]: ContactAssignment[];
}

interface AddressDetails {
  formatted_address?: string;
  street?: string;
  city?: string;
  state_short?: string;
  state?: string;
  zip?: string;
  coordinates?: Coordinates | null;
}

interface AddressDetailsResult {
  success: boolean;
  formatted_address?: string;
  address?: AddressDetails;
  street?: string;
  city?: string;
  state_short?: string;
  state?: string;
  zip?: string;
  coordinates?: Coordinates | null;
}

export interface UseAuditTransactionProps {
  userId: string;
  editTransaction?: Transaction;
  onClose: () => void;
  onSuccess: (transaction: Transaction) => void;
}

export interface UseAuditTransactionReturn {
  // State
  step: number;
  loading: boolean;
  error: string | null;
  isEditing: boolean;
  addressData: AddressData;
  contactAssignments: ContactAssignments;
  selectedContactIds: string[];
  showAddressAutocomplete: boolean;
  addressSuggestions: AddressSuggestion[];

  // Auto-detect start date state (TASK-1974)
  startDateMode?: "auto" | "manual";
  autoDetectedDate: string | null | undefined;
  isAutoDetecting: boolean;

  // Contact loading state (lazy-loaded when reaching step 2)
  contacts: Contact[];
  contactsLoading: boolean;
  contactsError: string | null;
  refreshContacts: () => Promise<void>;
  silentRefreshContacts: () => Promise<void>;

  // External contacts (from macOS Contacts app, etc.)
  externalContacts: Contact[];
  externalContactsLoading: boolean;

  // Setters
  setAddressData: React.Dispatch<React.SetStateAction<AddressData>>;
  setSelectedContactIds: React.Dispatch<React.SetStateAction<string[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setStartDateMode: (mode: "auto" | "manual") => void;

  // Handlers
  handleAddressChange: (value: string) => Promise<void>;
  selectAddress: (suggestion: AddressSuggestion) => Promise<void>;
  assignContact: (role: string, contactId: string, isPrimary?: boolean, notes?: string) => void;
  removeContact: (role: string, contactId: string) => void;
  handleNextStep: () => void;
  handlePreviousStep: () => void;
}

/**
 * Get default start date (3 months ago from today)
 * Typical recent transaction timeframe for real estate audits
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

const initialAddressData: AddressData = {
  property_address: "",
  property_street: "",
  property_city: "",
  property_state: "",
  property_zip: "",
  property_coordinates: null,
  transaction_type: "purchase",
  started_at: getDefaultStartDate(),
  closing_deadline: undefined,
  closed_at: getTodayDate(),
};

export function useAuditTransaction({
  userId,
  editTransaction,
  onClose,
  onSuccess,
}: UseAuditTransactionProps): UseAuditTransactionReturn {
  const isEditing = !!editTransaction;

  // Step state
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track original values for change detection in edit mode
  const [originalAddressData, setOriginalAddressData] = useState<AddressData | null>(null);

  // Address state
  const [addressData, setAddressData] = useState<AddressData>(initialAddressData);
  const [showAddressAutocomplete, setShowAddressAutocomplete] = useState<boolean>(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [sessionToken] = useState<string>(() => `session_${Date.now()}_${Math.random()}`);

  // Contact assignments state
  const [contactAssignments, setContactAssignments] = useState<ContactAssignments>({});

  // Selected contact IDs for step 2 (select contacts)
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Contact loading state (lazy-loaded when reaching step 2)
  // Contacts aren't needed until step 2, so we defer loading to eliminate modal open lag
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState<boolean>(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // External contacts state (from macOS Contacts app, etc.)
  const [externalContacts, setExternalContacts] = useState<Contact[]>([]);
  const [externalContactsLoading, setExternalContactsLoading] = useState<boolean>(false);

  // Track if contacts have been loaded (prevents duplicate loads in StrictMode and step navigation)
  const contactsLoadedRef = useRef(false);
  // Track if external contacts have been loaded
  const externalContactsLoadedRef = useRef(false);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Auto-detect start date state (TASK-1974, TASK-1980: default to "manual")
  const [startDateMode, setStartDateModeState] = useState<"auto" | "manual" | null>(null);
  const [autoDetectedDate, setAutoDetectedDate] = useState<string | null | undefined>(undefined);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // TASK-1980: Read user preference for start date default mode on mount
  // Only applies when creating a new audit (not editing)
  useEffect(() => {
    if (isEditing) {
      setStartDateModeState("manual");
      return;
    }
    if (!userId) return;
    const loadStartDatePreference = async () => {
      try {
        const result = await window.api.preferences.get(userId) as {
          success: boolean;
          preferences?: {
            audit?: { startDateDefault?: "auto" | "manual" };
          };
        };
        if (result.success && result.preferences?.audit?.startDateDefault) {
          const preferred = result.preferences.audit.startDateDefault;
          if (preferred === "auto" || preferred === "manual") {
            setStartDateModeState(preferred);
            return;
          }
        }
        setStartDateModeState("manual");
      } catch {
        setStartDateModeState("manual");
      }
    };
    loadStartDatePreference();
  }, [isEditing, userId]);

  /**
   * Load contacts - called lazily when reaching step 2, or when explicitly refreshed
   * Lifted from ContactAssignmentStep to prevent N API calls (one per step)
   *
   * Lazy Loading Strategy:
   * Contacts are NOT loaded when the modal opens. Instead, they're loaded when
   * the user navigates to step 2 (Contact Assignment). This eliminates the visible
   * lag on modal open since contact fetching can take noticeable time.
   *
   * The forceRefresh parameter allows explicit refresh after imports.
   */
  const loadContacts = useCallback(async (forceRefresh = false, showLoading = true) => {
    // Skip if already loaded and not a forced refresh (prevents StrictMode double-call)
    if (contactsLoadedRef.current && !forceRefresh) {
      return;
    }

    if (!isMountedRef.current) return;

    // Only show loading state if requested (silent refresh passes false)
    if (showLoading) {
      setContactsLoading(true);
    }
    setContactsError(null);

    try {
      // Use address-sorted contacts if we have an address (likely by step 2)
      const propertyAddress = addressData.property_address;
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
  }, [userId, addressData.property_address]);

  /**
   * Load external contacts (from macOS Contacts app, etc.)
   * Called lazily when reaching step 2, similar to loadContacts.
   */
  const loadExternalContacts = useCallback(async () => {
    if (externalContactsLoadedRef.current) return;
    if (!isMountedRef.current) return;

    setExternalContactsLoading(true);
    try {
      const result = await window.api.contacts.getAvailable(userId);
      if (!isMountedRef.current) return;

      if (result.success && result.contacts) {
        // Mark as external for SourcePill display
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

  // Setup mounted ref for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Lazy load contacts when step changes to 2 (first contact step)
  useEffect(() => {
    if (step === 2 && !contactsLoadedRef.current) {
      loadContacts();
    }
  }, [step, loadContacts]);

  // Lazy load external contacts when step changes to 2
  useEffect(() => {
    if (step === 2 && !externalContactsLoadedRef.current) {
      loadExternalContacts();
    }
  }, [step, loadExternalContacts]);

  // Wrapper to expose refresh functionality that always forces reload
  // Returns a Promise so callers can await the refresh
  const refreshContacts = useCallback((): Promise<void> => {
    return loadContacts(true, true); // forceRefresh=true, showLoading=true
  }, [loadContacts]);

  // Silent refresh - forces reload without showing loading state
  // Use after importing contacts to avoid jarring UI refresh
  const silentRefreshContacts = useCallback((): Promise<void> => {
    return loadContacts(true, false); // forceRefresh=true, showLoading=false
  }, [loadContacts]);

  /**
   * Handle start date mode change (TASK-1974)
   * When switching to "auto", re-trigger detection if contacts are selected.
   * When switching to "manual", preserve the current date value.
   */
  const setStartDateMode = useCallback((mode: "auto" | "manual") => {
    setStartDateModeState(mode);
    if (mode === "auto" && autoDetectedDate) {
      // Re-apply the auto-detected date
      setAddressData(prev => ({ ...prev, started_at: autoDetectedDate }));
    }
  }, [autoDetectedDate]);

  /**
   * Auto-detect the earliest communication date for selected contacts (TASK-1974)
   */
  const detectStartDate = useCallback(async (contactIds: string[]) => {
    if (contactIds.length === 0 || !userId) return;
    if (!isMountedRef.current) return;

    setIsAutoDetecting(true);
    try {
      // Type assertion for new API method (TASK-1974)
      // Required because TypeScript has a resolution issue with large interface types
      // in window.d.ts - same pattern used in useSubmissionSync.ts
      const transactions = window.api.transactions as typeof window.api.transactions & {
        getEarliestCommunicationDate: (
          contactIds: string[],
          userId: string,
        ) => Promise<{ success: boolean; date?: string | null; error?: string }>;
      };
      const result = await transactions.getEarliestCommunicationDate(
        contactIds,
        userId,
      );

      if (!isMountedRef.current) return;

      if (result.success && result.date) {
        const dateStr = result.date.split("T")[0]; // YYYY-MM-DD
        setAutoDetectedDate(dateStr);
        // Only update address data if still in auto mode
        setStartDateModeState(currentMode => {
          if (currentMode === "auto") {
            setAddressData(prev => ({ ...prev, started_at: dateStr }));
          }
          return currentMode;
        });
      } else {
        setAutoDetectedDate(null);
        // Keep default (60 days ago) if no communications found
      }
    } catch {
      if (!isMountedRef.current) return;
      setAutoDetectedDate(null);
    } finally {
      if (isMountedRef.current) {
        setIsAutoDetecting(false);
      }
    }
  }, [userId]);

  // Trigger auto-detect when selected contacts change and mode is "auto" (TASK-1974)
  useEffect(() => {
    if (startDateMode === "auto" && selectedContactIds.length > 0 && !isEditing) {
      detectStartDate(selectedContactIds);
    }
  }, [selectedContactIds, startDateMode, isEditing, detectStartDate]);

  /**
   * Initialize Google Places API (if available)
   */
  useEffect(() => {
    const initializeAPI = async (): Promise<void> => {
      if (window.api?.address?.initialize) {
        try {
          await window.api.address.initialize("");
        } catch (initError: unknown) {
          logger.warn(
            "[AuditTransaction] Address verification not available:",
            initError,
          );
        }
      }
    };
    initializeAPI();
  }, []);

  /**
   * Pre-fill form when editing an existing transaction
   * TASK-1038: Fetch full transaction details (including contact_assignments)
   * since the transaction passed from parent may not have them populated.
   */
  useEffect(() => {
    if (!editTransaction) return;

    // Helper function to populate form data from transaction
    const populateFormData = (txn: Transaction) => {
      let coordinates: Coordinates | null = null;
      if (txn.property_coordinates) {
        try {
          coordinates = JSON.parse(txn.property_coordinates);
        } catch {
          // Invalid JSON, leave as null
        }
      }

      const prefillData: AddressData = {
        property_address: txn.property_address || "",
        property_street: txn.property_street || "",
        property_city: txn.property_city || "",
        property_state: txn.property_state || "",
        property_zip: txn.property_zip || "",
        property_coordinates: coordinates,
        transaction_type: txn.transaction_type || "purchase",
        started_at: txn.started_at
          ? (typeof txn.started_at === "string"
              ? txn.started_at.split("T")[0]
              : txn.started_at.toISOString().split("T")[0])
          : getDefaultStartDate(),
        closing_deadline: txn.closing_deadline
          ? (typeof txn.closing_deadline === "string"
              ? txn.closing_deadline.split("T")[0]
              : txn.closing_deadline.toISOString().split("T")[0])
          : undefined,
        closed_at: txn.closed_at
          ? (typeof txn.closed_at === "string"
              ? txn.closed_at.split("T")[0]
              : txn.closed_at.toISOString().split("T")[0])
          : undefined,
      };

      setAddressData(prefillData);
      setOriginalAddressData(prefillData);
    };

    // Helper function to populate contact assignments from transaction data
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
        // Use actual contact assignments from junction table
        const assignments: ContactAssignments = {};
        contactAssignmentsData.forEach((ca) => {
          // Use role field first, fall back to specific_role (TASK-995 fix)
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
        // Fall back to suggested_contacts JSON for legacy data
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

    // Immediately populate form data from the passed transaction
    populateFormData(editTransaction);

    // TASK-1038: Fetch full transaction details to get contact_assignments
    // The transaction passed from parent (e.g., Transactions.tsx) typically
    // comes from getAll() which doesn't include contact_assignments.
    // We need to call getDetails() to get the full data including contacts.
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

          // Populate contact assignments from the fetched data
          populateContactAssignments(
            fullTransaction.contact_assignments,
            fullTransaction.suggested_contacts
          );
        } else {
          // API call failed - fall back to data from passed transaction
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
        logger.error("[useAuditTransaction] Failed to fetch transaction details:", err);
        // On error, fall back to data from passed transaction
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
   * Handle address input change with autocomplete
   */
  const handleAddressChange = useCallback(async (value: string): Promise<void> => {
    setAddressData(prev => ({ ...prev, property_address: value }));

    if (value.length > 3 && window.api?.address?.getSuggestions) {
      try {
        const result = await window.api.address.getSuggestions(value, sessionToken);
        if (result.success && result.suggestions && result.suggestions.length > 0) {
          setAddressSuggestions(result.suggestions);
          setShowAddressAutocomplete(true);
        } else {
          setAddressSuggestions([]);
          setShowAddressAutocomplete(false);
        }
      } catch (fetchError: unknown) {
        logger.error("[AuditTransaction] Failed to fetch address suggestions:", fetchError);
        setShowAddressAutocomplete(false);
      }
    } else {
      setShowAddressAutocomplete(false);
      setAddressSuggestions([]);
    }
  }, [sessionToken]);

  /**
   * Select address from autocomplete
   */
  const selectAddress = useCallback(async (suggestion: AddressSuggestion): Promise<void> => {
    if (!window.api?.address?.getDetails) {
      setAddressData(prev => ({
        ...prev,
        property_address: suggestion.formatted_address || suggestion.description || "",
      }));
      setShowAddressAutocomplete(false);
      return;
    }

    try {
      const placeId = suggestion.place_id || suggestion.placeId || "";
      const result: AddressDetailsResult = await window.api.address.getDetails(placeId);
      if (result.success) {
        const addr: AddressDetails = result.address || {};
        setAddressData(prev => ({
          ...prev,
          property_address:
            addr.formatted_address ||
            result.formatted_address ||
            suggestion.formatted_address ||
            suggestion.description ||
            "",
          property_street: addr.street || result.street || "",
          property_city: addr.city || result.city || "",
          property_state:
            addr.state_short ||
            addr.state ||
            result.state_short ||
            result.state ||
            "",
          property_zip: addr.zip || result.zip || "",
          property_coordinates: addr.coordinates || result.coordinates || null,
        }));
      } else {
        setAddressData(prev => ({
          ...prev,
          property_address: suggestion.formatted_address || suggestion.description || "",
        }));
      }
    } catch (detailsError: unknown) {
      logger.error("[AuditTransaction] Failed to get address details:", detailsError);
      setAddressData(prev => ({
        ...prev,
        property_address: suggestion.formatted_address || suggestion.description || "",
      }));
    }
    setShowAddressAutocomplete(false);
  }, []);

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

  /**
   * Detect changes between original and current address data
   */
  const getAddressChanges = useCallback((): Record<string, { original: string; corrected: string }> | null => {
    if (!originalAddressData) return null;

    const changes: Record<string, { original: string; corrected: string }> = {};

    if (addressData.property_address !== originalAddressData.property_address) {
      changes.property_address = {
        original: originalAddressData.property_address,
        corrected: addressData.property_address,
      };
    }
    if (addressData.transaction_type !== originalAddressData.transaction_type) {
      changes.transaction_type = {
        original: originalAddressData.transaction_type,
        corrected: addressData.transaction_type,
      };
    }
    if (addressData.property_street !== originalAddressData.property_street) {
      changes.property_street = {
        original: originalAddressData.property_street,
        corrected: addressData.property_street,
      };
    }
    if (addressData.property_city !== originalAddressData.property_city) {
      changes.property_city = {
        original: originalAddressData.property_city,
        corrected: addressData.property_city,
      };
    }
    if (addressData.property_state !== originalAddressData.property_state) {
      changes.property_state = {
        original: originalAddressData.property_state,
        corrected: addressData.property_state,
      };
    }
    if (addressData.property_zip !== originalAddressData.property_zip) {
      changes.property_zip = {
        original: originalAddressData.property_zip,
        corrected: addressData.property_zip,
      };
    }
    if (addressData.started_at !== originalAddressData.started_at) {
      changes.started_at = {
        original: originalAddressData.started_at,
        corrected: addressData.started_at,
      };
    }
    if ((addressData.closed_at || "") !== (originalAddressData.closed_at || "")) {
      changes.closed_at = {
        original: originalAddressData.closed_at || "",
        corrected: addressData.closed_at || "",
      };
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }, [addressData, originalAddressData]);

  /**
   * Create or update the transaction with all contact assignments
   */
  const handleCreateTransaction = useCallback(async (): Promise<void> => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const assignments = Object.entries(contactAssignments).flatMap(
        ([role, contacts]: [string, ContactAssignment[]]) =>
          contacts.map((contact: ContactAssignment) => ({
            role: role,
            role_category: ROLE_TO_CATEGORY[role],
            contact_id: contact.contactId,
            is_primary: contact.isPrimary ? 1 : 0,
            notes: contact.notes || null,
          })),
      );

      let result: { success: boolean; transaction?: Transaction; error?: string };

      if (isEditing && editTransaction) {
        const updateData = {
          property_address: addressData.property_address,
          property_street: addressData.property_street,
          property_city: addressData.property_city,
          property_state: addressData.property_state,
          property_zip: addressData.property_zip,
          property_coordinates: addressData.property_coordinates
            ? JSON.stringify(addressData.property_coordinates)
            : undefined,
          transaction_type: addressData.transaction_type as Transaction["transaction_type"],
          detection_status: "confirmed" as const,
          reviewed_at: new Date().toISOString(),
          started_at: addressData.started_at,
          closing_deadline: addressData.closing_deadline || null,
          closed_at: addressData.closed_at || null,
        };

        const updateResult = await window.api.transactions.update(
          editTransaction.id,
          updateData,
        );

        const changes = getAddressChanges();
        if (changes && window.api.feedback?.recordTransaction) {
          await window.api.feedback.recordTransaction(userId, {
            detectedTransactionId: editTransaction.id,
            action: "confirm",
            corrections: changes,
          });
        }

        result = {
          success: updateResult.success,
          transaction: updateResult.success
            ? { ...editTransaction, ...updateData } as Transaction
            : undefined,
          error: updateResult.error,
        };
      } else {
        result = await window.api.transactions.createAudited(userId, {
          ...addressData,
          contact_assignments: assignments,
        });
      }

      if (result.success && result.transaction) {
        onSuccess(result.transaction);
        onClose();
      } else {
        setError(result.error || `Failed to ${isEditing ? "update" : "create"} transaction`);
        setLoading(false);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} transaction`;
      setError(errorMessage);
      setLoading(false);
    }
  }, [
    loading,
    contactAssignments,
    isEditing,
    editTransaction,
    addressData,
    getAddressChanges,
    userId,
    onSuccess,
    onClose,
  ]);

  /**
   * Proceed to next step
   * 3-step flow:
   * - Step 1: Transaction details (address, type, dates)
   * - Step 2: Select contacts
   * - Step 3: Assign roles to selected contacts
   * In edit mode, saves directly from step 1 (no contact steps)
   */
  const handleNextStep = useCallback((): void => {
    if (step === 1) {
      if (!addressData.property_address.trim()) {
        setError("Property address is required");
        return;
      }
      if (!addressData.started_at) {
        setError("Transaction start date is required");
        return;
      }
      // Validate end date is after start date if provided
      if (addressData.closed_at && addressData.started_at > addressData.closed_at) {
        setError("End date must be after start date");
        return;
      }
      setError(null);
      // In edit mode, save directly without going to contact steps
      // (use Edit Contacts button for contact changes)
      if (isEditing) {
        handleCreateTransaction();
      } else {
        setStep(2);
      }
    } else if (step === 2) {
      // Step 2: Select contacts - validate at least one selected
      if (selectedContactIds.length === 0) {
        setError("Please select at least one contact");
        return;
      }
      setError(null);
      setStep(3);
    } else if (step === 3) {
      // Step 3: Assign roles - validate client role is assigned
      if (
        !contactAssignments[SPECIFIC_ROLES.CLIENT] ||
        contactAssignments[SPECIFIC_ROLES.CLIENT].length === 0
      ) {
        setError("At least one contact must be assigned the Buyer (Client) role");
        return;
      }
      setError(null);
      handleCreateTransaction();
    }
  }, [step, addressData.property_address, addressData.started_at, addressData.closed_at, selectedContactIds, contactAssignments, handleCreateTransaction, isEditing]);

  /**
   * Go back to previous step
   */
  const handlePreviousStep = useCallback((): void => {
    setError(null);
    setStep(step - 1);
  }, [step]);

  return {
    // State
    step,
    loading,
    error,
    isEditing,
    addressData,
    contactAssignments,
    selectedContactIds,
    showAddressAutocomplete,
    addressSuggestions,

    // Auto-detect start date state (TASK-1974)
    startDateMode: startDateMode ?? undefined,
    autoDetectedDate,
    isAutoDetecting,

    // Contact loading state (lazy-loaded when reaching step 2)
    contacts,
    contactsLoading,
    contactsError,
    refreshContacts,
    silentRefreshContacts,

    // External contacts (from macOS Contacts app, etc.)
    externalContacts,
    externalContactsLoading,

    // Setters
    setAddressData,
    setSelectedContactIds,
    setError,
    setStartDateMode,

    // Handlers
    handleAddressChange,
    selectAddress,
    assignContact,
    removeContact,
    handleNextStep,
    handlePreviousStep,
  };
}
