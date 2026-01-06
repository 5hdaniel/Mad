import { useState, useMemo } from "react";
import { ExtendedContact } from "../types";

interface UseContactSearchResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredContacts: ExtendedContact[];
}

/**
 * Hook for contact search and filtering
 * Filters contacts by name, email, or company
 */
export function useContactSearch(
  contacts: ExtendedContact[],
): UseContactSearchResult {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) {
      return contacts;
    }

    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query),
    );
  }, [contacts, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    filteredContacts,
  };
}

export default useContactSearch;
