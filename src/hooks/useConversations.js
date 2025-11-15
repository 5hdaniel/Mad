/**
 * Custom hook for managing conversations data
 * Handles loading conversations from the electron backend
 */
import { useState, useEffect } from 'react';

export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConversations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.getConversations();

      if (result.success) {
        setConversations(result.conversations);
      } else {
        setError(result.error || 'Failed to load contacts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  return {
    conversations,
    isLoading,
    error,
    reload: loadConversations
  };
}
