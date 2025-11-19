/**
 * ConversationList Component (Refactored)
 * Main component for displaying and exporting conversations
 *
 * This component has been refactored to improve readability and maintainability by:
 * - Extracting custom hooks (useConversations, useSelection, useTour)
 * - Breaking down into smaller subcomponents
 * - Moving tour configuration to separate file
 * - Extracting utility functions
 */
import React, { useState } from 'react';
import Joyride, { CallBackProps } from 'react-joyride';

// Custom hooks
import { useConversations } from '../../hooks/useConversations';
import { useSelection } from '../../hooks/useSelection';
import { useTour } from '../../hooks/useTour';

// Subcomponents
import { SearchBar } from './SearchBar';
import { SelectionControls } from './SelectionControls';
import { ExportButtons } from './ExportButtons';
import { ConversationCard } from './ConversationCard';
import { ContactInfoModal } from './ContactInfoModal';

// Configuration and utilities
import { getExportTourSteps, JOYRIDE_STYLES, JOYRIDE_LOCALE } from '../../config/tourSteps';
import { formatMessageDate } from '../../utils/dateFormatters';

interface Conversation {
  id: string;
  name: string;
  contactId?: string;
  phones?: string[];
  emails?: string[];
  directChatCount: number;
  groupChatCount: number;
  directMessageCount: number;
  groupMessageCount: number;
  messageCount?: number;
  lastMessageDate: Date | string | number;
}

interface ContactInfo {
  name: string;
  phones?: string[];
  emails?: string[];
}

interface ExportResult {
  success: boolean;
  error?: string;
  canceled?: boolean;
}

interface ConversationListProps {
  onExportComplete: (result: ExportResult) => void;
  onOutlookExport: (selectedIds: Set<string>) => void;
  onConnectOutlook: () => void;
  outlookConnected: boolean;
}

function ConversationList({
  onExportComplete,
  onOutlookExport,
  onConnectOutlook,
  outlookConnected
}: ConversationListProps) {
  // State management using custom hooks
  const { conversations, isLoading, error, reload } = useConversations();
  const selection = useSelection();
  const tour = useTour(conversations.length > 0 && !isLoading, 'hasSeenExportTour');

  // Local state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [contactInfoModal, setContactInfoModal] = useState<ContactInfo | null>(null);
  const [showOnlySelected, setShowOnlySelected] = useState<boolean>(false);

  // Filter conversations based on search and selection
  const filteredConversations = conversations.filter((conv: Conversation) => {
    const matchesSearch =
      conv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.contactId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSelection = !showOnlySelected || selection.isSelected(conv.id);

    return matchesSearch && matchesSelection;
  });

  // Export handlers
  const handleExport = async (): Promise<void> => {
    if (selection.count === 0) {
      alert('Please select at least one contact to export');
      return;
    }

    setIsExporting(true);

    try {
      const result = await window.electron.exportConversations(Array.from(selection.selectedIds));

      if (result.success) {
        onExportComplete(result);
      } else if (!result.canceled) {
        alert(result.error || 'Export failed');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOutlookExport = (): void => {
    if (selection.count === 0) {
      alert('Please select at least one contact to export');
      return;
    }

    if (onOutlookExport) {
      onOutlookExport(selection.selectedIds);
    }
  };

  // Loading state
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

  // Error state
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
            onClick={reload}
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
        steps={getExportTourSteps(outlookConnected) as any}
        run={tour.runTour}
        continuous
        showProgress
        showSkipButton
        hideCloseButton
        disableScrolling={true}
        callback={tour.handleJoyrideCallback}
        locale={JOYRIDE_LOCALE}
        styles={JOYRIDE_STYLES}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Select Contacts for Export</h1>

        {/* Search and Selection Controls */}
        <div className="flex gap-4 mb-4">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
          <SelectionControls
            onSelectAll={() => selection.selectAll(filteredConversations)}
            onDeselectAll={selection.deselectAll}
            onToggleShowSelected={() => setShowOnlySelected(!showOnlySelected)}
            showOnlySelected={showOnlySelected}
            selectedCount={selection.count}
          />
        </div>

        {/* Export Section */}
        <ExportButtons
          outlookConnected={outlookConnected}
          selectedCount={selection.count}
          isExporting={isExporting}
          onExportAll={handleOutlookExport}
          onExportEmailsOnly={handleOutlookExport}
          onExportTextsOnly={handleExport}
          onConnectOutlook={onConnectOutlook}
        />
      </div>

      {/* Selection Count Bar */}
      <div className="bg-gray-100 border-b border-gray-200 py-3">
        <p className="text-sm text-gray-600 text-center font-medium">
          {selection.count} of {filteredConversations.length} contacts selected
        </p>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredConversations.length === 0 ? (
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-gray-500">No contacts found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredConversations.map((conversation: Conversation, index: number) => (
              <ConversationCard
                key={conversation.id || `contact-${conversation.name}-${conversation.contactId}`}
                conversation={conversation}
                isSelected={selection.isSelected(conversation.id)}
                onToggle={selection.toggleSelection}
                onViewInfo={setContactInfoModal}
                formatDate={formatMessageDate as (date: Date | string | number) => string}
                isFirstCard={index === 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contact Info Modal */}
      <ContactInfoModal contact={contactInfoModal} onClose={() => setContactInfoModal(null)} />
    </div>
  );
}

export default ConversationList;
