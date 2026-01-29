import React, { useState, useEffect, useMemo } from "react";
import {
  ContactCard,
  ContactDetailsModal,
  ContactFormModal,
  ImportContactsModal,
  RemoveConfirmationModal,
  BlockingTransactionsModal,
  useContactList,
  useContactSearch,
  ExtendedContact,
} from "./contact";
import { useAppStateMachine } from "../appCore";
import {
  ContactPreview,
  type ContactTransaction,
} from "./shared/ContactPreview";

// LocalStorage key for toggle persistence (shared with ContactSelectModal)
const SHOW_MESSAGE_CONTACTS_KEY = "contactModal.showMessageContacts";

interface ContactsProps {
  userId: string;
  onClose: () => void;
}

/**
 * Contacts Component
 * Full contact management interface
 * - List all contacts
 * - Add/Edit/Delete contacts
 * - View contact details
 */
function Contacts({ userId, onClose }: ContactsProps) {
  // Database initialization guard (belt-and-suspenders defense)
  const { isDatabaseInitialized } = useAppStateMachine();

  // Contact list and removal state
  const {
    contacts,
    loading,
    error,
    loadContacts,
    handleRemoveContact,
    handleConfirmRemove,
    showRemoveConfirmation,
    setShowRemoveConfirmation,
    setContactToRemove,
    showBlockingModal,
    setShowBlockingModal,
    blockingTransactions,
    setBlockingTransactions,
  } = useContactList(userId);

  // Toggle for showing message-derived contacts (default: hide them)
  const [showMessageContacts, setShowMessageContacts] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SHOW_MESSAGE_CONTACTS_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  // Persist toggle state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SHOW_MESSAGE_CONTACTS_KEY, String(showMessageContacts));
    } catch {
      // Ignore localStorage errors
    }
  }, [showMessageContacts]);

  // Helper to check if a contact is message-derived
  const isMessageDerived = (contact: ExtendedContact): boolean => {
    // is_message_derived can be number (1) or boolean (true)
    return contact.is_message_derived === 1 || contact.is_message_derived === true;
  };

  // Filter contacts based on message-derived toggle before passing to search
  const visibleContacts = useMemo(() => {
    if (showMessageContacts) {
      return contacts;
    }
    return contacts.filter((c) => !isMessageDerived(c));
  }, [contacts, showMessageContacts]);

  // Search and filtering (uses visibleContacts which respects the message-derived toggle)
  const { searchQuery, setSearchQuery, filteredContacts } =
    useContactSearch(visibleContacts);

  // Modal states
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedContact, setSelectedContact] = useState<
    ExtendedContact | undefined
  >(undefined);

  // ContactPreview state
  const [previewContact, setPreviewContact] = useState<ExtendedContact | null>(
    null
  );
  const [previewTransactions, setPreviewTransactions] = useState<
    ContactTransaction[]
  >([]);
  const [loadingPreviewTransactions, setLoadingPreviewTransactions] =
    useState(false);

  // DEFENSIVE CHECK: Return loading state if database not initialized
  // Should never trigger if AppShell gate works, but prevents errors if bypassed
  if (!isDatabaseInitialized) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Waiting for database...</p>
        </div>
      </div>
    );
  }

  const handleAddContact = () => {
    setShowImport(true);
  };

  const handleAddManually = () => {
    setShowImport(false);
    setSelectedContact(undefined);
    setShowAddEdit(true);
  };

  const handleViewContact = (contact: ExtendedContact) => {
    setPreviewContact(contact);
    // Note: Transaction loading API not yet available
    // The preview will show "No transactions yet" for now
    // This can be enhanced when contacts:getTransactions API is added
    setPreviewTransactions([]);
    setLoadingPreviewTransactions(false);
  };

  const handlePreviewEdit = () => {
    if (previewContact) {
      setPreviewContact(null);
      setSelectedContact(previewContact);
      setShowAddEdit(true);
    }
  };

  const handlePreviewImport = async () => {
    if (previewContact) {
      try {
        // Mark contact as imported by updating is_message_derived to false
        await window.api.contacts.update(previewContact.id, {
          is_message_derived: false,
        });
        setPreviewContact(null);
        // Refresh the contacts list to reflect the change
        await loadContacts();
      } catch (error) {
        console.error("Failed to import contact:", error);
      }
    }
  };

  const handleCardImport = async (contact: ExtendedContact) => {
    try {
      // Mark contact as imported by updating is_message_derived to false
      await window.api.contacts.update(contact.id, {
        is_message_derived: false,
      });
      // Refresh the contacts list to reflect the change
      await loadContacts();
    } catch (error) {
      console.error("Failed to import contact:", error);
    }
  };

  const handleViewDetails = (contact: ExtendedContact) => {
    setSelectedContact(contact);
    setShowDetails(true);
  };

  const handleEditContact = (contact: ExtendedContact) => {
    setShowDetails(false);
    setSelectedContact(contact);
    setShowAddEdit(true);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-6 flex items-center justify-between shadow-lg">
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-4 py-2 transition-all flex items-center gap-2 font-medium"
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
            {contacts.length} contacts total
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 p-6 bg-white shadow-md relative">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search contacts by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Toggle for message-derived contacts */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none flex-shrink-0 whitespace-nowrap">
            <input
              type="checkbox"
              checked={showMessageContacts}
              onChange={(e) => setShowMessageContacts(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
            <span>Include message contacts</span>
          </label>

          {/* Add Contact Button */}
          <button
            onClick={handleAddContact}
            className="px-4 py-2 rounded-lg font-semibold transition-all bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 shadow-md hover:shadow-lg flex items-center gap-2"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Contact
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Arrow pointing to Add Contact button - only show when no contacts */}
        {!loading && contacts.length === 0 && !searchQuery && (
          <div className="absolute right-6 top-full mt-2 flex flex-col items-center gap-1 text-purple-600 animate-bounce">
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
                d="M5 10l7-7m0 0l7 7m-7-7v18"
              />
            </svg>
            <p className="text-xs font-medium whitespace-nowrap">
              Click "Add Contact" to begin
            </p>
          </div>
        )}
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading contacts...</p>
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? "No matching contacts" : "No contacts yet"}
              </h3>
              <p className="text-gray-600">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Get started by adding your first contact"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={handleViewContact}
                onImport={handleCardImport}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contact Preview Modal */}
      {previewContact && (
        <ContactPreview
          contact={previewContact}
          isExternal={isMessageDerived(previewContact)}
          transactions={previewTransactions}
          isLoadingTransactions={loadingPreviewTransactions}
          onEdit={handlePreviewEdit}
          onImport={handlePreviewImport}
          onClose={() => setPreviewContact(null)}
        />
      )}

      {/* Import Contacts Modal */}
      {showImport && (
        <ImportContactsModal
          userId={userId}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            // Note: importedContactIds parameter is available but not needed here
            // since this is the main Contacts page, not a contact selection modal
            setShowImport(false);
            loadContacts();
          }}
          onAddManually={handleAddManually}
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

      {/* Contact Details Modal */}
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
