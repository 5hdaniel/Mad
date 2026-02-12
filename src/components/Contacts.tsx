import React, { useState, useCallback } from "react";
import {
  ContactDetailsModal,
  ContactFormModal,
  RemoveConfirmationModal,
  BlockingTransactionsModal,
  useContactList,
  ExtendedContact,
} from "./contact";
import { useAppStateMachine } from "../appCore";
import { ContactSearchList } from "./shared/ContactSearchList";
import {
  ContactPreview,
  type ContactTransaction,
} from "./shared/ContactPreview";

interface ContactsProps {
  userId: string;
  onClose: () => void;
}

/**
 * Contacts Component
 * Full contact management interface using ContactSearchList for consistent UX
 * - List all contacts (imported + external from Contacts App)
 * - Import external contacts
 * - Add/Edit/Delete contacts
 * - View contact details
 */
function Contacts({ userId, onClose }: ContactsProps) {
  // Database initialization guard (belt-and-suspenders defense)
  const { isDatabaseInitialized } = useAppStateMachine();

  // Modal states
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedContact, setSelectedContact] = useState<
    ExtendedContact | undefined
  >(undefined);

  // ContactPreview state (for external contacts)
  const [previewContact, setPreviewContact] = useState<ExtendedContact | null>(
    null
  );
  const [previewTransactions, setPreviewTransactions] = useState<
    ContactTransaction[]
  >([]);
  const [loadingPreviewTransactions, setLoadingPreviewTransactions] =
    useState(false);

  // Track imported contact IDs for visual feedback
  const [importedContactIds, setImportedContactIds] = useState<Set<string>>(
    new Set()
  );

  // Clear stale imported IDs when a contact is deleted
  const handleContactDeleted = useCallback(() => {
    // Clear all imported IDs - the external contact may reappear and shouldn't show checkmark
    setImportedContactIds(new Set());
  }, []);

  // Contact list and removal state
  const {
    contacts,
    loading,
    error,
    loadContacts,
    silentLoadContacts,
    handleRemoveContact,
    handleConfirmRemove,
    showRemoveConfirmation,
    setShowRemoveConfirmation,
    setContactToRemove,
    showBlockingModal,
    setShowBlockingModal,
    blockingTransactions,
    setBlockingTransactions,
    // External contacts (from macOS Contacts app, etc.)
    externalContacts,
    externalContactsLoading,
    reloadExternalContacts,
  } = useContactList(userId, { onContactDeleted: handleContactDeleted });

  // Helper to check if a contact is external (message-derived or from Contacts app)
  const isExternal = (contact: ExtendedContact): boolean => {
    return contact.is_message_derived === 1 || contact.is_message_derived === true;
  };

  // DEFENSIVE CHECK: Return loading state if database not initialized
  if (!isDatabaseInitialized) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
        <div className="flex-shrink-0 h-8" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Waiting for database...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle clicking on a contact to view details
  const handleContactClick = useCallback((contact: ExtendedContact) => {
    if (isExternal(contact)) {
      // External contact - show preview with import option
      setPreviewContact(contact);
      setPreviewTransactions([]);
      setLoadingPreviewTransactions(false);
    } else {
      // Imported contact - show full details modal
      setSelectedContact(contact);
      setShowDetails(true);
    }
  }, []);

  // Handle importing an external contact (from ContactSearchList's + Add Contact button)
  const handleImportContact = useCallback(
    async (contact: ExtendedContact): Promise<ExtendedContact> => {
      const contactName = contact.display_name || contact.name || "";

      try {
        const result = await window.api.contacts.create(userId, {
          name: contactName,
          email: contact.email || contact.allEmails?.[0] || "",
          phone: contact.phone || contact.allPhones?.[0] || "",
          company: contact.company || "",
          title: contact.title || "",
          source: "contacts_app",
        });

        if (result.success && result.contact) {
          // Mark as imported for visual feedback
          setImportedContactIds((prev) => new Set(prev).add(contact.id));
          // Silent refresh to avoid showing loading state
          await silentLoadContacts();
          return result.contact as ExtendedContact;
        }

        throw new Error(result.error || "Failed to import contact");
      } catch (err) {
        console.error("Failed to import contact:", err);
        throw err;
      }
    },
    [userId, silentLoadContacts]
  );

  // Handle importing from preview modal
  const handlePreviewImport = async () => {
    if (!previewContact) return;

    const hasName = !!(previewContact.display_name || previewContact.name);
    const hasEmail = !!(previewContact.email || previewContact.allEmails?.[0]);
    const hasPhone = !!(previewContact.phone || previewContact.allPhones?.[0]);

    if (!hasName || (!hasEmail && !hasPhone)) {
      // Missing required data - open edit form
      setPreviewContact(null);
      setSelectedContact(previewContact);
      setShowAddEdit(true);
      return;
    }

    try {
      await handleImportContact(previewContact);
      setPreviewContact(null);
    } catch (err) {
      console.error("Failed to import contact:", err);
    }
  };

  // Handle editing from preview modal
  const handlePreviewEdit = () => {
    if (previewContact) {
      setPreviewContact(null);
      setSelectedContact(previewContact);
      setShowAddEdit(true);
    }
  };

  // Handle adding a new contact manually
  const handleAddManually = () => {
    setSelectedContact(undefined);
    setShowAddEdit(true);
  };

  // Handle editing a contact from details modal
  const handleEditContact = (contact: ExtendedContact) => {
    setShowDetails(false);
    setSelectedContact(contact);
    setShowAddEdit(true);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between shadow-lg" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-4 py-2 transition-all flex items-center gap-2 font-medium"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Dashboard
        </button>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-white">Contacts</h2>
          <p className="text-purple-100 text-sm">
            {contacts.length + externalContacts.length} contacts
            {externalContacts.length > 0 &&
              ` (${externalContacts.length} from Contacts App)`}
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* ContactSearchList - main content area */}
      <div className="flex-1 min-h-0 bg-white mx-4 my-4 rounded-xl shadow-lg overflow-hidden">
        <ContactSearchList
          contacts={contacts}
          externalContacts={externalContacts}
          selectedIds={[]}
          onSelectionChange={() => {}}
          onContactClick={handleContactClick}
          onImportContact={handleImportContact}
          onAddManually={handleAddManually}
          addedContactIds={importedContactIds}
          isLoading={loading || externalContactsLoading}
          error={error}
          searchPlaceholder="Search contacts by name, email, or phone..."
          showCategoryFilter={true}
          sortOrder="alphabetical"
          className="h-full"
        />
      </div>

      {/* Contact Preview Modal (for external contacts) */}
      {previewContact && (
        <ContactPreview
          contact={previewContact}
          isExternal={isExternal(previewContact)}
          transactions={previewTransactions}
          isLoadingTransactions={loadingPreviewTransactions}
          onEdit={handlePreviewEdit}
          onImport={handlePreviewImport}
          onClose={() => setPreviewContact(null)}
        />
      )}

      {/* Add/Edit Contact Modal */}
      {showAddEdit && (
        <ContactFormModal
          userId={userId}
          contact={selectedContact}
          onClose={() => {
            setShowAddEdit(false);
            setSelectedContact(undefined);
          }}
          onSuccess={() => {
            setShowAddEdit(false);
            setSelectedContact(undefined);
            loadContacts();
          }}
        />
      )}

      {/* Contact Details Modal (for imported contacts) */}
      {showDetails && selectedContact && (
        <ContactDetailsModal
          contact={selectedContact}
          onClose={() => {
            setShowDetails(false);
            setSelectedContact(undefined);
          }}
          onEdit={() => handleEditContact(selectedContact)}
          onRemove={() => {
            setShowDetails(false);
            handleRemoveContact(selectedContact.id);
          }}
        />
      )}

      {/* Blocking Modal - Cannot Delete Contact with Transactions */}
      {showBlockingModal && (
        <BlockingTransactionsModal
          transactions={blockingTransactions}
          onClose={() => {
            setShowBlockingModal(false);
            setBlockingTransactions([]);
          }}
        />
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirmation && (
        <RemoveConfirmationModal
          onClose={() => {
            setShowRemoveConfirmation(false);
            setContactToRemove(null);
          }}
          onConfirm={handleConfirmRemove}
        />
      )}
    </div>
  );
}

export default Contacts;
