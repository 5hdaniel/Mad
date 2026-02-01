/**
 * ContactAssignmentStep Component
 * Steps 2-3 of the AuditTransactionModal - Contact assignment using search-first pattern
 *
 * Step flow controlled by parent:
 * - Step 2: Search and select contacts (ContactSearchList)
 * - Step 3: Assign roles to selected contacts (ContactRoleRow)
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
import { ContactRoleRow } from "../shared/ContactRoleRow";
import { ContactPreview } from "../shared/ContactPreview";
import { ContactFormModal } from "../contact";
import type { RoleOption } from "../shared/ContactRoleRow";
import type { ContactAssignments } from "../../hooks/useAuditTransaction";
import type { Contact } from "../../../electron/types/models";
import type { ExtendedContact } from "../../types/components";
import { contactService } from "../../services";

interface ContactAssignmentStepProps {
  /** Current step (2 = select contacts, 3 = assign roles) */
  step: number;
  contactAssignments: ContactAssignments;
  /** Selected contact IDs managed by parent */
  selectedContactIds: string[];
  onSelectedContactIdsChange: (ids: string[]) => void;
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
  onRefreshContacts: () => Promise<void>;
  onSilentRefreshContacts: () => Promise<void>;
  // External contacts (from macOS Contacts app, etc.)
  externalContacts: Contact[];
  externalContactsLoading: boolean;
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
  step,
  contactAssignments,
  selectedContactIds,
  onSelectedContactIdsChange,
  onAssignContact,
  onRemoveContact,
  userId,
  transactionType,
  propertyAddress,
  // Contacts loaded at parent level
  contacts,
  contactsLoading,
  contactsError,
  onRefreshContacts,
  onSilentRefreshContacts,
  // External contacts (from macOS Contacts app, etc.)
  externalContacts,
  externalContactsLoading,
}: ContactAssignmentStepProps): React.ReactElement {
  // Contact preview/edit modal state
  const [previewContact, setPreviewContact] = useState<ExtendedContact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContact, setEditContact] = useState<ExtendedContact | undefined>(undefined);

  // Track imported contact IDs for visual feedback
  const [addedContactIds, setAddedContactIds] = useState<Set<string>>(new Set());

  // Convert contacts to ExtendedContact format for components
  const extendedContacts = useMemo(
    () => contacts.map(toExtendedContact),
    [contacts]
  );

  // Convert external contacts to ExtendedContact format
  const extendedExternalContacts = useMemo(
    () => externalContacts.map(toExtendedContact),
    [externalContacts]
  );

  // Helper to check if a contact is external
  const isExternal = (contact: ExtendedContact): boolean => {
    return contact.is_message_derived === 1 || contact.is_message_derived === true;
  };

  // Handle clicking on a contact to view details
  const handleContactClick = useCallback((contact: ExtendedContact) => {
    setPreviewContact(contact);
  }, []);

  // Handle editing a contact from preview
  const handlePreviewEdit = useCallback(() => {
    if (previewContact) {
      setPreviewContact(null);
      setEditContact(previewContact);
      setShowEditModal(true);
    }
  }, [previewContact]);

  // Handle adding a new contact manually
  const handleAddManually = useCallback(() => {
    setEditContact(undefined);
    setShowEditModal(true);
  }, []);

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

  // Handle adding a contact (import if external, or just select if already imported)
  const handleImportContact = useCallback(
    async (contact: ExtendedContact): Promise<ExtendedContact> => {
      const isExternalContact = contact.is_message_derived === true || contact.is_message_derived === 1 || contact.isFromDatabase === false;

      if (isExternalContact) {
        // External contact: import first, then add to selection
        const result = await contactService.create(userId, {
          name: contact.display_name || contact.name || "",
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          source: "contacts_app",
        });

        if (result.success && result.data) {
          const newContact = result.data as ExtendedContact;
          // Mark as added for visual feedback (use original contact ID, not new DB ID)
          setAddedContactIds((prev) => new Set(prev).add(contact.id));
          // Auto-select the newly imported contact
          onSelectedContactIdsChange([...selectedContactIds, newContact.id]);
          // Silent refresh to avoid showing loading state (await to ensure it's ready for Step 3)
          await onSilentRefreshContacts();
          return newContact;
        }

        throw new Error(result.error || "Failed to import contact");
      } else {
        // Already imported contact: just add to selection
        setAddedContactIds((prev) => new Set(prev).add(contact.id));
        onSelectedContactIdsChange([...selectedContactIds, contact.id]);
        return contact;
      }
    },
    [userId, onSilentRefreshContacts, selectedContactIds, onSelectedContactIdsChange]
  );

  // Handle importing from preview (needs to be after handleImportContact)
  const handlePreviewImportAction = useCallback(async () => {
    if (!previewContact) return;
    try {
      await handleImportContact(previewContact);
      setPreviewContact(null);
    } catch (err) {
      console.error("Failed to import contact:", err);
    }
  }, [previewContact, handleImportContact]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Error display */}
      {contactsError && (
        <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{contactsError}</p>
        </div>
      )}

      {/* Step 2: Contact Selection */}
      {step === 2 && (
        <div
          className="flex flex-col flex-1 min-h-0"
          data-testid="contact-assignment-step-2"
        >
          {/* Contact Search List - no header since parent modal shows "Step 2: Select Contacts" */}
          <div className="flex-1 min-h-0">
            <ContactSearchList
              contacts={extendedContacts}
              externalContacts={extendedExternalContacts}
              selectedIds={selectedContactIds}
              onSelectionChange={onSelectedContactIdsChange}
              onImportContact={handleImportContact}
              showAddButtonForImported={true}
              onContactClick={handleContactClick}
              onAddManually={handleAddManually}
              addedContactIds={addedContactIds}
              isLoading={contactsLoading || externalContactsLoading}
              error={contactsError}
              searchPlaceholder="Search contacts by name, email, or phone..."
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* Step 3: Role Assignment */}
      {step === 3 && (
        <div
          className="flex flex-col flex-1 min-h-0"
          data-testid="contact-assignment-step-3"
        >
          {/* Status line showing assignment progress */}
          <div className="flex-shrink-0 px-4 pt-4 pb-2">
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
                <p className="mt-2 text-sm">Go back to select contacts.</p>
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

      {/* Contact Preview Modal */}
      {previewContact && (
        <ContactPreview
          contact={previewContact}
          isExternal={isExternal(previewContact)}
          transactions={[]}
          onEdit={handlePreviewEdit}
          onImport={handlePreviewImportAction}
          onClose={() => setPreviewContact(null)}
        />
      )}

      {/* Add/Edit Contact Modal */}
      {showEditModal && (
        <ContactFormModal
          userId={userId}
          contact={editContact}
          onClose={() => {
            setShowEditModal(false);
            setEditContact(undefined);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditContact(undefined);
            onRefreshContacts();
          }}
        />
      )}
    </div>
  );
}

export default ContactAssignmentStep;
