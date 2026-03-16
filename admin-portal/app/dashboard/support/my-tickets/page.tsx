'use client';

/**
 * My Tickets Page - Support Dashboard
 *
 * Shows tickets assigned to the currently logged-in agent.
 * Reuses the same TicketTable, TicketFilters, and SearchBar components as the Queue page,
 * but pre-filters all queries by the current user's assignee_id.
 */

import { useState, useEffect, useCallback } from 'react';
import { Inbox, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { listTickets, getTicketStats } from '@/lib/support-queries';
import type {
  SupportTicket,
  TicketStatus,
  TicketPriority,
} from '@/lib/support-types';
import { TicketFilters } from '../components/TicketFilters';
import { TicketTable } from '../components/TicketTable';
import { SearchBar } from '../components/SearchBar';

export default function MyTicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Agent-specific stats
  const [myOpen, setMyOpen] = useState(0);
  const [myPending, setMyPending] = useState(0);
  const [myResolved, setMyResolved] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TicketStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const pageSize = 20;

  const loadTickets = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await listTickets({
        assignee_id: user.id,
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
      console.error('Failed to load my tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, priorityFilter, categoryFilter, searchQuery, page]);

  // Load agent-specific stats by querying filtered counts
  const loadMyStats = useCallback(async () => {
    if (!user?.id) return;
    setStatsLoading(true);
    try {
      const [openData, pendingData, resolvedData] = await Promise.all([
        listTickets({ assignee_id: user.id, status: 'in_progress', page: 1, page_size: 1 }),
        listTickets({ assignee_id: user.id, status: 'pending', page: 1, page_size: 1 }),
        listTickets({ assignee_id: user.id, status: 'resolved', page: 1, page_size: 1 }),
      ]);
      setMyOpen(openData.total_count);
      setMyPending(pendingData.total_count);
      setMyResolved(resolvedData.total_count);
    } catch (err) {
      console.error('Failed to load my stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadMyStats();
  }, [loadMyStats]);

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

  const statCards = [
    { label: 'My In Progress', value: myOpen, icon: Inbox, color: 'text-blue-600 bg-blue-50' },
    { label: 'My Pending', value: myPending, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'My Resolved', value: myResolved, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">Tickets assigned to you</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4"
            >
              <div className={`rounded-lg p-3 ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {statsLoading ? '-' : card.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
