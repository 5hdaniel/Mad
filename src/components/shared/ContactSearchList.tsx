/**
 * ContactSearchList Component
 *
 * A search-enabled contact selection list that combines imported and external contacts.
 * Features:
 * - Search filtering by name, email, and phone (case-insensitive)
 * - Multi-select with checkboxes
 * - Imported contacts shown with [Imported] pill
 * - External contacts shown with [External] pill and optional [+] import button
 * - Auto-import: selecting an external contact triggers import callback
 * - Loading, error, and empty states
 * - Keyboard navigation (via ContactRow)
 *
 * @see BACKLOG-418: Redesign Contact Selection UX (Select First, Assign Roles Second)
 * @see TASK-1763: ContactSearchList Component
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ContactRow } from "./ContactRow";
import type { ExtendedContact } from "../../types/components";
import { sortByRecentCommunication } from "../../utils/contactSortUtils";

/**
 * Internal type for combined contact list
 * All contacts use ExtendedContact - isExternal flag distinguishes external ones.
 * External contacts have is_message_derived=true or source="external".
 */
interface CombinedContact {
  contact: ExtendedContact;
  isExternal: boolean;
}

export interface ContactSearchListProps {
  /** Imported/existing contacts */
  contacts: ExtendedContact[];
  /** External contacts (from address book, not yet imported) - now uses ExtendedContact with isExternal flag */
  externalContacts?: ExtendedContact[];
  /** Currently selected contact IDs */
  selectedIds: string[];
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: string[]) => void;
  /** Callback to import an external contact - returns the imported contact */
  onImportContact?: (contact: ExtendedContact) => Promise<ExtendedContact>;
  /** Show loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Checks if a contact is external (not yet imported to database).
 * External contacts have is_message_derived=true.
 */
function isExternalContact(contact: ExtendedContact): boolean {
  return contact.is_message_derived === true || contact.is_message_derived === 1;
}

/**
 * Checks if a contact matches the search query.
 * Searches by name, email, and phone (case-insensitive).
 */
function matchesSearch(
  contact: ExtendedContact,
  query: string
): boolean {
  const lowerQuery = query.toLowerCase();

  // Check name (handle both name and display_name)
  const nameValue =
    "display_name" in contact
      ? contact.display_name || contact.name || ""
      : contact.name || "";
  const name = nameValue.toLowerCase();
  if (name.includes(lowerQuery)) return true;

  // Check email
  const email = (contact.email || "").toLowerCase();
  if (email.includes(lowerQuery)) return true;

  // Check allEmails if available (ExtendedContact)
  if ("allEmails" in contact && contact.allEmails) {
    const allEmails = contact.allEmails.join(" ").toLowerCase();
    if (allEmails.includes(lowerQuery)) return true;
  }

  // Check phone
  const phone = (contact.phone || "").toLowerCase();
  if (phone.includes(lowerQuery)) return true;

  // Check allPhones if available (ExtendedContact)
  if ("allPhones" in contact && contact.allPhones) {
    const allPhones = contact.allPhones.join(" ").toLowerCase();
    if (allPhones.includes(lowerQuery)) return true;
  }

  return false;
}

/**
 * ContactSearchList Component
 *
 * Displays a searchable list of contacts with multi-select capability.
 * Combines imported contacts and external contacts into a unified list.
 *
 * @example
 * // Basic usage
 * <ContactSearchList
 *   contacts={importedContacts}
 *   selectedIds={selectedIds}
 *   onSelectionChange={setSelectedIds}
 * />
 *
 * @example
 * // With external contacts and auto-import
 * <ContactSearchList
 *   contacts={importedContacts}
 *   externalContacts={addressBookContacts}
 *   selectedIds={selectedIds}
 *   onSelectionChange={setSelectedIds}
 *   onImportContact={async (contact) => {
 *     const imported = await importContactFromAddressBook(contact);
 *     return imported;
 *   }}
 * />
 */
