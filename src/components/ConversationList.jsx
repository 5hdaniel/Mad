import React, { useState, useEffect } from 'react';

function ConversationList({ onExportComplete }) {
  const [conversations, setConversations] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.getConversations();

      if (result.success) {
        setConversations(result.conversations);
      } else {
        setError(result.error || 'Failed to load conversations');
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
    if (selectedIds.size === filteredConversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversations.map(c => c.id)));
    }
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one conversation to export');
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

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No messages';

    // Convert Mac timestamp to readable date
    const macEpoch = new Date('2001-01-01T00:00:00Z').getTime();
    const date = new Date(macEpoch + (timestamp / 1000000));

    const now = new Date();
    const diffTime = Math.abs(now - date);
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
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Conversations</h2>
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Select Conversations to Export</h1>

        {/* Search and Select All */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search conversations..."
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
            {selectedIds.size} of {filteredConversations.length} conversations selected
          </p>

          <button
            onClick={handleExport}
            disabled={selectedIds.size === 0 || isExporting}
            className="bg-primary text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting...' : `Export ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500">No conversations found</p>
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
                      <p className="text-sm text-gray-500">
                        {conversation.messageCount || 0} messages · {formatDate(conversation.lastMessageDate)}
                      </p>
                    </div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
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
    </div>
  );
}

export default ConversationList;
