/**
 * EditContactsModal Component
 *
 * Modal for editing contact assignments on a transaction using a 2-step workflow:
 * - Step 1: ContactSelector - select which contacts to involve
 * - Step 2: RoleAssigner - assign roles to selected contacts
 *
 * @see TASK-1751: Integrate ContactSelector + RoleAssigner into EditContactsModal
 * @see BACKLOG-418: Redesign Contact Selection UX (Select First, Assign Roles Second)
 */
import React, { useState, useEffect, useMemo } from "react";
import type { Transaction } from "@/types";
import type { ExtendedContact } from "../../../../types/components";
import { ROLE_TO_CATEGORY } from "../../../../constants/contactRoles";
import {
  ContactsProvider,
  useContacts,
} from "../../../../contexts/ContactsContext";
import { ContactSelector } from "../../../shared/ContactSelector";
import { RoleAssigner, type RoleAssignments } from "../../../shared/RoleAssigner";

// ============================================
// TYPES
// ============================================

interface ContactAssignment {
  id: string;
  contact_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_company?: string;
  role?: string;
  specific_role?: string;
  is_primary: number;
  notes?: string;
}

/**
 * Auto-link results returned when contacts are added
 * TASK-1126: Communications are auto-linked when contacts are added
 */
export interface AutoLinkResult {
  contactId: string;
  emailsLinked: number;
  messagesLinked: number;
  alreadyLinked: number;
  errors: number;
}

export interface EditContactsModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: (autoLinkResults?: AutoLinkResult[]) => void;
}

// ============================================
// EDIT CONTACTS MODAL COMPONENT
// ============================================

/**
 * Edit Contacts Modal
 * 2-step workflow for editing contact assignments.
 * Step 1: Select contacts with ContactSelector
 * Step 2: Assign roles with RoleAssigner
 */
