/**
 * useItemSearch -- Shared debounced search hook for PM item linking.
 *
 * Encapsulates the debounced search pattern used by DependencyPanel and
 * LinkedItemsPanel. Handles timer cleanup and loading state.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchItemsForLink } from '@/lib/pm-queries';
import type { PmItemSearchResult } from '@/lib/pm-types';

interface UseItemSearchOptions {
  /** The ID of the item to exclude from results (current item). */
  excludeId: string;
  /** Debounce delay in ms (default: 300). */
  debounceMs?: number;
}

interface UseItemSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: PmItemSearchResult[];
  searching: boolean;
  /** Reset query and results */
  reset: () => void;
}

export function useItemSearch({
  excludeId,
  debounceMs = 300,
}: UseItemSearchOptions): UseItemSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PmItemSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchItemsForLink(query, excludeId);
        setResults(data);
      } catch (err) {
        console.error('Item search failed:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, excludeId, debounceMs]);

  const reset = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return { query, setQuery, results, searching, reset };
}
