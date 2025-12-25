/**
 * Transaction Bridge
 * Manages real estate transactions, email scanning, and export functionality
 */

import { ipcRenderer } from "electron";

export const transactionBridge = {
  /**
   * Scans user's mailbox for real estate transaction emails
   * @param userId - User ID to scan emails for
   * @param options - Scan options (provider, dateRange, propertyAddress, etc.)
   * @returns Scan results
   */
  scan: (userId: string, options: unknown) =>
    ipcRenderer.invoke("transactions:scan", userId, options),

  /**
   * Cancels an ongoing mailbox scan
   * @param userId - User ID to cancel scan for
   * @returns Cancellation result
   */
  cancelScan: (userId: string) =>
    ipcRenderer.invoke("transactions:cancel-scan", userId),

  /**
   * Retrieves all transactions for a user
   * @param userId - User ID to get transactions for
   * @returns All user transactions
   */
  getAll: (userId: string) =>
    ipcRenderer.invoke("transactions:get-all", userId),

  /**
   * Creates a new manual transaction
   * @param userId - User ID creating the transaction
   * @param transactionData - Transaction details (address, type, status, dates, etc.)
   * @returns Created transaction
   */
  create: (userId: string, transactionData: unknown) =>
    ipcRenderer.invoke("transactions:create", userId, transactionData),

  /**
   * Creates a new audited transaction with verified data
   * @param userId - User ID creating the transaction
   * @param transactionData - Audited transaction details
   * @returns Created audited transaction
   */
  createAudited: (userId: string, transactionData: unknown) =>
    ipcRenderer.invoke(
      "transactions:create-audited",
      userId,
      transactionData,
    ),

  /**
   * Gets detailed information for a specific transaction
   * @param transactionId - Transaction ID to retrieve
   * @returns Transaction details
   */
  getDetails: (transactionId: string) =>
    ipcRenderer.invoke("transactions:get-details", transactionId),

  /**
   * Gets transaction with all associated contacts
   * @param transactionId - Transaction ID to retrieve
   * @returns Transaction with contacts
   */
  getWithContacts: (transactionId: string) =>
    ipcRenderer.invoke("transactions:get-with-contacts", transactionId),

  /**
   * Updates transaction details
   * @param transactionId - Transaction ID to update
   * @param updates - Fields to update (status, dates, address, etc.)
   * @returns Updated transaction
   */
  update: (transactionId: string, updates: unknown) =>
    ipcRenderer.invoke("transactions:update", transactionId, updates),

  /**
   * Deletes a transaction
   * @param transactionId - Transaction ID to delete
   * @returns Deletion result
   */
  delete: (transactionId: string) =>
    ipcRenderer.invoke("transactions:delete", transactionId),

  /**
   * Assigns a contact to a transaction with a specific role
   * @param transactionId - Transaction ID
   * @param contactId - Contact ID to assign
   * @param role - Contact's role (e.g., "Buyer's Agent", "Seller", etc.)
   * @param roleCategory - Role category (buyer_side, seller_side, neutral, etc.)
   * @param isPrimary - Whether this is the primary contact for this role
   * @param notes - Additional notes about this assignment
   * @returns Assignment result
   */
  assignContact: (
    transactionId: string,
    contactId: string,
    role: string,
    roleCategory: string,
    isPrimary: boolean,
    notes: string,
  ) =>
    ipcRenderer.invoke(
      "transactions:assign-contact",
      transactionId,
      contactId,
      role,
      roleCategory,
      isPrimary,
      notes,
    ),

  /**
   * Removes a contact from a transaction
   * @param transactionId - Transaction ID
   * @param contactId - Contact ID to remove
   * @returns Removal result
   */
  removeContact: (transactionId: string, contactId: string) =>
    ipcRenderer.invoke(
      "transactions:remove-contact",
      transactionId,
      contactId,
    ),

  /**
   * Batch update contact assignments for a transaction
   * Performs multiple add/remove operations in a single atomic transaction
   * @param transactionId - Transaction ID
   * @param operations - Array of operations to perform
   * @returns Batch update result
   */
  batchUpdateContacts: (
    transactionId: string,
    operations: Array<{
      action: "add" | "remove";
      contactId: string;
      role?: string;
      roleCategory?: string;
      specificRole?: string;
      isPrimary?: boolean;
      notes?: string;
    }>,
  ) =>
    ipcRenderer.invoke(
      "transactions:batchUpdateContacts",
      transactionId,
      operations,
    ),

  /**
   * Unlinks a communication (email) from a transaction
   * The email will be added to an ignored list and won't be re-added during future scans
   * @param communicationId - Communication ID to unlink
   * @param reason - Optional reason for unlinking
   * @returns Unlink result
   */
  unlinkCommunication: (communicationId: string, reason?: string) =>
    ipcRenderer.invoke(
      "transactions:unlink-communication",
      communicationId,
      reason,
    ),

  /**
   * Re-analyzes emails for a specific property and date range
   * @param userId - User ID
   * @param provider - Email provider (google or microsoft)
   * @param propertyAddress - Property address to search for
   * @param dateRange - Date range to search within {start, end}
   * @returns Re-analysis results
   */
  reanalyze: (
    userId: string,
    provider: string,
    propertyAddress: string,
    dateRange: unknown,
  ) =>
    ipcRenderer.invoke(
      "transactions:reanalyze",
      userId,
      provider,
      propertyAddress,
      dateRange,
    ),

  /**
   * Exports transaction as PDF to specified path
   * @param transactionId - Transaction ID to export
   * @param outputPath - File path to save PDF
   * @returns Export result
   */
  exportPDF: (transactionId: string, outputPath: string) =>
    ipcRenderer.invoke("transactions:export-pdf", transactionId, outputPath),

  /**
   * Exports transaction with enhanced options (format, included data, etc.)
   * @param transactionId - Transaction ID to export
   * @param options - Export options (format, includeContacts, includeEmails, etc.)
   * @returns Export result
   */
  exportEnhanced: (transactionId: string, options: unknown) =>
    ipcRenderer.invoke(
      "transactions:export-enhanced",
      transactionId,
      options,
    ),

  /**
   * Bulk deletes multiple transactions
   * @param transactionIds - Array of transaction IDs to delete
   * @returns Bulk deletion result
   */
  bulkDelete: (transactionIds: string[]) =>
    ipcRenderer.invoke("transactions:bulk-delete", transactionIds),

  /**
   * Bulk updates status for multiple transactions
   * @param transactionIds - Array of transaction IDs to update
   * @param status - New status ('active' or 'closed')
   * @returns Bulk update result
   */
  bulkUpdateStatus: (transactionIds: string[], status: string) =>
    ipcRenderer.invoke("transactions:bulk-update-status", transactionIds, status),
};