export function EditContactsModal({
  transaction,
  onClose,
  onSave,
}: EditContactsModalProps): React.ReactElement {
  // Step management (1 = contact selection, 2 = role assignment)
  const [step, setStep] = useState<1 | 2>(1);

  // Contact selection state (Step 1)
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Role assignments state (Step 2)
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignments>({});

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Store original assignments for save diffing
  const [originalAssignments, setOriginalAssignments] = useState<
    ContactAssignment[]
  >([]);

  // Load existing contact assignments on mount
  useEffect(() => {
    loadContactAssignments();
  }, [transaction.id]);

  const loadContactAssignments = async () => {
    try {
      const result = await window.api.transactions.getDetails(transaction.id);
      const txn = result.transaction as {
        contact_assignments?: ContactAssignment[];
      };
      if (result.success && txn.contact_assignments) {
        setOriginalAssignments(txn.contact_assignments);

        // Extract unique contact IDs for step 1
        const contactIds = [
          ...new Set(
            txn.contact_assignments.map((a: ContactAssignment) => a.contact_id)
          ),
        ];
        setSelectedContactIds(contactIds);

        // Build role assignments map for step 2
        const assignments: RoleAssignments = {};
        txn.contact_assignments.forEach((a: ContactAssignment) => {
          const role = a.role || a.specific_role;
          if (!role) return;
          if (!assignments[role]) {
            assignments[role] = [];
          }
          if (!assignments[role].includes(a.contact_id)) {
            assignments[role].push(a.contact_id);
          }
        });
        setRoleAssignments(assignments);
      }
    } catch (err) {
      console.error("Failed to load contact assignments:", err);
      setError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Build batch operations by comparing current vs original
      const operations: Array<{
        action: "add" | "remove";
        contactId: string;
        role?: string;
        roleCategory?: string;
        specificRole?: string;
        isPrimary?: boolean;
        notes?: string;
      }> = [];

      // Build set of current assignments from roleAssignments state
      const currentSet = new Set<string>();
      for (const [role, contactIds] of Object.entries(roleAssignments)) {
        for (const contactId of contactIds) {
          currentSet.add(`${role}:${contactId}`);
        }
      }

      // Build set of original assignments
      const originalSet = new Set<string>();
      for (const assignment of originalAssignments) {
        const role = assignment.role || assignment.specific_role;
        if (role) {
          originalSet.add(`${role}:${assignment.contact_id}`);
        }
      }

      // Remove operations: in original but not in current
      for (const assignment of originalAssignments) {
        const role = assignment.role || assignment.specific_role;
        if (!role) continue;
        const key = `${role}:${assignment.contact_id}`;
        if (!currentSet.has(key)) {
          operations.push({
            action: "remove",
            contactId: assignment.contact_id,
            role: role,
            specificRole: role,
          });
        }
      }

      // Add operations: in current but not in original
      for (const [role, contactIds] of Object.entries(roleAssignments)) {
        for (const contactId of contactIds) {
          const key = `${role}:${contactId}`;
          if (!originalSet.has(key)) {
            const roleCategory = ROLE_TO_CATEGORY[role] || "support";
            operations.push({
              action: "add",
              contactId: contactId,
              role: role,
              roleCategory: roleCategory,
              specificRole: role,
              isPrimary: false,
              notes: undefined,
            });
          }
        }
      }

      // Execute all operations in a single batch call
      // TASK-1126: batchUpdateContacts now returns autoLinkResults
      let autoLinkResults: AutoLinkResult[] | undefined;
      if (operations.length > 0) {
        const batchResult = await window.api.transactions.batchUpdateContacts(
          transaction.id,
          operations
        );
        if (!batchResult.success) {
          throw new Error(batchResult.error || "Failed to update contacts");
        }
        autoLinkResults = batchResult.autoLinkResults;
      }

      onSave(autoLinkResults);
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update contacts";
      setError(errorMessage);
      setSaving(false);
    }
  };

  // Derive step title and subtitle for header
  const stepInfo = step === 1
    ? { title: "Step 1: Select Contacts", subtitle: "Choose which contacts to involve in this transaction" }
    : { title: "Step 2: Assign Roles", subtitle: "Assign roles to your selected contacts" };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-bold text-white">Edit Contacts</h3>
            <p className="text-sm text-blue-100 mt-0.5">{stepInfo.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
            data-testid="edit-contacts-modal-close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Step Progress Indicator */}
        <div className="flex-shrink-0 px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {/* Step 1 Indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === 1
                    ? "bg-blue-500 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                {step === 1 ? "1" : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  step === 1 ? "text-blue-700" : "text-green-700"
                }`}
              >
                Select Contacts
              </span>
            </div>

            {/* Connector */}
            <div className={`flex-1 h-0.5 ${step === 2 ? "bg-blue-500" : "bg-gray-300"}`} />

            {/* Step 2 Indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === 2
                    ? "bg-blue-500 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                2
              </div>
              <span
                className={`text-sm font-medium ${
                  step === 2 ? "text-blue-700" : "text-gray-500"
                }`}
              >
                Assign Roles
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading contacts...</p>
            </div>
          ) : (
            <ContactsProvider
              userId={transaction.user_id}
              propertyAddress={transaction.property_address || ""}
            >
              <StepContent
                step={step}
                transactionType={
                  (transaction.transaction_type as "purchase" | "sale" | "other") ||
                  "purchase"
                }
                selectedContactIds={selectedContactIds}
                onSelectionChange={setSelectedContactIds}
                roleAssignments={roleAssignments}
                onRoleAssignmentsChange={setRoleAssignments}
              />
            </ContactsProvider>
          )}
        </div>

        {/* Footer with Navigation */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-between">
          {/* Left side - Back button or Cancel */}
          <div>
            {step === 1 ? (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
                data-testid="edit-contacts-modal-cancel"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all flex items-center gap-2"
                data-testid="edit-contacts-modal-back"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
          </div>

          {/* Right side - Next or Save */}
          <div className="flex items-center gap-3">
            {step === 1 && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
            )}
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={selectedContactIds.length === 0}
                className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  selectedContactIds.length === 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg"
                }`}
                data-testid="edit-contacts-modal-next"
              >
                Next: Assign Roles
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  saving
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg"
                }`}
                data-testid="edit-contacts-modal-save"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STEP CONTENT COMPONENT
// ============================================

interface StepContentProps {
  step: 1 | 2;
  transactionType: "purchase" | "sale" | "other";
  selectedContactIds: string[];
  onSelectionChange: (ids: string[]) => void;
  roleAssignments: RoleAssignments;
  onRoleAssignmentsChange: (assignments: RoleAssignments) => void;
}

/**
 * StepContent Component
 * Renders the appropriate step content using ContactsContext
 */
function StepContent({
  step,
  transactionType,
  selectedContactIds,
  onSelectionChange,
  roleAssignments,
  onRoleAssignmentsChange,
}: StepContentProps): React.ReactElement {
  const { contacts, loading: contactsLoading, error: contactsError } = useContacts();

  // Filter selected contacts for RoleAssigner
  const selectedContacts = useMemo(() => {
    return contacts.filter((c) => selectedContactIds.includes(c.id));
  }, [contacts, selectedContactIds]);

  // Handle role assignments change and clean up deselected contacts
  const handleRoleAssignmentsChange = (newAssignments: RoleAssignments) => {
    // Clean up any contact IDs that are no longer selected
    const cleanedAssignments: RoleAssignments = {};
    for (const [role, contactIds] of Object.entries(newAssignments)) {
      const validIds = contactIds.filter((id) => selectedContactIds.includes(id));
      if (validIds.length > 0) {
        cleanedAssignments[role] = validIds;
      }
    }
    onRoleAssignmentsChange(cleanedAssignments);
  };

  // When selection changes, also clean role assignments
  const handleSelectionChange = (newIds: string[]) => {
    onSelectionChange(newIds);
    // Clean up role assignments for deselected contacts
    const cleanedAssignments: RoleAssignments = {};
    for (const [role, contactIds] of Object.entries(roleAssignments)) {
      const validIds = contactIds.filter((id) => newIds.includes(id));
      if (validIds.length > 0) {
        cleanedAssignments[role] = validIds;
      }
    }
    onRoleAssignmentsChange(cleanedAssignments);
  };

  if (step === 1) {
    return (
      <ContactSelector
        contacts={contacts}
        selectedIds={selectedContactIds}
        onSelectionChange={handleSelectionChange}
        isLoading={contactsLoading}
        error={contactsError}
        className="h-[400px]"
      />
    );
  }

  return (
    <RoleAssigner
      selectedContacts={selectedContacts}
      transactionType={transactionType}
      assignments={roleAssignments}
      onAssignmentsChange={handleRoleAssignmentsChange}
      className="h-[400px]"
    />
  );
}

export default EditContactsModal;
