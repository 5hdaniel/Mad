/**
 * useTransactionCommunications Hook
 * Manages communication operations for transaction details
 */
import { useState, useCallback } from "react";
import type { Communication } from "../types";

interface UseTransactionCommunicationsResult {
  unlinkingCommId: string | null;
  showUnlinkConfirm: Communication | null;
  viewingEmail: Communication | null;
  setShowUnlinkConfirm: (comm: Communication | null) => void;
  setViewingEmail: (comm: Communication | null) => void;
  handleUnlinkCommunication: (
    comm: Communication,
    onSuccess: () => void,
    onError: (message: string) => void
  ) => Promise<void>;
}

/**
 * Hook for managing transaction communication operations
 */
export function useTransactionCommunications(): UseTransactionCommunicationsResult {
  const [unlinkingCommId, setUnlinkingCommId] = useState<string | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState<Communication | null>(null);
  const [viewingEmail, setViewingEmail] = useState<Communication | null>(null);

  /**
   * Handle unlinking a communication from transaction
   */
  const handleUnlinkCommunication = useCallback(
    async (
      comm: Communication,
      onSuccess: () => void,
      onError: (message: string) => void
    ): Promise<void> => {
      try {
        setUnlinkingCommId(comm.id);
        const result = await window.api.transactions.unlinkCommunication(comm.id);

        if (result.success) {
          setShowUnlinkConfirm(null);
          onSuccess();
        } else {
          console.error("Failed to unlink communication:", result.error);
          onError("Failed to unlink email. Please try again.");
        }
      } catch (err) {
        console.error("Failed to unlink communication:", err);
        onError("Failed to unlink email. Please try again.");
      } finally {
        setUnlinkingCommId(null);
      }
    },
    []
  );

  return {
    unlinkingCommId,
    showUnlinkConfirm,
    viewingEmail,
    setShowUnlinkConfirm,
    setViewingEmail,
    handleUnlinkCommunication,
  };
}
