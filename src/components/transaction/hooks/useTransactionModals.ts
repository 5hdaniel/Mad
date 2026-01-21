/**
 * Custom hook for managing transaction modal states
 * Consolidates all modal-related state for the Transactions component
 */
import { useState, useCallback } from "react";
import type { Transaction } from "@/types";

/**
 * Return type for useTransactionModals hook
 */
export interface UseTransactionModalsResult {
  // Audit create modal
  showAuditCreate: boolean;
  openAuditCreate: () => void;
  closeAuditCreate: () => void;

  // Quick export modal
  quickExportTransaction: Transaction | null;
  openQuickExport: (transaction: Transaction) => void;
  closeQuickExport: () => void;

  // Quick export success message
  quickExportSuccess: string | null;
  setQuickExportSuccess: (message: string | null) => void;

  // Bulk delete confirmation modal
  showBulkDeleteConfirm: boolean;
  openBulkDeleteConfirm: () => void;
  closeBulkDeleteConfirm: () => void;

  // Bulk export modal
  showBulkExportModal: boolean;
  openBulkExportModal: () => void;
  closeBulkExportModal: () => void;

  // Bulk action success message
  bulkActionSuccess: string | null;
  setBulkActionSuccess: (message: string | null) => void;

  // Selected transaction for details modal
  selectedTransaction: Transaction | null;
  setSelectedTransaction: (transaction: Transaction | null) => void;
}

/**
 * Custom hook for managing transaction modal states
 * @returns Modal states and control functions
 */
export function useTransactionModals(): UseTransactionModalsResult {
  // Audit create modal state
  const [showAuditCreate, setShowAuditCreate] = useState<boolean>(false);

  // Quick export modal state
  const [quickExportTransaction, setQuickExportTransaction] =
    useState<Transaction | null>(null);

  // Quick export success message
  const [quickExportSuccess, setQuickExportSuccess] = useState<string | null>(
    null
  );

  // Bulk delete confirmation modal
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Bulk export modal
  const [showBulkExportModal, setShowBulkExportModal] = useState(false);

  // Bulk action success message
  const [bulkActionSuccess, setBulkActionSuccess] = useState<string | null>(
    null
  );

  // Selected transaction for details modal
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  // Audit create modal handlers
  const openAuditCreate = useCallback(() => {
    setShowAuditCreate(true);
  }, []);

  const closeAuditCreate = useCallback(() => {
    setShowAuditCreate(false);
  }, []);

  // Quick export modal handlers
  const openQuickExport = useCallback((transaction: Transaction) => {
    setQuickExportTransaction(transaction);
  }, []);

  const closeQuickExport = useCallback(() => {
    setQuickExportTransaction(null);
  }, []);

  // Bulk delete confirmation modal handlers
  const openBulkDeleteConfirm = useCallback(() => {
    setShowBulkDeleteConfirm(true);
  }, []);

  const closeBulkDeleteConfirm = useCallback(() => {
    setShowBulkDeleteConfirm(false);
  }, []);

  // Bulk export modal handlers
  const openBulkExportModal = useCallback(() => {
    setShowBulkExportModal(true);
  }, []);

  const closeBulkExportModal = useCallback(() => {
    setShowBulkExportModal(false);
  }, []);

  return {
    // Audit create
    showAuditCreate,
    openAuditCreate,
    closeAuditCreate,

    // Quick export
    quickExportTransaction,
    openQuickExport,
    closeQuickExport,

    // Quick export success
    quickExportSuccess,
    setQuickExportSuccess,

    // Bulk delete confirm
    showBulkDeleteConfirm,
    openBulkDeleteConfirm,
    closeBulkDeleteConfirm,

    // Bulk export
    showBulkExportModal,
    openBulkExportModal,
    closeBulkExportModal,

    // Bulk action success
    bulkActionSuccess,
    setBulkActionSuccess,

    // Selected transaction
    selectedTransaction,
    setSelectedTransaction,
  };
}

export default useTransactionModals;
