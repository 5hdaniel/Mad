'use client';

/**
 * Contacts List Client Component
 *
 * Main client component for the contacts dashboard page. Provides:
 * - Server-action-driven search (debounced, not client-side filtering)
 * - Source filter dropdown (All / Outlook / Gmail / Manual)
 * - "Import from Outlook" button with progress and error feedback
 * - Contacts table with responsive columns
 * - Empty state and error state handling
 *
 * TASK-1913: Contacts dashboard page + import UI
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ContactRow from './ContactRow';
import { EmptyState, SearchIcon } from '@/components/ui/EmptyState';
import { getExternalContacts } from '@/lib/actions/contacts';
import { syncOutlookContacts } from '@/lib/actions/syncOutlookContacts';
import type { ExternalContact } from '@/lib/actions/contacts';
import type { SyncResult } from '@/lib/microsoft/types';

// ============================================================================
// Types
// ============================================================================

interface ContactsListClientProps {
  initialContacts: ExternalContact[];
  initialTotal: number;
}

type SourceFilter = 'all' | 'outlook' | 'gmail' | 'manual';

// ============================================================================
// Icons
// ============================================================================

function ContactsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || 'w-12 h-12'}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className || 'w-5 h-5 animate-spin'}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
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
  );
}

// ============================================================================
// Source filter options
// ============================================================================

const SOURCE_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'All Sources' },
  { value: 'outlook', label: 'Outlook' },
  { value: 'gmail', label: 'Gmail' },
  { value: 'manual', label: 'Manual' },
];

// ============================================================================
// Notification Component
// ============================================================================

function Notification({
  result,
  onDismiss,
}: {
  result: SyncResult;
  onDismiss: () => void;
}) {
  const isError = !result.success;

  // Map error codes to user-friendly messages
  const getMessage = (): string => {
    if (result.success) {
      return result.count > 0
        ? `Imported ${result.count} contacts from Outlook`
        : 'No contacts found in Outlook';
    }
    switch (result.error) {
      case 'not_connected':
        return 'Sign in with Microsoft to import Outlook contacts';
      case 'permission_denied':
        return 'Microsoft Contacts permission not granted. Please re-sign in.';
      case 'token_expired':
        return 'Your Microsoft session has expired. Please sign in again.';
      default:
        return result.message || 'An error occurred while importing contacts';
    }
  };

  return (
    <div
      className={`rounded-md p-4 ${isError ? 'bg-red-50' : 'bg-green-50'}`}
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {isError ? (
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <p
            className={`text-sm font-medium ${isError ? 'text-red-800' : 'text-green-800'}`}
          >
            {getMessage()}
          </p>
        </div>
        <div className="ml-auto pl-3">
          <button
            type="button"
            onClick={onDismiss}
            className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isError
                ? 'text-red-500 hover:bg-red-100 focus:ring-red-600 focus:ring-offset-red-50'
                : 'text-green-500 hover:bg-green-100 focus:ring-green-600 focus:ring-offset-green-50'
            }`}
            aria-label="Dismiss"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ContactsListClient({
  initialContacts,
  initialTotal,
}: ContactsListClientProps) {
  const router = useRouter();

  // State
  const [contacts, setContacts] = useState<ExternalContact[]>(initialContacts);
  const [total, setTotal] = useState(initialTotal);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [importing, setImporting] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce ref
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch contacts from server action with current filters
  const fetchContacts = useCallback(
    async (search: string, source: SourceFilter) => {
      setLoading(true);
      try {
        const result = await getExternalContacts({
          search: search || undefined,
          source: source === 'all' ? undefined : source,
          limit: 50,
          offset: 0,
        });
        setContacts(result.contacts);
        setTotal(result.total);
      } catch (err) {
        console.error('Error fetching contacts:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        fetchContacts(value, sourceFilter);
      }, 300);
    },
    [sourceFilter, fetchContacts]
  );

  // Source filter handler (immediate, no debounce)
  const handleSourceChange = useCallback(
    (value: SourceFilter) => {
      setSourceFilter(value);
      fetchContacts(searchQuery, value);
    },
    [searchQuery, fetchContacts]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Import handler
  async function handleImport() {
    setImporting(true);
    setSyncResult(null);

    try {
      const result = await syncOutlookContacts();
      setSyncResult(result);

      if (result.success && result.count > 0) {
        // Refresh contacts list with current filters
        await fetchContacts(searchQuery, sourceFilter);
        router.refresh();
      }
    } catch (err) {
      console.error('Error syncing contacts:', err);
      setSyncResult({
        success: false,
        count: 0,
        error: 'unknown',
        message: 'An unexpected error occurred while importing contacts',
      });
    } finally {
      setImporting(false);
    }
  }

  const hasFilters = searchQuery !== '' || sourceFilter !== 'all';
  const isEmpty = contacts.length === 0 && !loading;

  return (
    <div className="space-y-4">
      {/* Sync Result Notification */}
      {syncResult && (
        <Notification
          result={syncResult}
          onDismiss={() => setSyncResult(null)}
        />
      )}

      {/* Search/Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="flex-1">
            <label htmlFor="contact-search" className="sr-only">
              Search contacts
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
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
              <input
                id="contact-search"
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Source Filter */}
          <div className="sm:w-36">
            <label htmlFor="source-filter" className="sr-only">
              Filter by source
            </label>
            <select
              id="source-filter"
              value={sourceFilter}
              onChange={(e) =>
                handleSourceChange(e.target.value as SourceFilter)
              }
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={importing}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {importing ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Import from Outlook
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isEmpty ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <EmptyState
            icon={hasFilters ? <SearchIcon /> : <ContactsIcon />}
            title={hasFilters ? 'No contacts found' : 'No contacts yet'}
            description={
              hasFilters
                ? 'Try adjusting your search or filters'
                : 'Import contacts from Outlook to get started.'
            }
            action={
              !hasFilters ? (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <SpinnerIcon className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Import from Outlook'
                  )}
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Results Count */}
          <div className="text-sm text-gray-500">
            {loading ? (
              'Loading...'
            ) : (
              <>
                {total} contact{total !== 1 ? 's' : ''}
                {hasFilters && contacts.length < total
                  ? ` (showing ${contacts.length})`
                  : ''}
              </>
            )}
          </div>

          {/* Contacts Table */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell"
                    >
                      Phone
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell"
                    >
                      Company
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Source
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell"
                    >
                      Synced
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contacts.map((contact) => (
                    <ContactRow key={contact.id} contact={contact} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
