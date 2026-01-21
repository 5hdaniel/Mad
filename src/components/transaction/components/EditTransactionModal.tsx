/**
 * EditTransactionModal Component
 * Modal for editing transaction details and contact assignments
 */
import React, { useState, useEffect } from "react";
import type { Transaction } from "../../../../electron/types/models";
import type { ExtendedContact } from "../../../types/components";
import {
  ROLE_TO_CATEGORY,
  AUDIT_WORKFLOW_STEPS,
} from "../../../constants/contactRoles";
import {
  filterRolesByTransactionType,
  getRoleDisplayName,
} from "../../../utils/transactionRoleUtils";
import ContactSelectModal from "../../ContactSelectModal";

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

interface ContactAssignmentMap {
  [role: string]: Array<{
    contactId: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    contactCompany?: string;
    isPrimary: boolean;
    notes?: string;
    assignmentId?: string;
  }>;
}

interface RoleConfig {
  role: string;
  required: boolean;
  multiple: boolean;
}

export interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSuccess: () => void;
}

// ============================================
// EDIT TRANSACTION MODAL COMPONENT
// ============================================

/**
 * Edit Transaction Modal
 * Allows editing transaction details and contact assignments
 */
export function EditTransactionModal({
  transaction,
  onClose,
  onSuccess,
}: EditTransactionModalProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<"details" | "contacts">("details");
  const [formData, setFormData] = useState({
    property_address: transaction.property_address || "",
    transaction_type: transaction.transaction_type || "purchase",
    started_at: transaction.started_at
      ? typeof transaction.started_at === "string"
        ? transaction.started_at
        : transaction.started_at.toISOString().split("T")[0]
      : "",
    closed_at: transaction.closed_at
      ? typeof transaction.closed_at === "string"
        ? transaction.closed_at
        : transaction.closed_at.toISOString().split("T")[0]
      : "",
    sale_price: transaction.sale_price || "",
    listing_price: transaction.listing_price || "",
  });
  const [contactAssignments, setContactAssignments] =
    useState<ContactAssignmentMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing contact assignments
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
        // Group assignments by role
        const grouped: ContactAssignmentMap = {};
        txn.contact_assignments.forEach((assignment: ContactAssignment) => {
          // Use role (normalized constant like "buyer_agent") as primary key for grouping
          // since AUDIT_WORKFLOW_STEPS uses constant format, not display names
          const role = assignment.role || assignment.specific_role;
          if (!role) return;
          if (!grouped[role]) {
            grouped[role] = [];
          }
          grouped[role].push({
            contactId: assignment.contact_id,
            contactName: assignment.contact_name,
            contactEmail: assignment.contact_email,
            contactPhone: assignment.contact_phone,
            contactCompany: assignment.contact_company,
            isPrimary: assignment.is_primary === 1,
            notes: assignment.notes,
            assignmentId: assignment.id, // Keep track of existing assignment ID
          });
        });
        setContactAssignments(grouped);
      }
    } catch (err) {
      console.error("Failed to load contact assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  // Handle adding contact to a role
  // Uses functional update to handle rapid consecutive calls (e.g., multi-select)
  const handleAssignContact = (
    role: string,
    contact: {
      contactId: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      contactCompany?: string;
      isPrimary: boolean;
      notes?: string;
    }
  ) => {
    setContactAssignments((prev) => ({
      ...prev,
      [role]: [...(prev[role] || []), contact],
    }));
  };

  // Handle removing contact from a role
  // Uses functional update for consistency with handleAssignContact
  const handleRemoveContact = (role: string, contactId: string) => {
    setContactAssignments((prev) => ({
      ...prev,
      [role]: (prev[role] || []).filter((c) => c.contactId !== contactId),
    }));
  };

  const handleSave = async () => {
    if (!formData.property_address.trim()) {
      setError("Property address is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Update transaction details
      const updates = {
        property_address: formData.property_address.trim(),
        transaction_type: formData.transaction_type,
        started_at: formData.started_at || null,
        closed_at: formData.closed_at || null,
        sale_price: formData.sale_price
          ? parseFloat(formData.sale_price as string)
          : null,
        listing_price: formData.listing_price
          ? parseFloat(formData.listing_price as string)
          : null,
      };

      await window.api.transactions.update(transaction.id, updates);

      // Update contact assignments
      // First, get all current assignments to determine what to delete
      const currentResult = await window.api.transactions.getDetails(
        transaction.id
      );
      const currentAssignments = currentResult.success
        ? (
            currentResult.transaction as {
              contact_assignments?: ContactAssignment[];
            }
          ).contact_assignments || []
        : [];

      // Build batch operations for contact assignments
      const operations: Array<{
        action: "add" | "remove";
        contactId: string;
        role?: string;
        roleCategory?: string;
        specificRole?: string;
        isPrimary?: boolean;
        notes?: string;
      }> = [];

      // Collect remove operations for contacts no longer assigned
      for (const existing of currentAssignments) {
        // Use role (normalized constant) for consistent lookup
        const role = existing.role || existing.specific_role;
        if (!role) continue;
        const stillAssigned = (contactAssignments[role] || []).some(
          (c) => c.contactId === existing.contact_id
        );
        if (!stillAssigned) {
          operations.push({
            action: "remove",
            contactId: existing.contact_id,
            role: role,
            specificRole: role,
          });
        }
      }

      // Collect add operations for new contacts
      for (const [role, contacts] of Object.entries(contactAssignments)) {
        for (const contact of contacts) {
          // Check if this is a new assignment
          const isExisting = currentAssignments.some(
            (existing: ContactAssignment) =>
              existing.contact_id === contact.contactId &&
              (existing.role || existing.specific_role) === role
          );

          if (!isExisting) {
            const roleCategory = ROLE_TO_CATEGORY[role] || "support";
            operations.push({
              action: "add",
              contactId: contact.contactId,
              role: role,
              roleCategory: roleCategory,
              specificRole: role,
              isPrimary: contact.isPrimary,
              notes: contact.notes,
            });
          }
        }
      }

      // Execute all operations in a single batch call
      if (operations.length > 0) {
        const batchResult = await window.api.transactions.batchUpdateContacts(
          transaction.id,
          operations
        );
        if (!batchResult.success) {
          throw new Error(batchResult.error || "Failed to update contacts");
        }
      }

      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update transaction";
      setError(errorMessage);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-xl font-bold text-white">Edit Transaction</h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
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

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("details")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "details"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Transaction Details
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={`px-4 py-3 font-medium text-sm transition-all ${
                activeTab === "contacts"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Roles & Contacts
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-4">
              {/* Property Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property Address *
                </label>
                <input
                  type="text"
                  value={formData.property_address}
                  onChange={(e) =>
                    handleChange("property_address", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleChange("transaction_type", "purchase")}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      formData.transaction_type === "purchase"
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Purchase
                  </button>
                  <button
                    onClick={() => handleChange("transaction_type", "sale")}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      formData.transaction_type === "sale"
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Sale
                  </button>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Representation Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.started_at}
                    onChange={(e) =>
                      handleChange("started_at", e.target.value)
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Closing Date
                  </label>
                  <input
                    type="date"
                    value={formData.closed_at}
                    onChange={(e) =>
                      handleChange("closed_at", e.target.value)
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sale Price
                  </label>
                  <input
                    type="number"
                    value={formData.sale_price}
                    onChange={(e) => handleChange("sale_price", e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Listing Price
                  </label>
                  <input
                    type="number"
                    value={formData.listing_price}
                    onChange={(e) =>
                      handleChange("listing_price", e.target.value)
                    }
                    placeholder="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "contacts" && (
            <div>
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading contacts...</p>
                </div>
              ) : (
                <EditContactAssignments
                  transactionType={formData.transaction_type}
                  contactAssignments={contactAssignments}
                  onAssignContact={handleAssignContact}
                  onRemoveContact={handleRemoveContact}
                  userId={transaction.user_id}
                  propertyAddress={formData.property_address}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              saving
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg"
            }`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EDIT CONTACT ASSIGNMENTS COMPONENT
// ============================================

interface EditContactAssignmentsProps {
  transactionType: "purchase" | "sale" | "other";
  contactAssignments: ContactAssignmentMap;
  onAssignContact: (
    role: string,
    contact: {
      contactId: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      contactCompany?: string;
      isPrimary: boolean;
      notes?: string;
    }
  ) => void;
  onRemoveContact: (role: string, contactId: string) => void;
  userId: string;
  propertyAddress: string;
}

/**
 * Edit Contact Assignments Component
 * Reusable component for editing contact assignments
 */
function EditContactAssignments({
  transactionType,
  contactAssignments,
  onAssignContact,
  onRemoveContact,
  userId,
  propertyAddress,
}: EditContactAssignmentsProps): React.ReactElement {
  return (
    <div className="space-y-6">
      {AUDIT_WORKFLOW_STEPS.map(
        (
          step: { title: string; description: string; roles: RoleConfig[] },
          idx: number
        ) => {
          const stepRoles = filterRolesByTransactionType(
            step.roles,
            transactionType,
            step.title
          );
          if (stepRoles.length === 0) return null;

          return (
            <div key={idx}>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                {step.title}
              </h4>
              <p className="text-sm text-gray-600 mb-4">{step.description}</p>
              <div className="space-y-4">
                {stepRoles.map((roleConfig: RoleConfig) => (
                  <EditRoleAssignment
                    key={roleConfig.role}
                    role={roleConfig.role}
                    required={roleConfig.required}
                    multiple={roleConfig.multiple}
                    assignments={contactAssignments[roleConfig.role] || []}
                    onAssign={onAssignContact}
                    onRemove={onRemoveContact}
                    userId={userId}
                    propertyAddress={propertyAddress}
                    transactionType={transactionType}
                  />
                ))}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

// ============================================
// EDIT ROLE ASSIGNMENT COMPONENT
// ============================================

interface EditRoleAssignmentProps {
  role: string;
  required: boolean;
  multiple: boolean;
  assignments: Array<{
    contactId: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
    contactCompany?: string;
    isPrimary: boolean;
    notes?: string;
  }>;
  onAssign: (
    role: string,
    contact: {
      contactId: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      contactCompany?: string;
      isPrimary: boolean;
      notes?: string;
    }
  ) => void;
  onRemove: (role: string, contactId: string) => void;
  userId: string;
  propertyAddress: string;
  transactionType: "purchase" | "sale" | "other";
}

/**
 * Edit Single Role Assignment Component
 */
function EditRoleAssignment({
  role,
  required,
  multiple,
  assignments,
  onAssign,
  onRemove,
  userId,
  propertyAddress,
  transactionType,
}: EditRoleAssignmentProps): React.ReactElement {
  const [contacts, setContacts] = React.useState<ExtendedContact[]>([]);
  const [_loading, setLoading] = React.useState<boolean>(true);
  const [_error, setError] = React.useState<string | null>(null);
  const [showContactSelect, setShowContactSelect] =
    React.useState<boolean>(false);

  React.useEffect(() => {
    loadContacts();
  }, [propertyAddress]);

  const loadContacts = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use sorted API when property address is available, otherwise use regular API
      const result = propertyAddress
        ? await window.api.contacts.getSortedByActivity(userId, propertyAddress)
        : await window.api.contacts.getAll(userId);

      if (result.success) {
        setContacts(result.contacts || []);
      } else {
        setError(result.error || "Failed to load contacts");
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
      setError("Unable to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelected = (selectedContacts: ExtendedContact[]) => {
    selectedContacts.forEach((contact: ExtendedContact) => {
      onAssign(role, {
        contactId: contact.id,
        contactName: contact.name || contact.display_name || "Unknown",
        contactEmail: contact.email,
        contactPhone: contact.phone,
        contactCompany: contact.company,
        isPrimary: false,
        notes: undefined,
      });
    });
    setShowContactSelect(false);
  };

  const canAddMore = multiple || assignments.length === 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-900">
            {getRoleDisplayName(role, transactionType)}
          </label>
          {required && (
            <span className="text-xs text-red-500 font-semibold">*</span>
          )}
          {multiple && (
            <span className="text-xs text-gray-500">(can assign multiple)</span>
          )}
        </div>
        {canAddMore && (
          <button
            onClick={() => setShowContactSelect(true)}
            className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-all"
          >
            + Add Contact
          </button>
        )}
      </div>

      {/* Assigned contacts */}
      {assignments.length > 0 && (
        <div className="space-y-2">
          {assignments.map(
            (assignment: {
              contactId: string;
              contactName: string;
              contactEmail?: string;
            }) => (
              <div
                key={assignment.contactId}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {assignment.contactName}
                  </p>
                  {assignment.contactEmail && (
                    <p className="text-xs text-gray-600">
                      {assignment.contactEmail}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(role, assignment.contactId)}
                  className="text-red-600 hover:text-red-800 p-1"
                >
                  <svg
                    className="w-5 h-5"
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
            )
          )}
        </div>
      )}

      {/* Contact Select Modal */}
      {showContactSelect && (
        <ContactSelectModal
          contacts={contacts}
          excludeIds={
            assignments.map(
              (a: { contactId: string }): string => a.contactId
            ) as never[]
          }
          multiple={multiple}
          onSelect={handleContactSelected}
          onClose={() => setShowContactSelect(false)}
          propertyAddress={propertyAddress}
        />
      )}
    </div>
  );
}

export default EditTransactionModal;