export function ContactSearchList({
  contacts,
  externalContacts = [],
  selectedIds,
  onSelectionChange,
  onImportContact,
  isLoading = false,
  error = null,
  searchPlaceholder = "Search contacts...",
  className = "",
}: ContactSearchListProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Combine, sort, and filter contacts
  const combinedContacts = useMemo((): CombinedContact[] => {
    // Convert imported contacts - detect external status from is_message_derived
    const imported: CombinedContact[] = contacts.map((c) => ({
      contact: c,
      isExternal: isExternalContact(c),
    }));

    // External contacts already in ExtendedContact format - mark as external
    const external: CombinedContact[] = externalContacts.map((c) => ({
      contact: c,
      isExternal: true,
    }));

    // Combine lists (imported first, then external)
    const combined = [...imported, ...external];

    // Sort by most recent communication first (BEFORE filtering)
    // Using sortByRecentCommunication on contacts, then mapping back
    const contactsWithIndex = combined.map((item, index) => ({
      index,
      last_communication_at: item.contact.last_communication_at,
    }));
    const sortedIndices = sortByRecentCommunication(contactsWithIndex);
    const sorted = sortedIndices.map((item) => combined[item.index]);

    // Apply search filter
    if (!searchQuery.trim()) {
      return sorted;
    }

    return sorted.filter(({ contact }) => matchesSearch(contact, searchQuery));
  }, [contacts, externalContacts, searchQuery]);

  // Reset focused index when list changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [combinedContacts.length]);

  // Handle regular contact selection (toggle)
  const handleSelect = useCallback(
    (contactId: string) => {
      if (selectedIds.includes(contactId)) {
        onSelectionChange(selectedIds.filter((id) => id !== contactId));
      } else {
        onSelectionChange([...selectedIds, contactId]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  // Handle external contact import
  const handleImport = useCallback(
    async (contact: ExtendedContact, autoSelect: boolean = false) => {
      if (!onImportContact || importingIds.has(contact.id)) {
        return;
      }

      setImportingIds((prev) => new Set(prev).add(contact.id));

      try {
        const imported = await onImportContact(contact);
        // Add the imported contact to selection if autoSelect is true
        if (autoSelect) {
          onSelectionChange([...selectedIds, imported.id]);
        }
      } catch (err) {
        // Error handling - parent should handle via try/catch in onImportContact
        console.error("Failed to import contact:", err);
      } finally {
        setImportingIds((prev) => {
          const next = new Set(prev);
          next.delete(contact.id);
          return next;
        });
      }
    },
    [onImportContact, importingIds, selectedIds, onSelectionChange]
  );

  // Handle selecting an external contact (auto-import and select)
  const handleExternalSelect = useCallback(
    async (contact: ExtendedContact) => {
      if (onImportContact) {
        // Auto-import when selecting external contact
        await handleImport(contact, true);
      }
    },
    [onImportContact, handleImport]
  );

  // Handle row click based on contact type
  const handleRowSelect = useCallback(
    (combined: CombinedContact) => {
      if (combined.isExternal) {
        handleExternalSelect(combined.contact);
      } else {
        handleSelect(combined.contact.id);
      }
    },
    [handleSelect, handleExternalSelect]
  );

  // Handle manual import button click (import without selecting)
  const handleImportButtonClick = useCallback(
    (combined: CombinedContact) => {
      if (combined.isExternal) {
        handleImport(combined.contact, false);
      }
    },
    [handleImport]
  );

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) =>
            i < combinedContacts.length - 1 ? i + 1 : i
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => (i > 0 ? i - 1 : 0));
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < combinedContacts.length) {
            handleRowSelect(combinedContacts[focusedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setSearchQuery("");
          setFocusedIndex(-1);
          searchInputRef.current?.focus();
          break;
      }
    },
    [combinedContacts, focusedIndex, handleRowSelect]
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setFocusedIndex(-1);
  };

  return (
    <div
      className={`flex flex-col ${className}`}
      data-testid="contact-search-list"
    >
      {/* Search Input */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
            aria-label="Search contacts"
            data-testid="contact-search-input"
          />
          <svg
            className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Contact List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        role="listbox"
        aria-multiselectable="true"
        aria-label="Contact list"
        onKeyDown={handleKeyDown}
        data-testid="contact-list"
      >
        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center" data-testid="loading-state">
            <div
              className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"
              role="status"
              aria-label="Loading"
            />
            <p className="text-gray-500">Loading contacts...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-8 text-center" data-testid="error-state">
            <svg
              className="w-12 h-12 text-red-400 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && combinedContacts.length === 0 && (
          <div
            className="p-8 text-center text-gray-500"
            data-testid="empty-state"
          >
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {searchQuery ? (
              <p>No contacts match &quot;{searchQuery}&quot;</p>
            ) : (
              <p>No contacts available</p>
            )}
          </div>
        )}

        {/* Contact List Items */}
        {!isLoading &&
          !error &&
          combinedContacts.map((combined, index) => {
            const isSelected = selectedIds.includes(combined.contact.id);
            const isImporting = importingIds.has(combined.contact.id);

            return (
              <ContactRow
                key={combined.contact.id}
                contact={combined.contact}
                isSelected={isSelected}
                showCheckbox={true}
                showImportButton={combined.isExternal && !!onImportContact}
                onSelect={() => handleRowSelect(combined)}
                onImport={() => handleImportButtonClick(combined)}
                className={`${
                  focusedIndex === index ? "ring-2 ring-inset ring-purple-500" : ""
                } ${isImporting ? "opacity-50 pointer-events-none" : ""}`}
              />
            );
          })}
      </div>

      {/* Selection Count Footer */}
      <div
        className="p-3 border-t border-gray-200 text-sm text-gray-600"
        data-testid="selection-count"
      >
        Selected: {selectedIds.length} contact
        {selectedIds.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

export default ContactSearchList;
