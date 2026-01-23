import React, { useState, useRef, useEffect, useCallback } from "react";
import type { ExtendedContact } from "../types/components";
import { ImportContactsModal, ContactFormModal } from "./contact";

// Debounce delay for search (ms)
const SEARCH_DEBOUNCE_MS = 300;

interface ContactSelectModalProps {
  contacts: ExtendedContact[];
  excludeIds?: string[];
  multiple?: boolean;
  onSelect: (contacts: ExtendedContact[]) => void;
  onClose: () => void;
  propertyAddress?: string;
  /** Initial contact IDs to pre-select when modal opens */
  initialSelectedIds?: string[];
  /** User ID for importing contacts (optional - enables import button) */
  userId?: string;
  /** Callback to refresh contacts after import */
  onRefreshContacts?: () => void;
}

/**
 * Contact Select Modal
 * Reusable multi-select popup for choosing contacts
 *
 * Features:
 * - Single or multi-select mode
 * - Search by name, email, or company
 * - Shows property address relevance badges
 * - Displays last communication date
 * - Checkbox-based selection with visual feedback
 */
// LocalStorage key for toggle persistence
const SHOW_MESSAGE_CONTACTS_KEY = "contactModal.showMessageContacts";

function ContactSelectModal({
  contacts,
  excludeIds = [],
  multiple = false,
  onSelect,
  onClose,
  propertyAddress,
  initialSelectedIds = [],
  userId,
  onRefreshContacts,
}: ContactSelectModalProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  // Track IDs to auto-select after import (cleared once contacts refresh)
  const [pendingAutoSelectIds, setPendingAutoSelectIds] = useState<string[]>([]);

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

  // Database search state
  const [searchResults, setSearchResults] = useState<ExtendedContact[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced database search
  const performDatabaseSearch = useCallback(async (query: string) => {
    if (!userId) {
      setSearchResults(null);
      return;
    }

    // For short queries, clear search results and use client-side filter
    if (query.length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      // Use the contacts:search IPC handler via the bridge
      // Type assertion needed because window.d.ts types may be out of sync with contactBridge
      const contactsApi = window.api.contacts as unknown as {
        searchContacts: (userId: string, query: string) => Promise<{
          success: boolean;
          contacts?: ExtendedContact[];
          error?: string;
        }>;
      };
      const result = await contactsApi.searchContacts(userId, query);
      if (result.success && result.contacts) {
        setSearchResults(result.contacts);
      } else {
        // On error, fall back to client-side filtering
        setSearchResults(null);
      }
    } catch (error) {
      console.error("Database search failed:", error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [userId]);

  // Handle search input change with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performDatabaseSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  }, [performDatabaseSearch]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Create a set of valid contact IDs for O(1) lookup
  const validContactIds = React.useMemo(
    () => new Set(contacts.map((c) => c.id)),
    [contacts]
  );

  // Filter initialSelectedIds to only include valid contact IDs
  const validInitialIds = React.useMemo(
    () => initialSelectedIds.filter((id) => validContactIds.has(id)),
    [initialSelectedIds, validContactIds]
  );

  const [selectedIds, setSelectedIds] = React.useState<string[]>(validInitialIds);

  // Sync selectedIds when initialSelectedIds prop changes (e.g., modal reopened with different selections)
  // Use join() to create a stable string key - avoids infinite loop from default [] creating new reference each render
  // NOTE: We intentionally use initialIdsKey (stable string) instead of initialSelectedIds (unstable array reference)
  const initialIdsKey = validInitialIds.join(',');
  React.useEffect(() => {
    setSelectedIds(validInitialIds);
  }, [initialIdsKey]);

  // Auto-select imported contacts once they appear in the contacts list
  // This runs after import completes and contacts are refreshed
  React.useEffect(() => {
    if (pendingAutoSelectIds.length > 0) {
      // Check which pending IDs are now available in the contacts list
      const idsToSelect = pendingAutoSelectIds.filter((id) =>
        validContactIds.has(id)
      );

      if (idsToSelect.length > 0) {
        // Add the imported contacts to selected (using Set to avoid duplicates)
        setSelectedIds((prev) => [...new Set([...prev, ...idsToSelect])]);
        // Clear pending IDs that were successfully selected
        setPendingAutoSelectIds((prev) =>
          prev.filter((id) => !validContactIds.has(id))
        );
      }
    }
  }, [pendingAutoSelectIds, validContactIds]);

  const availableContacts = contacts.filter((c) => !excludeIds.includes(c.id));

  // Helper to check if a contact is message-derived
  const isMessageDerived = (contact: ExtendedContact): boolean => {
    // is_message_derived can be number (1) or boolean (true)
    return contact.is_message_derived === 1 || contact.is_message_derived === true;
  };

  // Use database search results if available, otherwise filter client-side
  const filteredContacts = React.useMemo(() => {
    let result: ExtendedContact[];

    if (searchResults !== null) {
      // Database search results - filter out excluded IDs
      result = searchResults.filter((c) => !excludeIds.includes(c.id));
    } else if (!searchQuery) {
      // No search query - use all available contacts
      result = availableContacts;
    } else {
      // Client-side filtering for short queries
      result = availableContacts.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.company?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Apply message-derived filter if toggle is off
    if (!showMessageContacts) {
      result = result.filter((c) => !isMessageDerived(c));
    }

    return result;
  }, [searchResults, searchQuery, availableContacts, excludeIds, showMessageContacts]);

  const handleToggleContact = (contactId: string) => {
    if (multiple) {
      setSelectedIds((prev) =>
        prev.includes(contactId)
          ? prev.filter((id) => id !== contactId)
          : [...prev, contactId],
      );
    } else {
      setSelectedIds([contactId]);
    }
  };

  const handleConfirm = () => {
    const selectedContacts = contacts.filter((c) => selectedIds.includes(c.id));
    onSelect(selectedContacts);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[70vh] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-lg font-bold text-white">
              {multiple ? "Select Contacts" : "Select Contact"}
            </h3>
            <p className="text-purple-100 text-sm">
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : "Choose from your contacts"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-all"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search contacts by name, email, or company..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                autoFocus
              />
              {/* Search icon - shows spinner when searching */}
              {isSearching ? (
                <svg
                  className="w-5 h-5 text-purple-500 absolute left-3 top-2.5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
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
              )}
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
            {/* Import Contacts Button */}
            {userId && (
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 flex-shrink-0"
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
                Import
              </button>
            )}
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredContacts.length === 0 ? (
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
              <p className="text-gray-600">
                {searchQuery
                  ? "No matching contacts found"
                  : "No contacts available"}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredContacts.map((contact) => {
                const isSelected = selectedIds.includes(contact.id);
                return (
                  <button
                    key={contact.id}
                    onClick={() => handleToggleContact(contact.id)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "bg-purple-500 border-purple-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {contact.name?.charAt(0).toUpperCase() || "?"}
                      </div>

                      {/* Contact Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {contact.name}
                          </h4>
                          {propertyAddress &&
                            (contact.address_mention_count ?? 0) > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                                  />
                                </svg>
                                {contact.address_mention_count} related email
                                {(contact.address_mention_count ?? 0) > 1 ? "s" : ""}
                              </span>
                            )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-0.5">
                          {contact.company && (
                            <p className="truncate">{contact.company}</p>
                          )}
                          {contact.last_communication_at && (
                            <p className="text-xs text-gray-500">
                              Last contact:{" "}
                              {new Date(
                                contact.last_communication_at,
                              ).toLocaleDateString()}
                            </p>
                          )}
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
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              selectedIds.length === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700 shadow-md hover:shadow-lg"
            }`}
          >
            Add {selectedIds.length > 0 && `(${selectedIds.length})`}
          </button>
        </div>
      </div>

      {/* Import Contacts Modal */}
      {showImportModal && userId && (
        <ImportContactsModal
          userId={userId}
          onClose={() => setShowImportModal(false)}
          onSuccess={(importedContactIds) => {
            setShowImportModal(false);
            // Store imported IDs for auto-selection after refresh
            setPendingAutoSelectIds(importedContactIds);
            // Refresh contacts list to include newly imported contacts
            onRefreshContacts?.();
          }}
          onAddManually={() => {
            // Close import modal and open contact form modal
            setShowImportModal(false);
            setShowAddContactModal(true);
          }}
        />
      )}

      {/* Add Contact Form Modal */}
      {showAddContactModal && userId && (
        <ContactFormModal
          userId={userId}
          contact={undefined}
          onClose={() => setShowAddContactModal(false)}
          onSuccess={() => {
            setShowAddContactModal(false);
            // Refresh contacts list to include newly created contact
            onRefreshContacts?.();
          }}
        />
      )}
    </div>
  );
}

export default ContactSelectModal;
