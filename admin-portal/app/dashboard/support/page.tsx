'use client';

/**
 * Support Dashboard - Ticket Queue Page
 *
 * Main support page at /dashboard/support showing:
 * - Search bar (full-text search via tsvector)
 * - Stats cards (open, unassigned, urgent)
 * - Filter bar (status, priority, category)
 * - Ticket table with pagination
 * - Create ticket button
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';
import { listTickets } from '@/lib/support-queries';
import type {
  SupportTicket,
  TicketStatus,
  TicketPriority,
} from '@/lib/support-types';
import { StatsCards } from './components/StatsCards';
import { TicketFilters } from './components/TicketFilters';
import { CreateTicketDialog } from './components/CreateTicketDialog';

const TicketTable = dynamic(() => import('./components/TicketTable').then(m => m.TicketTable), { ssr: false });
import { SearchBar } from './components/SearchBar';

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const pageSize = 20;

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTickets({
        status: statusFilter,
        priority: priorityFilter,
        category_id: categoryFilter,
        search: searchQuery || undefined,
        page,
        page_size: pageSize,
      });
      setTickets(data.tickets);
      setTotalCount(data.total_count);
      setTotalPages(data.total_pages);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, searchQuery, page]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Reset to page 1 when filters change
  function handleStatusChange(status: TicketStatus | null) {
    setStatusFilter(status);
    setPage(1);
  }

  function handlePriorityChange(priority: TicketPriority | null) {
    setPriorityFilter(priority);
    setPage(1);
  }

  function handleCategoryChange(categoryId: string | null) {
    setCategoryFilter(categoryId);
    setPage(1);
  }

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="text-sm text-gray-500 mt-1">Manage support tickets</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Ticket
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards />

      {/* Search Bar */}
      <div className="mb-4">
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Filters */}
      <div className="mb-4">
        <TicketFilters
          status={statusFilter}
          priority={priorityFilter}
          categoryId={categoryFilter}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onCategoryChange={handleCategoryChange}
        />
      </div>

      {/* Ticket Table */}
      <TicketTable
        tickets={tickets}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        searchActive={!!searchQuery}
      />

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={loadTickets}
      />
    </div>
  );
}
