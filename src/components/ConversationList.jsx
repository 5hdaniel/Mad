import React, { useState, useEffect } from 'react';

function ConversationList({ onExportComplete, onOutlookExport, outlookConnected }) {
  const [conversations, setConversations] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [emailCounts, setEmailCounts] = useState({});
  const [loadingEmailCounts, setLoadingEmailCounts] = useState(false);
  const [contactInfoModal, setContactInfoModal] = useState(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (outlookConnected && conversations.length > 0) {
      loadEmailCounts();
    }
  }, [outlookConnected, conversations]);

  const loadConversations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.getConversations();

      if (result.success) {
        setConversations(result.conversations);
      } else {
        setError(result.error || 'Failed to load contacts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmailCounts = async () => {
    setLoadingEmailCounts(true);
    const counts = {};

    let contactsWithEmail = 0;
    let totalEmailsFound = 0;

    // Load email counts for contacts that have email addresses
    for (const conv of conversations) {
      if (conv.emails && conv.emails.length > 0) {
        contactsWithEmail++;

        // Get count for ALL emails for this contact
        let totalCount = 0;
        for (const email of conv.emails) {
          try {
            const result = await window.electron.outlookGetEmailCount(email);
            if (result.success) {
              totalCount += result.count;
            }
          } catch (err) {
            console.error(`Error loading email count for ${email}:`, err);
          }
        }

        counts[conv.id] = totalCount;
        totalEmailsFound += totalCount;
      }
    }

    console.log(`Email counts loaded: ${contactsWithEmail} contacts with emails, ${totalEmailsFound} total emails found`);
    setEmailCounts(counts);
    setLoadingEmailCounts(false);
  };

  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredConversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversations.map(c => c.id)));
    }
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one contact to export');
      return;
    }

    setIsExporting(true);

    try {
      const result = await window.electron.exportConversations(Array.from(selectedIds));

      if (result.success) {
        onExportComplete(result);
      } else if (!result.canceled) {
        setError(result.error || 'Export failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOutlookExport = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one contact to export');
      return;
    }

    if (onOutlookExport) {
      onOutlookExport(selectedIds);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No messages';

    // Convert Mac timestamp to readable date
    const macEpoch = new Date('2001-01-01T00:00:00Z').getTime();
    const date = new Date(macEpoch + (timestamp / 1000000));

    // Compare calendar days, not just time differences
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffTime = today - messageDay;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.contactId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Loading contacts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-full py-8">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Contacts</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadConversations}
            className="bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Select Contacts for Export</h1>

        {/* Search and Select All */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button
            onClick={selectAll}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {selectedIds.size === filteredConversations.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Selection Info */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {selectedIds.size} of {filteredConversations.length} contacts selected
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={selectedIds.size === 0 || isExporting}
              className="bg-white border-2 border-gray-300 text-gray-700 py-2 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Exporting...' : `Export Text Only ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
            </button>
            <button
              onClick={handleOutlookExport}
              disabled={selectedIds.size === 0 || isExporting}
              className="bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Export All (Messages & Emails)
            </button>
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500">No contacts found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => toggleSelection(conversation.id)}
                className={`p-4 bg-white border-2 rounded-lg cursor-pointer transition-all ${
                  selectedIds.has(conversation.id)
                    ? 'border-primary bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <div className={`flex-shrink-0 w-5 h-5 rounded border-2 mr-4 flex items-center justify-center ${
                      selectedIds.has(conversation.id)
                        ? 'bg-primary border-primary'
                        : 'border-gray-300'
                    }`}>
                      {selectedIds.has(conversation.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{conversation.name}</h3>

                      {/* Contact info summary */}
                      {(conversation.phones?.length > 0 || conversation.emails?.length > 0) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {conversation.phones?.length > 0 && (
                            <span>{conversation.phones.length} Phone{conversation.phones.length > 1 ? 's' : ''}</span>
                          )}
                          {conversation.phones?.length > 0 && conversation.emails?.length > 0 && ' · '}
                          {conversation.emails?.length > 0 && (
                            <span>{conversation.emails.length} Email{conversation.emails.length > 1 ? 's' : ''}</span>
                          )}
                        </p>
                      )}

                      <p className="text-sm text-gray-500 mt-1">
                        {conversation.messageCount || 0} messages
                        {outlookConnected && conversation.emails?.length > 0 && (
                          loadingEmailCounts ? (
                            <> · loading emails...</>
                          ) : emailCounts[conversation.id] !== undefined ? (
                            <> · {emailCounts[conversation.id]} emails</>
                          ) : null
                        )}
                        {' · '}
                        {formatDate(conversation.lastMessageDate)}
                      </p>
                    </div>
                  </div>

                  <div className="ml-4 flex gap-2 items-center">
                    {/* Contact Info Button */}
                    {(conversation.phones?.length > 0 || conversation.emails?.length > 0) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContactInfoModal(conversation);
                        }}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-blue-50 rounded transition-colors"
                        title="View contact info"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Info Modal */}
      {contactInfoModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setContactInfoModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{contactInfoModal.name}</h2>
              <button
                onClick={() => setContactInfoModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Phone Numbers */}
              {contactInfoModal.phones?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Phone Numbers ({contactInfoModal.phones.length})
                  </h3>
                  <div className="space-y-2">
                    {contactInfoModal.phones.map((phone, index) => (
                      <div key={index} className="flex items-center bg-gray-50 px-3 py-2 rounded">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-sm text-gray-900">{phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Addresses */}
              {contactInfoModal.emails?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Email Addresses ({contactInfoModal.emails.length})
                  </h3>
                  <div className="space-y-2">
                    {contactInfoModal.emails.map((email, index) => (
                      <div key={index} className="flex items-center bg-gray-50 px-3 py-2 rounded">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-900 break-all">{email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email count if connected to Outlook */}
              {outlookConnected && emailCounts[contactInfoModal.id] !== undefined && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">{emailCounts[contactInfoModal.id]}</span> emails found in mailbox
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setContactInfoModal(null)}
                className="w-full bg-primary text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConversationList;
