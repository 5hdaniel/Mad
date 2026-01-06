/**
 * useTransactionStatusUpdate Hook
 *
 * Encapsulates transaction status update logic (approve, reject, restore)
 * with proper validation, error handling, and feedback recording.
 */
import { useState, useCallback } from "react";
import { transactionService } from "../services/transactionService";

/**
 * Operation state for tracking async operations
 */
export interface OperationState {
  isApproving: boolean;
  isRejecting: boolean;
  isRestoring: boolean;
  error: string | null;
}

/**
 * Operation callbacks
 */
export interface OperationCallbacks {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Return type for useTransactionStatusUpdate hook
 */
export interface UseTransactionStatusUpdateReturn {
  state: OperationState;
  approve: (transactionId: string, callbacks?: OperationCallbacks) => Promise<boolean>;
  reject: (
    transactionId: string,
    reason?: string,
    callbacks?: OperationCallbacks
  ) => Promise<boolean>;
  restore: (transactionId: string, callbacks?: OperationCallbacks) => Promise<boolean>;
  clearError: () => void;
}

/**
 * Custom hook for managing transaction status updates
 *
 * @param userId - User ID for feedback recording (required for approve, optional for reject/restore)
 * @returns State and handler functions for status updates
 *
 * @example
 * ```tsx
 * const { state, approve, reject, restore } = useTransactionStatusUpdate(userId);
 *
 * // Approve a transaction
 * await approve(transaction.id, {
 *   onSuccess: () => console.log('Approved!'),
 *   onError: (error) => console.error(error),
 * });
 * ```
 */
export function useTransactionStatusUpdate(
  userId: string | undefined
): UseTransactionStatusUpdateReturn {
  const [state, setState] = useState<OperationState>({
    isApproving: false,
    isRejecting: false,
    isRestoring: false,
    error: null,
  });

  /**
   * Clear any error state
   */
  const clearError = useCallback((): void => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Approve a pending transaction
   * Requires userId to be defined
   */
  const approve = useCallback(
    async (
      transactionId: string,
      callbacks?: OperationCallbacks
    ): Promise<boolean> => {
      // Validate userId requirement for approve
      if (!userId) {
        const error = "Cannot approve: User ID is required";
        setState((prev) => ({ ...prev, error }));
        callbacks?.onError?.(error);
        return false;
      }

      setState((prev) => ({ ...prev, isApproving: true, error: null }));

      try {
        const result = await transactionService.approve(transactionId, userId);

        if (result.success) {
          setState((prev) => ({ ...prev, isApproving: false }));
          callbacks?.onSuccess?.();
          return true;
        } else {
          const error = result.error || "Failed to approve transaction";
          setState((prev) => ({ ...prev, isApproving: false, error }));
          callbacks?.onError?.(error);
          return false;
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : "Failed to approve transaction";
        setState((prev) => ({ ...prev, isApproving: false, error }));
        callbacks?.onError?.(error);
        return false;
      }
    },
    [userId]
  );

  /**
   * Reject a transaction
   * userId is optional but recommended for feedback recording
   */
  const reject = useCallback(
    async (
      transactionId: string,
      reason?: string,
      callbacks?: OperationCallbacks
    ): Promise<boolean> => {
      setState((prev) => ({ ...prev, isRejecting: true, error: null }));

      try {
        const result = await transactionService.reject(transactionId, userId, reason);

        if (result.success) {
          setState((prev) => ({ ...prev, isRejecting: false }));
          callbacks?.onSuccess?.();
          return true;
        } else {
          const error = result.error || "Failed to reject transaction";
          setState((prev) => ({ ...prev, isRejecting: false, error }));
          callbacks?.onError?.(error);
          return false;
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : "Failed to reject transaction";
        setState((prev) => ({ ...prev, isRejecting: false, error }));
        callbacks?.onError?.(error);
        return false;
      }
    },
    [userId]
  );

  /**
   * Restore a rejected transaction to active
   * userId is optional but recommended for feedback recording
   */
  const restore = useCallback(
    async (
      transactionId: string,
      callbacks?: OperationCallbacks
    ): Promise<boolean> => {
      setState((prev) => ({ ...prev, isRestoring: true, error: null }));

      try {
        const result = await transactionService.restore(transactionId, userId);

        if (result.success) {
          setState((prev) => ({ ...prev, isRestoring: false }));
          callbacks?.onSuccess?.();
          return true;
        } else {
          const error = result.error || "Failed to restore transaction";
          setState((prev) => ({ ...prev, isRestoring: false, error }));
          callbacks?.onError?.(error);
          return false;
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : "Failed to restore transaction";
        setState((prev) => ({ ...prev, isRestoring: false, error }));
        callbacks?.onError?.(error);
        return false;
      }
    },
    [userId]
  );

  return {
    state,
    approve,
    reject,
    restore,
    clearError,
  };
}
