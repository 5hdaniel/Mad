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
  const [emailCountProgress, setEmailCountProgress] = useState({ current: 0, total: 0, eta: 0 });
  const [contactInfoModal, setContactInfoModal] = useState(null);
  const [abortEmailCounting, setAbortEmailCounting] = useState(null); // Now stores the abort function

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (outlookConnected && conversations.length > 0) {
      const abortFn = loadEmailCounts();
      // Store the abort function so the skip button can call it
      if (abortFn) {
        setAbortEmailCounting(() => abortFn);
      }
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
    const contactsWithEmail = conversations.filter(c => c.emails && c.emails.length > 0);

    if (contactsWithEmail.length === 0) {
      console.log('No contacts with email addresses found');
      return;
    }

    console.log(`\n=== Starting Email Count Load (Optimized Bulk Fetch) ===`);
    console.log(`Contacts with emails: ${contactsWithEmail.length}`);

    // Collect all unique email addresses
    const allEmailAddresses = new Set();
    contactsWithEmail.forEach(c => {
      c.emails.forEach(email => allEmailAddresses.add(email.toLowerCase()));
    });
    const uniqueEmails = Array.from(allEmailAddresses);

    console.log(`Total unique email addresses: ${uniqueEmails.length}`);
    console.log(`\nOLD ARCHITECTURE: Would make ${uniqueEmails.length} sequential API calls (60+ minutes)`);
    console.log(`NEW ARCHITECTURE: Making 1 bulk API call to fetch and index all emails (10-30 seconds)`);

    const startTime = Date.now();

    // Use a ref to track abort state that can be checked synchronously
    let aborted = false;

    setAbortEmailCounting(null); // Reset abort function
    setLoadingEmailCounts(true);
    setEmailCountProgress({
      current: 0,
      total: 1, // Just one bulk operation
      eta: 0,
      phase: 'fetching'
    });

    try {
      // Setup progress listener for bulk fetch
      const progressHandler = (progress) => {
        if (aborted) return;

        setEmailCountProgress({
          current: progress.pagesLoaded || 0,
          total: Math.max(progress.pagesLoaded * 2, 100), // Rough estimate
          eta: progress.eta || 0,
          emailsFetched: progress.emailsFetched,
          phase: 'fetching'
        });
      };

      window.electron.onBulkEmailProgress(progressHandler);

      // Make the bulk API call - this fetches ALL emails once and indexes them
      // Note: This will continue in background even if user skips, but we won't apply results
      const result = await window.electron.outlookBulkGetEmailCounts(uniqueEmails, true);

      // Check the ref variable set by skip button
      if (aborted) {
        console.log('\nEmail counting skipped by user - discarding results');
        return;
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch email counts');
      }

      const emailCountsByAddress = result.counts; // Map of email -> count

      // Now map the counts back to contacts
      setEmailCountProgress({
        current: 0,
        total: contactsWithEmail.length,
        eta: 0,
        phase: 'mapping'
      });

      const counts = {};
      let totalEmailsFound = 0;

      contactsWithEmail.forEach((conv, idx) => {
        // Sum up counts for all email addresses for this contact
        let totalCount = 0;
        conv.emails.forEach(email => {
          const emailLower = email.toLowerCase();
          if (emailCountsByAddress[emailLower]) {
            totalCount += emailCountsByAddress[emailLower];
          }
        });

        counts[conv.id] = totalCount;
        totalEmailsFound += totalCount;

        // Update progress
        if (idx % 10 === 0 || idx === contactsWithEmail.length - 1) {
          setEmailCountProgress({
            current: idx + 1,
            total: contactsWithEmail.length,
            eta: 0,
            phase: 'mapping'
          });
        }
      });

      const totalTime = Date.now() - startTime;

      console.log(`\n=== Bulk Email Count Complete ===`);
      console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
      console.log(`Contacts processed: ${contactsWithEmail.length}`);
      console.log(`Unique email addresses: ${uniqueEmails.length}`);
      console.log(`Total emails found: ${totalEmailsFound}`);
      console.log(`Contacts with emails: ${Object.values(counts).filter(c => c > 0).length}`);
      console.log(`\nPerformance Improvement: ~${Math.round(60 / (totalTime / 1000))}x faster than old sequential approach!`);

      // Set all counts at once
      setEmailCounts(counts);
    } catch (err) {
      console.error('Error loading email counts:', err);
      setError('Failed to load email counts. Please try again.');
    } finally {
      setLoadingEmailCounts(false);
    }

    // Return a function that can abort this operation
    return () => {
      aborted = true;
      setLoadingEmailCounts(false);
      console.log('\nEmail counting aborted by user');
    };
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
            Select All
          </button>

          <button
            onClick={deselectAll}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Deselect All
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
              {isExporting ? 'Exporting...' : `Export ${selectedIds.size} Text Message Audit${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
            {outlookConnected && (
              <button
                onClick={handleOutlookExport}
                disabled={selectedIds.size === 0 || isExporting}
                className="bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Export {selectedIds.size} Full Audit{selectedIds.size !== 1 ? 's' : ''} (Messages + Emails)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Email Count Loading Overlay */}
      {loadingEmailCounts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Counting Emails</h3>
              <p className="text-sm text-gray-600 mb-1">
                {emailCountProgress.phase === 'fetching' ? (
                  'Fetching and indexing all emails from Outlook...'
                ) : emailCountProgress.phase === 'mapping' ? (
                  'Mapping email counts to contacts...'
                ) : (
                  'Estimating the number of emails per contact'
                )}
              </p>
              {emailCountProgress.emailsFetched > 0 && (
                <p className="text-xs text-gray-500 mb-2">
                  {emailCountProgress.emailsFetched.toLocaleString()} emails processed
                </p>
              )}
              {emailCountProgress.total > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                    <span>
                      {emailCountProgress.phase === 'fetching' ? (
                        `Page ${emailCountProgress.current} of ~${emailCountProgress.total}`
                      ) : emailCountProgress.phase === 'mapping' ? (
                        `Contact ${emailCountProgress.current} of ${emailCountProgress.total}`
                      ) : (
                        `${emailCountProgress.current} of ${emailCountProgress.total}`
                      )}
                    </span>
                    <span className="font-semibold">
                      {Math.round((emailCountProgress.current / emailCountProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(emailCountProgress.current / emailCountProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  {emailCountProgress.eta > 0 && (
                    <p className="text-xs text-gray-500 mb-4">
                      Estimated time remaining: {emailCountProgress.eta > 60
                        ? `${Math.floor(emailCountProgress.eta / 60)}m ${emailCountProgress.eta % 60}s`
                        : `${emailCountProgress.eta}s`}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      if (abortEmailCounting) {
                        abortEmailCounting();
                      }
                    }}
                    className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Skip
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
