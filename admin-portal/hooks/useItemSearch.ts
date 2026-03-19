/**
 * useItemSearch -- Shared debounced search hook for PM item linking.
 *
 * Encapsulates the debounced search pattern used by DependencyPanel and
 * LinkedItemsPanel. Handles timer cleanup, loading state, and error surfacing.
 *
 * BACKLOG-1277: Added cancelled-flag pattern to prevent stale async results
 * from overwriting fresh ones (matches CreateTaskDialog's parent search).
 * Also exposes `error` state so callers can display search failures.
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
  /** Error message from the last failed search, or null. */
  error: string | null;
  /** Reset query, results, and error. */
  reset: () => void;
}

export function useItemSearch({
  excludeId,
  debounceMs = 300,
}: UseItemSearchOptions): UseItemSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PmItemSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      setSearching(false);
      setError(null);
      return;
    }

    // BACKLOG-1277: Cancelled flag prevents stale async responses from
    // overwriting results when the user types faster than the RPC responds.
    let cancelled = false;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const data = await searchItemsForLink(query, excludeId);
        if (!cancelled) {
          setResults(data);
        }
      } catch (err) {
        console.error('Item search failed:', err);
        if (!cancelled) {
          setResults([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, excludeId, debounceMs]);

  const reset = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return { query, setQuery, results, searching, error, reset };
}
