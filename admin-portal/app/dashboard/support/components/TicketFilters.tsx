'use client';

/**
 * TicketFilters - Support Dashboard
 *
 * Filter controls for the ticket queue: Status, Priority, Category, Assignee.
 */

import { useEffect, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { getCategories, buildCategoryTree } from '@/lib/support-queries';
import type { TicketStatus, TicketPriority, SupportCategory } from '@/lib/support-types';
import { STATUS_LABELS, PRIORITY_LABELS } from '@/lib/support-types';

interface TicketFiltersProps {
  status: TicketStatus | null;
  priority: TicketPriority | null;
  categoryId: string | null;
  onStatusChange: (status: TicketStatus | null) => void;
  onPriorityChange: (priority: TicketPriority | null) => void;
  onCategoryChange: (categoryId: string | null) => void;
}

export function TicketFilters({
  status,
  priority,
  categoryId,
  onStatusChange,
  onPriorityChange,
  onCategoryChange,
}: TicketFiltersProps) {
  const [categories, setCategories] = useState<SupportCategory[]>([]);

  useEffect(() => {
    getCategories().then((cats) => {
      setCategories(buildCategoryTree(cats));
    });
  }, []);

  const hasFilters = status || priority || categoryId;

  function clearAll() {
    onStatusChange(null);
    onPriorityChange(null);
    onCategoryChange(null);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-gray-500">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      {/* Status filter */}
      <select
        value={status || ''}
        onChange={(e) => onStatusChange((e.target.value as TicketStatus) || null)}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">All Statuses</option>
        {(Object.entries(STATUS_LABELS) as [TicketStatus, string][]).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Priority filter */}
      <select
        value={priority || ''}
        onChange={(e) => onPriorityChange((e.target.value as TicketPriority) || null)}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">All Priorities</option>
        {(Object.entries(PRIORITY_LABELS) as [TicketPriority, string][]).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Category filter */}
      <select
        value={categoryId || ''}
        onChange={(e) => onCategoryChange(e.target.value || null)}
        className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">All Categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      {/* Clear all button */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
