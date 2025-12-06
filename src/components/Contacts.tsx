import React, { useState, useEffect } from 'react';
import type { Contact, ContactSource, Transaction } from '../../electron/types/models';

// Extended contact type with additional fields from Contacts app
interface ExtendedContact extends Contact {
  allEmails?: string[];
  allPhones?: string[];
}

// Transaction with roles field
interface TransactionWithRoles extends Transaction {
  roles?: string;
}

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
  const [contacts, setContacts] = useState<ExtendedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ExtendedContact | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [blockingTransactions, setBlockingTransactions] = useState<TransactionWithRoles[]>([]);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [contactToRemove, setContactToRemove] = useState<string | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const result = await window.api.contacts.getAll(userId);

      if (result.success) {
        setContacts(result.contacts || []);
      } else {
        setError(result.error || 'Failed to load contacts');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contacts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    // Show import modal first
    setShowImport(true);
  };

  const handleAddManually = () => {
    setShowImport(false);
    setSelectedContact(undefined);
    setShowAddEdit(true);
  };

  const handleViewContact = (contact: ExtendedContact) => {
    setSelectedContact(contact);
    setShowDetails(true);
  };

  const handleEditContact = (contact: ExtendedContact) => {
    setShowDetails(false);
    setSelectedContact(contact);
    setShowAddEdit(true);
  };

  const _handleDeleteContact = async (contactId: string) => {
    try {
      // First check if contact has associated transactions
      const checkResult = await window.api.contacts.checkCanDelete(contactId);

      if (checkResult.error) {
        alert(`Failed to check contact: ${checkResult.error}`);
        return;
      }

      // If contact has associated transactions, show blocking modal
      if (!checkResult.canDelete) {
        alert(`Cannot delete contact: They are associated with ${checkResult.transactionCount || 0} transactions`);
        return;
      }

      // Otherwise proceed with confirmation and deletion
      if (!confirm('Are you sure you want to delete this contact?')) {
        return;
      }

      const result = await window.api.contacts.delete(contactId);
      if (result.success) {
        loadContacts();
      } else {
        alert(`Failed to delete contact: ${result.error}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete contact';
      alert(`Failed to delete contact: ${errorMessage}`);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    try {
      // First check if contact has associated transactions
      const checkResult = await window.api.contacts.checkCanDelete(contactId);

      if (checkResult.error) {
        alert(`Failed to check contact: ${checkResult.error}`);
        return;
      }

      // If contact has associated transactions, show blocking modal
      if (!checkResult.canDelete) {
        alert(`Cannot delete contact: They are associated with ${checkResult.transactionCount || 0} transactions`);
        return;
      }

      // Otherwise show custom confirmation modal
      setContactToRemove(contactId);
      setShowRemoveConfirmation(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check contact';
      alert(`Failed to check contact: ${errorMessage}`);
    }
  };

  const handleConfirmRemove = async () => {
    if (!contactToRemove) return;

    try {
      const result = await window.api.contacts.remove(contactToRemove);
      if (result.success) {
        loadContacts();
      } else {
        alert(`Failed to remove contact: ${result.error}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove contact';
      alert(`Failed to remove contact: ${errorMessage}`);
    } finally {
      setShowRemoveConfirmation(false);
      setContactToRemove(null);
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSourceBadge = (source: ContactSource) => {
    const badges: Record<ContactSource, { text: string; color: string }> = {
      manual: { text: 'Manual', color: 'bg-blue-100 text-blue-700' },
      email: { text: 'From Email', color: 'bg-green-100 text-green-700' },
      contacts_app: { text: 'Contacts App', color: 'bg-purple-100 text-purple-700' },
    };
    return badges[source] || badges.manual;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-6 flex items-center justify-between shadow-lg">
        <button
          onClick={onClose}
          className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-4 py-2 transition-all flex items-center gap-2 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-white">Contacts</h2>
          <p className="text-purple-100 text-sm">{contacts.length} contacts total</p>
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

          {/* Add Contact Button */}
          <button
            onClick={handleAddContact}
            className="px-4 py-2 rounded-lg font-semibold transition-all bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
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
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <p className="text-xs font-medium whitespace-nowrap">Click "Add Contact" to begin</p>
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
                {searchQuery ? 'No matching contacts' : 'No contacts yet'}
              </h3>
              <p className="text-gray-600">
                {searchQuery
                  ? 'Try adjusting your search'
                  : 'Get started by adding your first contact'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleViewContact(contact)}
                className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-purple-400 hover:shadow-xl transition-all flex flex-col h-full cursor-pointer"
              >
                {/* Contact Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {contact.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getSourceBadge(contact.source).color}`}>
                        {getSourceBadge(contact.source).text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Details */}
                <div className="space-y-2 mb-4 text-sm flex-1">
                  {/* Show all emails for Contacts app contacts, or just primary email for manual contacts */}
                  {contact.source === 'contacts_app' && contact.allEmails && contact.allEmails.length > 0 ? (
                    contact.allEmails.map((email: string, idx: number) => (
                      <div key={`email-${idx}`} className="flex items-center gap-2 text-gray-600">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{email}</span>
                      </div>
                    ))
                  ) : contact.email ? (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{contact.email}</span>
                    </div>
                  ) : null}

                  {/* Show all phones for Contacts app contacts, or just primary phone for manual contacts */}
                  {contact.source === 'contacts_app' && contact.allPhones && contact.allPhones.length > 0 ? (
                    contact.allPhones.map((phone: string, idx: number) => (
                      <div key={`phone-${idx}`} className="flex items-center gap-2 text-gray-600">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{phone}</span>
                      </div>
                    ))
                  ) : contact.phone ? (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{contact.phone}</span>
                    </div>
                  ) : null}

                  {contact.company && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="truncate">{contact.company}</span>
                    </div>
                  )}
                  {contact.title && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{contact.title}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import Contacts Modal */}
      {showImport && (
        <ImportContactsModal
          userId={userId}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            loadContacts();
          }}
          onAddManually={handleAddManually}
        />
      )}

      {/* Add/Edit Contact Modal */}
      {showAddEdit && (
        <ContactModal
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-red-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Cannot Delete Contact</h3>
                  <p className="text-sm text-gray-600">This contact is associated with active transactions</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBlockingModal(false);
                  setBlockingTransactions([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <p className="text-gray-700">
                  This contact cannot be deleted because they are associated with <span className="font-semibold text-red-600">{blockingTransactions.length} transaction{blockingTransactions.length !== 1 ? 's' : ''}</span>.
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  To delete this contact, you must first remove them from all associated transactions or delete the transactions.
                </p>
              </div>

              {/* Transactions List */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 mb-3">Associated Transactions:</h4>
                {blockingTransactions.slice(0, 20).map((txn: TransactionWithRoles) => (
                  <div
                    key={txn.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <h5 className="font-semibold text-gray-900">{txn.property_address}</h5>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {txn.roles && (
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="font-medium text-purple-600">{txn.roles}</span>
                            </div>
                          )}
                          {txn.transaction_type && (
                            <div className="flex items-center gap-1">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                txn.transaction_type === 'purchase'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {txn.transaction_type === 'purchase' ? 'Purchase' : 'Sale'}
                              </span>
                            </div>
                          )}
                          {txn.status && (
                            <div className="flex items-center gap-1">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                txn.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {txn.status === 'active' ? 'Active' : 'Closed'}
                              </span>
                            </div>
                          )}
                          {txn.closing_date && (
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{new Date(txn.closing_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {blockingTransactions.length > 20 && (
                  <div className="text-center py-3 text-gray-600">
                    <p className="text-sm">... and {blockingTransactions.length - 20} more transaction{blockingTransactions.length - 20 !== 1 ? 's' : ''}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-end">
              <button
                onClick={() => {
                  setShowBlockingModal(false);
                  setBlockingTransactions([]);
                }}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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

interface RemoveConfirmationModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Remove Confirmation Modal
 * Custom UI confirmation dialog for removing a contact
 */
function RemoveConfirmationModal({ onClose, onConfirm }: RemoveConfirmationModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Remove Contact</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700">
            Remove this contact from your local database? You can re-import it later if needed.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

interface ImportContactsModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
  onAddManually: () => void;
}

/**
 * Import Contacts Modal
 * Browse and import contacts from external sources (Contacts app, Outlook)
 */
function ImportContactsModal({ userId, onClose, onSuccess, onAddManually }: ImportContactsModalProps) {
  const [availableContacts, setAvailableContacts] = useState<ExtendedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState(new Set<string>());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadAvailableContacts();
  }, []);

  const loadAvailableContacts = async () => {
    try {
      setLoading(true);
      const result = await window.api.contacts.getAvailable(userId);

      if (result.success) {
        setAvailableContacts(result.contacts || []);
      } else {
        setError(result.error || 'Failed to load available contacts');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load available contacts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleImportSelected = async () => {
    if (selectedContacts.size === 0) {
      setError('Please select at least one contact to import');
      return;
    }

    setImporting(true);
    setError(undefined);

    try {
      const contactsToImport = availableContacts.filter(c => selectedContacts.has(c.id));
      const result = await window.api.contacts.import(userId, contactsToImport);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Failed to import contacts');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import contacts';
      setError(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const filteredContacts = availableContacts.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white">Import Contacts</h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Add Manually */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search available contacts..."
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

            {/* Add Manually Button */}
            <button
              onClick={onAddManually}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Manually
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Selected count */}
          {selectedContacts.size > 0 && (
            <div className="mt-3 text-sm text-purple-600 font-medium">
              {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading available contacts...</p>
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
                  {searchQuery ? 'No matching contacts' : 'No available contacts'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery
                    ? 'Try adjusting your search or add the contact manually.'
                    : 'All contacts from your Contacts app have been imported, or no contacts are available.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={onAddManually}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all"
                  >
                    Add "{searchQuery}" Manually
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => handleToggleContact(contact.id)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedContacts.has(contact.id)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedContacts.has(contact.id)
                          ? 'bg-purple-500 border-purple-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedContacts.has(contact.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {contact.name?.charAt(0).toUpperCase() || '?'}
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">{contact.name}</div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {contact.email && <div className="truncate">{contact.email}</div>}
                        {contact.phone && <div>{contact.phone}</div>}
                        {contact.company && <div className="truncate">{contact.company}</div>}
                      </div>
                    </div>

                    {/* Source Badge */}
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                      {contact.source === 'contacts_app' ? 'Contacts App' : 'Outlook'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleImportSelected}
            disabled={importing || selectedContacts.size === 0}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              importing || selectedContacts.size === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700'
            }`}
          >
            {importing ? 'Importing...' : `Import Selected (${selectedContacts.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ContactDetailsModalProps {
  contact: ExtendedContact;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

/**
 * Contact Details Modal
 * View contact details with edit/remove options
 */
function ContactDetailsModal({ contact, onClose, onEdit, onRemove }: ContactDetailsModalProps) {
  const getSourceBadge = (source: ContactSource) => {
    const badges: Record<ContactSource, { text: string; color: string }> = {
      manual: { text: 'Manual', color: 'bg-blue-100 text-blue-700' },
      email: { text: 'From Email', color: 'bg-green-100 text-green-700' },
      contacts_app: { text: 'Contacts App', color: 'bg-purple-100 text-purple-700' },
    };
    return badges[source] || badges.manual;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-lg font-bold text-white">Contact Details</h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contact Info */}
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {contact.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{contact.name}</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${getSourceBadge(contact.source).color}`}>
                {getSourceBadge(contact.source).text}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Show all emails for Contacts app contacts */}
            {contact.source === 'contacts_app' && contact.allEmails && contact.allEmails.length > 0 ? (
              contact.allEmails.map((email: string, idx: number) => (
                <div key={`email-${idx}`} className="flex items-center gap-3 text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{email}</span>
                </div>
              ))
            ) : contact.email ? (
              <div className="flex items-center gap-3 text-gray-700">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{contact.email}</span>
              </div>
            ) : null}

            {/* Show all phones for Contacts app contacts */}
            {contact.source === 'contacts_app' && contact.allPhones && contact.allPhones.length > 0 ? (
              contact.allPhones.map((phone: string, idx: number) => (
                <div key={`phone-${idx}`} className="flex items-center gap-3 text-gray-700">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{phone}</span>
                </div>
              ))
            ) : contact.phone ? (
              <div className="flex items-center gap-3 text-gray-700">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{contact.phone}</span>
              </div>
            ) : null}

            {contact.company && (
              <div className="flex items-center gap-3 text-gray-700">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{contact.company}</span>
              </div>
            )}

            {contact.title && (
              <div className="flex items-center gap-3 text-gray-700">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{contact.title}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3">
          {contact.source === 'contacts_app' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
              >
                Close
              </button>
              <button
                onClick={onRemove}
                className="flex-1 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-all"
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
              >
                Close
              </button>
              <button
                onClick={onEdit}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all"
              >
                Edit
              </button>
              <button
                onClick={onRemove}
                className="flex-1 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-all"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ContactModalProps {
  userId: string;
  contact: ExtendedContact | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
}

/**
 * Contact Modal
 * Add or edit a contact
 */
function ContactModal({ userId, contact, onClose, onSuccess }: ContactModalProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    company: contact?.company || '',
    title: contact?.title || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(undefined);

    try {
      let result;
      if (contact) {
        // Update existing contact
        result = await window.api.contacts.update(contact.id, formData as unknown as Record<string, unknown>);
      } else {
        // Create new contact
        result = await window.api.contacts.create(userId, formData as unknown as Record<string, unknown>);
      }

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Failed to save contact');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save contact';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-lg font-bold text-white">
            {contact ? 'Edit Contact' : 'Add New Contact'}
          </h3>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="John Doe"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="john@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="(555) 123-4567"
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleChange('company', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="ABC Real Estate"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="Real Estate Agent"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700'
            }`}
          >
            {saving ? 'Saving...' : contact ? 'Update Contact' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Contacts;
