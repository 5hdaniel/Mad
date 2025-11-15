import React, { useState, useEffect, useRef } from 'react';
import Joyride from 'react-joyride';
import confetti from 'canvas-confetti';

function ConversationList({ onExportComplete, onOutlookExport, onConnectOutlook, outlookConnected }) {
  const [conversations, setConversations] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [contactInfoModal, setContactInfoModal] = useState(null);
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  // Start tour when conversations are loaded
  useEffect(() => {
    if (conversations.length > 0 && !isLoading) {
      const hasSeenTour = localStorage.getItem('hasSeenExportTour');
      if (!hasSeenTour) {
        setTimeout(() => setRunTour(true), 500);
      }
    }
  }, [conversations, isLoading]);

  // Tour steps for export screen features
  const tourSteps = [
    {
      target: 'body',
      content: 'Welcome to the Export screen! Let me show you around and explain the different features available.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="search"]',
      content: 'Use this search bar to quickly find contacts by name or phone number.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="select-all"]',
      content: 'Quickly select all contacts at once with this button.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="deselect-all"]',
      content: 'Or deselect all contacts with this button.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="export-section"]',
      content: 'This is where you choose how to export your conversations. You have multiple options:',
      placement: 'bottom',
    },
    {
      target: '[data-tour="export-all"]',
      content: outlookConnected
        ? 'Export both messages and emails for your selected contacts.'
        : 'Connect to Outlook to export both messages and emails together.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="export-emails"]',
      content: outlookConnected
        ? 'Export only emails (no text messages) for your selected contacts.'
        : 'This option will be available once you connect to Outlook.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="export-texts"]',
      content: 'Export only text messages (no emails) for your selected contacts.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="contact-list"]',
      content: 'Here you can see all your contacts. Click on a contact to select or deselect them for export.',
      placement: 'center',
    },
    {
      target: 'body',
      content: 'That\'s it! You\'re all set to start exporting your client conversations. Happy archiving!',
      placement: 'center',
    },
  ];

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = ['finished', 'skipped'];

    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      localStorage.setItem('hasSeenExportTour', 'true');

      // Trigger confetti when tour is completed (not skipped)
      if (status === 'finished') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  };

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
    setSelectedIds(new Set(filteredConversations.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
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
      {/* Joyride Tour */}
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        hideCloseButton
        disableScrolling={true}
        scrollToFirstStep={false}
        callback={handleJoyrideCallback}
        locale={{
          last: 'Done',
        }}
        styles={{
          options: {
            primaryColor: '#3b82f6',
            zIndex: 10000,
          },
        }}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Select Contacts for Export</h1>

        {/* Search and Select All */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative" data-tour="search">
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
            data-tour="select-all"
            onClick={selectAll}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Select All
          </button>

          <button
            data-tour="deselect-all"
            onClick={deselectAll}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Deselect All
          </button>
        </div>

        {/* Export Section */}
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50" data-tour="export-section">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Export</h3>
          <div className="flex gap-3">
            {/* All (Messages + Emails) */}
            {outlookConnected ? (
              <button
                data-tour="export-all"
                onClick={handleOutlookExport}
                disabled={selectedIds.size === 0 || isExporting}
                className="flex-1 bg-primary text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                All
              </button>
            ) : (
              <button
                data-tour="export-all"
                onClick={onConnectOutlook}
                className="flex-1 bg-blue-50 border-2 border-blue-300 text-blue-700 py-2.5 px-4 rounded-lg font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                All
              </button>
            )}

            {/* Only Emails */}
            {outlookConnected ? (
              <button
                data-tour="export-emails"
                onClick={() => alert('Email-only export coming soon!')}
                disabled={selectedIds.size === 0 || isExporting}
                className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Only Emails
              </button>
            ) : (
              <button
                data-tour="export-emails"
                onClick={onConnectOutlook}
                className="flex-1 bg-gray-200 border-2 border-gray-300 text-gray-500 py-2.5 px-4 rounded-lg font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                disabled
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Only Emails
              </button>
            )}

            {/* Only Texts */}
            <button
              data-tour="export-texts"
              onClick={handleExport}
              disabled={selectedIds.size === 0 || isExporting}
              className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Only Texts
            </button>
          </div>
        </div>
      </div>

      {/* Selection Count Bar */}
      <div className="bg-gray-100 border-b border-gray-200 py-3">
        <p className="text-sm text-gray-600 text-center font-medium">
          {selectedIds.size} of {filteredConversations.length} contacts selected
        </p>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-6" data-tour="contact-list">
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
                key={conversation.id || `contact-${conversation.name}-${conversation.contactId}`}
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
                        {/* Show chat statistics breakdown */}
                        {conversation.directChatCount > 0 && conversation.groupChatCount > 0 ? (
                          // Has both direct and group chats
                          <>
                            {conversation.directChatCount} direct message thread{conversation.directChatCount > 1 ? 's' : ''} ({conversation.directMessageCount} message{conversation.directMessageCount !== 1 ? 's' : ''})
                            {' and '}
                            {conversation.groupChatCount} group chat thread{conversation.groupChatCount > 1 ? 's' : ''} ({conversation.groupMessageCount} message{conversation.groupMessageCount !== 1 ? 's' : ''})
                          </>
                        ) : conversation.directChatCount > 0 ? (
                          // Only direct chats
                          <>
                            {conversation.directChatCount} direct message thread{conversation.directChatCount > 1 ? 's' : ''} ({conversation.directMessageCount} message{conversation.directMessageCount !== 1 ? 's' : ''})
                          </>
                        ) : conversation.groupChatCount > 0 ? (
                          // Only group chats
                          <>
                            {conversation.groupChatCount} group chat thread{conversation.groupChatCount > 1 ? 's' : ''} ({conversation.groupMessageCount} message{conversation.groupMessageCount !== 1 ? 's' : ''})
                          </>
                        ) : (
                          // Fallback to old format
                          <>{conversation.messageCount || 0} messages</>
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
