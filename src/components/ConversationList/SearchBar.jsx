/**
 * SearchBar Component
 * Provides search input for filtering contacts
 */
import React from 'react';

export function SearchBar({ value, onChange }) {
  return (
    <div className="flex-1 relative" data-tour="search">
      <input
        type="text"
        placeholder="Search contacts..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
      />
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
    </div>
  );
}
