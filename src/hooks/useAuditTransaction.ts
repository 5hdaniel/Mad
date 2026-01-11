/**
 * useAuditTransaction Hook
 * Manages state and business logic for AuditTransactionModal
 * Extracted to support component decomposition (TASK-974)
 */
import { useState, useEffect, useCallback } from "react";
import {
  SPECIFIC_ROLES,
  ROLE_TO_CATEGORY,
} from "../constants/contactRoles";
import type { Transaction } from "../../electron/types/models";

// Type definitions
export interface AddressData {
  property_address: string;
  property_street: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  property_coordinates: Coordinates | null;
  transaction_type: string;
  started_at: string;  // ISO8601 date string (required)
  closed_at?: string;  // ISO8601 date string (optional, null = ongoing)
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
  showAddressAutocomplete: boolean;
  addressSuggestions: AddressSuggestion[];

  // Setters
  setAddressData: React.Dispatch<React.SetStateAction<AddressData>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;

  // Handlers
  handleAddressChange: (value: string) => Promise<void>;
  selectAddress: (suggestion: AddressSuggestion) => Promise<void>;
  assignContact: (role: string, contactId: string, isPrimary?: boolean, notes?: string) => void;
  removeContact: (role: string, contactId: string) => void;
  handleNextStep: () => void;
  handlePreviousStep: () => void;
}

/**
 * Get default start date (one year ago from today)
 * Common transaction timeframe for real estate
 */
function getDefaultStartDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
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
  closed_at: undefined,
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

  /**
   * Initialize Google Places API (if available)
   */
  useEffect(() => {
    const initializeAPI = async (): Promise<void> => {
      if (window.api?.address?.initialize) {
        try {
          await window.api.address.initialize("");
        } catch (initError: unknown) {
          console.warn(
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
   */
  useEffect(() => {
    if (editTransaction) {
      let coordinates: Coordinates | null = null;
      if (editTransaction.property_coordinates) {
        try {
          coordinates = JSON.parse(editTransaction.property_coordinates);
        } catch {
          // Invalid JSON, leave as null
        }
      }

      const prefillData: AddressData = {
        property_address: editTransaction.property_address || "",
        property_street: editTransaction.property_street || "",
        property_city: editTransaction.property_city || "",
        property_state: editTransaction.property_state || "",
        property_zip: editTransaction.property_zip || "",
        property_coordinates: coordinates,
        transaction_type: editTransaction.transaction_type || "purchase",
        started_at: editTransaction.started_at
          ? (typeof editTransaction.started_at === "string"
              ? editTransaction.started_at.split("T")[0]
              : editTransaction.started_at.toISOString().split("T")[0])
          : getDefaultStartDate(),
        closed_at: editTransaction.closed_at
          ? (typeof editTransaction.closed_at === "string"
              ? editTransaction.closed_at.split("T")[0]
              : editTransaction.closed_at.toISOString().split("T")[0])
          : undefined,
      };

      setAddressData(prefillData);
      setOriginalAddressData(prefillData);

      // Parse and set suggested contacts if present
      if (editTransaction.suggested_contacts) {
        try {
          const suggestedContacts = JSON.parse(editTransaction.suggested_contacts);
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
    }
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
        console.error("[AuditTransaction] Failed to fetch address suggestions:", fetchError);
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
      console.error("[AuditTransaction] Failed to get address details:", detailsError);
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
      setStep(2);
    } else if (step === 2) {
      if (
        !contactAssignments[SPECIFIC_ROLES.CLIENT] ||
        contactAssignments[SPECIFIC_ROLES.CLIENT].length === 0
      ) {
        setError("Client contact is required");
        return;
      }
      setError(null);
      setStep(3);
    } else if (step === 3) {
      handleCreateTransaction();
    }
  }, [step, addressData.property_address, contactAssignments, handleCreateTransaction]);

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
    showAddressAutocomplete,
    addressSuggestions,

    // Setters
    setAddressData,
    setError,

    // Handlers
    handleAddressChange,
    selectAddress,
    assignContact,
    removeContact,
    handleNextStep,
    handlePreviousStep,
  };
}
