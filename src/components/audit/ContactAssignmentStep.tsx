/**
 * ContactAssignmentStep Component
 * Steps 2-3 of the AuditTransactionModal - Contact assignment
 *
 * TASK-1771: Updated to use mode prop for unified navigation
 * - mode="select": Search and select contacts (ContactSearchList)
 * - mode="roles": Assign roles to selected contacts (ContactRoleRow)
 *
 * Contact Loading Optimization:
 * Contacts are now loaded at the parent level (useAuditTransaction hook)
 * and passed as props to prevent duplicate API calls when switching
 * between steps 2 and 3.
 */
import React, { useState, useMemo, useCallback } from "react";
import { AUDIT_WORKFLOW_STEPS } from "../../constants/contactRoles";
import {
  filterRolesByTransactionType,
  getRoleDisplayName,
  type TransactionType,
} from "../../utils/transactionRoleUtils";
import { ContactSearchList } from "../shared/ContactSearchList";
import type { ExternalContact } from "../shared/ContactSearchList";
import { ContactRoleRow } from "../shared/ContactRoleRow";
import type { RoleOption } from "../shared/ContactRoleRow";
import type { ContactAssignments } from "../../hooks/useAuditTransaction";
import type { Contact } from "../../../electron/types/models";
import type { ExtendedContact } from "../../types/components";
import { contactService } from "../../services";

interface ContactAssignmentStepProps {
  // TASK-1771: Mode prop for unified navigation (replaces internal step state)
  mode: 'select' | 'roles';
  contactAssignments: ContactAssignments;
  onAssignContact: (
    role: string,
    contactId: string,
    isPrimary: boolean,
    notes: string
  ) => void;
  onRemoveContact: (role: string, contactId: string) => void;
  userId: string;
  transactionType: string;
  propertyAddress: string;
  // Contacts loaded at parent level (useAuditTransaction hook)
  contacts: Contact[];
  contactsLoading: boolean;
  contactsError: string | null;
  onRefreshContacts: () => void;
  // TASK-1771: Selected contacts lifted to parent for unified navigation
  selectedContactIds: string[];
  onSelectedContactIdsChange: (ids: string[]) => void;
}

/**
 * Role configuration from workflow steps
 */
interface RoleConfig {
  role: string;
  required: boolean;
  multiple: boolean;
}

/**
 * Converts Contact to ExtendedContact format for ContactSearchList/ContactRoleRow
 */
function toExtendedContact(contact: Contact): ExtendedContact {
  return {
    id: contact.id,
    name: contact.name,
    display_name: contact.display_name || contact.name,
    email: contact.email,
    phone: contact.phone,
    company: contact.company,
    source: contact.source,
    is_message_derived: contact.is_message_derived,
    user_id: contact.user_id,
    created_at: contact.created_at,
    updated_at: contact.updated_at,
  };
}

