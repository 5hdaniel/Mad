import React, { useState, useEffect } from 'react';
import type { Contact } from '@/types';

interface SourceBadgeConfig {
  text: string;
  color: string;
}

interface ContactListComponentProps {
  userId: string;
  onClose: () => void;
}

/**
 * ContactList Component
 * Full contact management interface
 * - List all contacts
 * - Add/Edit/Delete contacts
 * - View contact details
 */
function ContactList({ userId, onClose }: ContactListComponentProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async (): Promise<void> => {
    try {
      setLoading(true);
      const result = await window.api.contacts.getAll(userId);

      if (result.success) {
        setContacts(result.contacts || []);
      } else {
        setError(result.error || 'Failed to load contacts');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContact = (contact: Contact): void => {
    setSelectedContact(contact);
    setShowDetails(true);
  };

  const handleDeleteContact = async (contactId: string): Promise<void> => {
    try {
      // First check if contact has associated transactions
      const checkResult = await window.api.contacts.checkCanDelete(contactId);

      if (checkResult.error) {
        alert(`Failed to check contact: ${checkResult.error}`);
        return;
      }

      // If contact has associated transactions, show error
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
      alert(`Failed to delete contact: ${(err as Error).message}`);
    }
  };

  const filteredContacts = contacts.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSourceBadge = (source: string | undefined): SourceBadgeConfig => {
    const badges: Record<string, SourceBadgeConfig> = {
      manual: { text: 'Manual', color: 'bg-blue-100 text-blue-700' },
      email: { text: 'From Email', color: 'bg-green-100 text-green-700' },
      contacts_app: { text: 'Contacts App', color: 'bg-purple-100 text-purple-700' },
    };
    return badges[source || 'manual'] || badges.manual;
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
            onClick={() => alert('Add contact functionality to be implemented')}
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
                  {contact.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}

                  {contact.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{contact.phone}</span>
                    </div>
                  )}

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

      {/* Contact Details will be handled by ContactDetails component */}
      {showDetails && selectedContact && (
        <div>Contact details component will be imported here</div>
      )}
    </div>
  );
}

export default ContactList;
