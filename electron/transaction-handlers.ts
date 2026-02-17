// ============================================
// TRANSACTION HANDLERS - Compatibility Re-export
// The monolith has been split into 4 domain handler files.
// This file provides backwards compatibility for existing tests.
// ============================================

import type { BrowserWindow } from "electron";
import { registerTransactionCrudHandlers } from "./handlers/transactionCrudHandlers";
import { registerTransactionExportHandlers, cleanupTransactionHandlers } from "./handlers/transactionExportHandlers";
import { registerEmailSyncHandlers } from "./handlers/emailSyncHandlers";
import { registerAttachmentHandlers } from "./handlers/attachmentHandlers";

/**
 * Register all transaction-related IPC handlers (delegates to domain files).
 * @param mainWindow - Main window instance
 */
export function registerTransactionHandlers(
  mainWindow: BrowserWindow | null,
): void {
  registerTransactionCrudHandlers(mainWindow);
  registerTransactionExportHandlers(mainWindow);
  registerEmailSyncHandlers(mainWindow);
  registerAttachmentHandlers(mainWindow);
}

export { cleanupTransactionHandlers };
