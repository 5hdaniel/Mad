/**
 * Custom hook for managing bulk transaction actions
 * Handles bulk delete, export, and status change operations
 */
import { useState, useCallback } from "react";

/**
 * Return type for useBulkActions hook
 */
export interface UseBulkActionsResult {
  /** Whether bulk delete is in progress */
  isBulkDeleting: boolean;
  /** Whether bulk export is in progress */
  isBulkExporting: boolean;
  /** Whether bulk status update is in progress */
  isBulkUpdating: boolean;
  /** Handle bulk delete of selected transactions */
  handleBulkDelete: () => Promise<void>;
  /** Handle bulk export of selected transactions */
  handleBulkExport: (format: string) => Promise<void>;
  /** Handle bulk status change of selected transactions */
  handleBulkStatusChange: (status: "pending" | "active" | "closed" | "rejected") => Promise<void>;
}

/**
 * Callbacks for bulk action completion and messaging
 */
export interface UseBulkActionsCallbacks {
  /** Callback after successful bulk action (to refresh transactions) */
  onComplete: () => Promise<void>;
  /** Callback to show success message */
  showSuccess: (message: string) => void;
  /** Callback to show error message */
  showError: (message: string | null) => void;
  /** Callback to exit selection mode */
  exitSelectionMode: () => void;
  /** Callback to close bulk delete confirmation modal */
  closeBulkDeleteModal: () => void;
  /** Callback to close bulk export modal */
  closeBulkExportModal: () => void;
}

/**
 * Custom hook for managing bulk transaction actions
 * @param selectedIds - Set of selected transaction IDs
 * @param selectedCount - Number of selected transactions
 * @param callbacks - Callbacks for completion and messaging
 * @returns Bulk action loading states and handlers
 */
export function useBulkActions(
  selectedIds: Set<string>,
  selectedCount: number,
  callbacks: UseBulkActionsCallbacks
): UseBulkActionsResult {
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const {
    onComplete,
    showSuccess,
    showError,
    exitSelectionMode,
    closeBulkDeleteModal,
    closeBulkExportModal,
  } = callbacks;

  /**
   * Handle bulk delete of selected transactions
   */
  const handleBulkDelete = useCallback(async (): Promise<void> => {
    if (selectedCount === 0) return;

    setIsBulkDeleting(true);
    try {
      const result = await (window.api.transactions as any).bulkDelete(
        Array.from(selectedIds)
      );

      if (result.success) {
        showSuccess(
          `Successfully deleted ${result.deletedCount || selectedCount} transaction${(result.deletedCount || selectedCount) > 1 ? "s" : ""}`
        );
        exitSelectionMode();
        await onComplete();
      } else {
        showError(result.error || "Failed to delete transactions");
      }
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setIsBulkDeleting(false);
      closeBulkDeleteModal();
    }
  }, [
    selectedIds,
    selectedCount,
    onComplete,
    showSuccess,
    showError,
    exitSelectionMode,
    closeBulkDeleteModal,
  ]);

  /**
   * Handle bulk export of selected transactions
   */
  const handleBulkExport = useCallback(
    async (format: string): Promise<void> => {
      if (selectedCount === 0) return;

      setIsBulkExporting(true);
      try {
        const selectedTransactionIds = Array.from(selectedIds);
        let successCount = 0;
        const errors: string[] = [];

        for (const transactionId of selectedTransactionIds) {
          try {
            const result = await window.api.transactions.exportEnhanced(
              transactionId,
              { exportFormat: format }
            );
            if (result.success) {
              successCount++;
            } else {
              errors.push(result.error || `Failed to export transaction`);
            }
          } catch (err) {
            errors.push((err as Error).message);
          }
        }

        if (successCount > 0) {
          showSuccess(
            `Successfully exported ${successCount} transaction${successCount > 1 ? "s" : ""}${errors.length > 0 ? ` (${errors.length} failed)` : ""}`
          );
          exitSelectionMode();
          await onComplete();
        } else {
          showError("Failed to export transactions");
        }
      } catch (err) {
        showError((err as Error).message);
      } finally {
        setIsBulkExporting(false);
        closeBulkExportModal();
      }
    },
    [
      selectedIds,
      selectedCount,
      onComplete,
      showSuccess,
      showError,
      exitSelectionMode,
      closeBulkExportModal,
    ]
  );

  /**
   * Handle bulk status change of selected transactions
   */
  const handleBulkStatusChange = useCallback(
    async (status: "pending" | "active" | "closed" | "rejected"): Promise<void> => {
      if (selectedCount === 0) return;

      setIsBulkUpdating(true);
      try {
        const result = await (window.api.transactions as any).bulkUpdateStatus(
          Array.from(selectedIds),
          status
        );

        if (result.success) {
          showSuccess(
            `Successfully updated ${result.updatedCount || selectedCount} transaction${(result.updatedCount || selectedCount) > 1 ? "s" : ""} to ${status}`
          );
          exitSelectionMode();
          await onComplete();
        } else {
          showError(result.error || "Failed to update transactions");
        }
      } catch (err) {
        showError((err as Error).message);
      } finally {
        setIsBulkUpdating(false);
      }
    },
    [selectedIds, selectedCount, onComplete, showSuccess, showError, exitSelectionMode]
  );

  return {
    isBulkDeleting,
    isBulkExporting,
    isBulkUpdating,
    handleBulkDelete,
    handleBulkExport,
    handleBulkStatusChange,
  };
}

export default useBulkActions;