function ContactAssignmentStep({
  mode,
  contactAssignments,
  onAssignContact,
  onRemoveContact,
  userId,
  transactionType,
  propertyAddress: _propertyAddress, // Reserved for future use (address-based contact sorting)
  // Contacts loaded at parent level
  contacts,
  contactsLoading,
  contactsError,
  onRefreshContacts,
  // TASK-1771: Selected contacts lifted to parent for unified navigation
  selectedContactIds,
  onSelectedContactIdsChange,
}: ContactAssignmentStepProps): React.ReactElement {
  // TASK-1771: Removed internal step state - now controlled by parent via 'mode' prop

  // Loading state for external contact import
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Convert contacts to ExtendedContact format for components
  const extendedContacts = useMemo(
    () => contacts.map(toExtendedContact),
    [contacts]
  );

  // Build role options from all workflow steps
  const roleOptions = useMemo((): RoleOption[] => {
    const allRoles: RoleOption[] = [];
    const txnType = transactionType as TransactionType;

    AUDIT_WORKFLOW_STEPS.forEach((step) => {
      const filteredRoles = filterRolesByTransactionType(
        step.roles as RoleConfig[],
        txnType,
        step.title
      );

      filteredRoles.forEach((roleConfig) => {
        allRoles.push({
          value: roleConfig.role,
          label: getRoleDisplayName(roleConfig.role, txnType),
        });
      });
    });

    return allRoles;
  }, [transactionType]);

  // Get selected contacts for step 2
  const selectedContacts = useMemo(() => {
    return extendedContacts.filter((c) => selectedContactIds.includes(c.id));
  }, [extendedContacts, selectedContactIds]);

  // Get the current role for a contact from contactAssignments
  const getContactRole = useCallback(
    (contactId: string): string => {
      for (const [role, assignments] of Object.entries(contactAssignments)) {
        if (assignments.some((a) => a.contactId === contactId)) {
          return role;
        }
      }
      return ""; // No role assigned
    },
    [contactAssignments]
  );

  // Count how many contacts have roles assigned
  const assignedCount = useMemo(() => {
    return selectedContacts.filter((c) => getContactRole(c.id) !== "").length;
  }, [selectedContacts, getContactRole]);

  // Handle role change for a contact
  const handleRoleChange = useCallback(
    (contactId: string, newRole: string) => {
      // First, remove contact from any existing role
      for (const [role, assignments] of Object.entries(contactAssignments)) {
        if (assignments.some((a) => a.contactId === contactId)) {
          onRemoveContact(role, contactId);
          break;
        }
      }

      // Then assign to new role (if not empty)
      if (newRole) {
        onAssignContact(newRole, contactId, false, "");
      }
    },
    [contactAssignments, onAssignContact, onRemoveContact]
  );

  // Handle importing an external contact
  const handleImportContact = useCallback(
    async (external: ExternalContact): Promise<ExtendedContact> => {
      const result = await contactService.create(userId, {
        display_name: external.name,
        email: external.email,
        phone: external.phone,
        company: external.company,
        source: "manual",
      });

      if (result.success && result.data) {
        // Refresh contacts list to include the new contact
        onRefreshContacts();
        return result.data as ExtendedContact;
      }

      throw new Error(result.error || "Failed to import contact");
    },
    [userId, onRefreshContacts]
  );

  // TASK-1771: Removed internal navigation handlers - now controlled by parent modal footer

  return (
    <div className="flex flex-col h-full relative">
      {/* Loading overlay - prevents layout shift by covering content */}
      {(contactsLoading || importing) && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-600">
              {importing ? "Importing contacts..." : "Loading contacts..."}
            </span>
          </div>
        </div>
      )}

      {/* Error display */}
      {(contactsError || importError) && (
        <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{contactsError || importError}</p>
        </div>
      )}

      {/* TASK-1771: Contact Selection - mode="select" */}
      {/* No internal footer - navigation is in parent modal footer */}
      {mode === 'select' && (
        <div
          className="flex flex-col flex-1 min-h-0"
          data-testid="contact-assignment-select"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Select Contacts
            </h3>
            <p className="text-sm text-gray-600">
              Search and select contacts to add to this transaction.
              {selectedContactIds.length > 0 && (
                <span className="ml-1 font-medium text-indigo-600">
                  ({selectedContactIds.length} selected)
                </span>
              )}
            </p>
          </div>

          {/* Contact Search List */}
          <div className="flex-1 min-h-0">
            <ContactSearchList
              contacts={extendedContacts}
              externalContacts={[]} // External contacts API not ready per SR Engineer
              selectedIds={selectedContactIds}
              onSelectionChange={onSelectedContactIdsChange}
              onImportContact={handleImportContact}
              isLoading={contactsLoading}
              error={contactsError}
              searchPlaceholder="Search contacts by name, email, or phone..."
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* TASK-1771: Role Assignment - mode="roles" */}
      {/* No internal footer - navigation is in parent modal footer */}
      {mode === 'roles' && (
        <div
          className="flex flex-col flex-1 min-h-0"
          data-testid="contact-assignment-roles"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Assign Roles
            </h3>
            <p className="text-sm text-gray-600">
              {assignedCount} of {selectedContacts.length} contact
              {selectedContacts.length !== 1 ? "s" : ""} have roles assigned
            </p>
          </div>

          {/* Contact Role Rows */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {selectedContacts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No contacts selected.</p>
                <p className="mt-2 text-sm">
                  Use the Back button to select contacts.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedContacts.map((contact) => (
                  <ContactRoleRow
                    key={contact.id}
                    contact={contact}
                    currentRole={getContactRole(contact.id)}
                    roleOptions={roleOptions}
                    onRoleChange={(role) => handleRoleChange(contact.id, role)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactAssignmentStep;
