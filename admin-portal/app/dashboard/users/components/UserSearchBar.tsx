'use client';

/**
 * UserSearchBar - Debounced search input for user search
 *
 * Debounces input by 300ms before triggering the onSearch callback.
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface UserSearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function UserSearchBar({ onSearch, isLoading }: UserSearchBarProps) {
  const [inputValue, setInputValue] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearch(inputValue.trim());
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // onSearch is stable from parent via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  const handleClear = () => {
    setInputValue('');
    onSearch('');
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Search by name, email, organization, or user ID..."
        className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          aria-label="Clear search"
        >
          {isLoading ? (
            <div className="h-4 w-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
          ) : (
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
          )}
        </button>
      )}
    </div>
  );
}
