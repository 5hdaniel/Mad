import React, { useState, useEffect } from 'react';

/**
 * Import Contacts Modal
 * Search and import contacts from external sources (Contacts app, Outlook, Gmail)
 *
 * Features:
 * - Search external contacts
 * - Multi-select contacts to import
 * - Add manually option
 * - Import to database
 */
function ImportContactsModal({ userId, onClose, onImportComplete }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [externalContacts, setExternalContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [error, setError] = useState(null);

  // Manual contact form data
  const [manualFormData, setManualFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
  });

  useEffect(() => {
    loadExternalContacts();
  }, []);

  const loadExternalContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.contacts.searchExternal('');

      if (result.success) {
        setExternalContacts(result.contacts || []);
      } else {
        setError(result.error || 'Failed to load external contacts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.api.contacts.searchExternal(searchQuery);

      if (result.success) {
        setExternalContacts(result.contacts || []);
      } else {
        setError(result.error || 'Failed to search contacts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleContact = (contact) => {
    setSelectedContacts((prev) => {
      const isSelected = prev.some(c => c.id === contact.id);
      if (isSelected) {
        return prev.filter(c => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const handleImport = async () => {
    if (selectedContacts.length === 0) return;

    try {
      setImporting(true);
      setError(null);

      const result = await window.api.contacts.importMultiple(userId, selectedContacts);

      if (result.success) {
        onImportComplete(result.contacts);
      } else {
        setError(result.error || 'Failed to import contacts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleManualFormChange = (field, value) => {
    setManualFormData({ ...manualFormData, [field]: value });
  };

  const handleSaveManual = async () => {
    if (!manualFormData.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setImporting(true);
      setError(null);

      const result = await window.api.contacts.create(userId, {
        ...manualFormData,
        source: 'manual',
      });

      if (result.success) {
        onImportComplete([result.contact]);
      } else {
        setError(result.error || 'Failed to create contact');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const filteredContacts = externalContacts.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  if (showManualForm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
            <h3 className="text-lg font-bold text-white">Add Contact Manually</h3>
            <button
              onClick={() => setShowManualForm(false)}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={manualFormData.name}
                onChange={(e) => handleManualFormChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={manualFormData.email}
                onChange={(e) => handleManualFormChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={manualFormData.phone}
                onChange={(e) => handleManualFormChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input
                type="text"
                value={manualFormData.company}
                onChange={(e) => handleManualFormChange('company', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="ABC Real Estate"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={manualFormData.title}
                onChange={(e) => handleManualFormChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Real Estate Agent"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-end">
            <button
              onClick={() => setShowManualForm(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
            >
              Back
            </button>
            <button
              onClick={handleSaveManual}
              disabled={importing}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                importing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700'
              }`}
            >
              {importing ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-white">Import Contacts</h3>
            <p className="text-purple-100 text-sm">
              {selectedContacts.length > 0
                ? `${selectedContacts.length} contact${selectedContacts.length > 1 ? 's' : ''} selected`
                : 'Search and select contacts to import'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search contacts by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
            <button
              onClick={() => setShowManualForm(true)}
              className="px-4 py-2 bg-white text-purple-600 border-2 border-purple-500 rounded-lg font-semibold hover:bg-purple-50 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Manually
            </button>
          </div>
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading contacts...</p>
              </div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12">
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
              <p className="text-gray-600 mb-4">No contacts found</p>
              <button
                onClick={() => setShowManualForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all"
              >
                Add Manually
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContacts.some(c => c.id === contact.id);
                return (
                  <button
                    key={contact.id}
                    onClick={() => handleToggleContact(contact)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && (
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
                        <h4 className="font-semibold text-gray-900 truncate">{contact.name}</h4>
                        <div className="text-sm text-gray-600 space-y-0.5 mt-1">
                          {contact.allEmails?.length > 0 ? (
                            contact.allEmails.map((email, idx) => (
                              <p key={idx} className="truncate">{email}</p>
                            ))
                          ) : contact.email ? (
                            <p className="truncate">{contact.email}</p>
                          ) : null}
                          {contact.allPhones?.length > 0 ? (
                            contact.allPhones.slice(0, 2).map((phone, idx) => (
                              <p key={idx} className="truncate">{phone}</p>
                            ))
                          ) : contact.phone ? (
                            <p className="truncate">{contact.phone}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 rounded-b-xl flex items-center gap-3 justify-end border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={selectedContacts.length === 0 || importing}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              selectedContacts.length === 0 || importing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 shadow-md hover:shadow-lg'
            }`}
          >
            {importing ? 'Importing...' : `Import ${selectedContacts.length > 0 ? `(${selectedContacts.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportContactsModal;
