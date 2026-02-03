'use client';

/**
 * User Search and Filter Component
 *
 * Provides search and filter controls for the user list.
 * Filters by name/email search, role, and license status.
 *
 * TASK-1809: User list component implementation
 */

import { ROLE_LABELS, LICENSE_STATUS_LABELS } from '@/lib/types/users';

interface UserSearchFilterProps {
  searchQuery: string;
  onSearchChange: (_value: string) => void;
  roleFilter: string;
  onRoleChange: (_value: string) => void;
  statusFilter: string;
  onStatusChange: (_value: string) => void;
}

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Roles' },
  ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  ...Object.entries(LICENSE_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

export default function UserSearchFilter({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleChange,
  statusFilter,
  onStatusChange,
}: UserSearchFilterProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search Input */}
        <div className="flex-1">
          <label htmlFor="user-search" className="sr-only">
            Search users
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
              id="user-search"
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Role Filter */}
        <div className="sm:w-40">
          <label htmlFor="role-filter" className="sr-only">
            Filter by role
          </label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => onRoleChange(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="sm:w-40">
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
