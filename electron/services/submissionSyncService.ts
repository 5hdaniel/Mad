/**
 * Submission Sync Service (BACKLOG-395)
 *
 * Polls Supabase for status changes on submitted transactions and
 * updates local SQLite database. Emits events for UI notifications.
 *
 * Features:
 * - Periodic polling (configurable interval)
 * - Status change detection
 * - Review notes sync
 * - Event emission for UI updates
 * - Offline handling
 */

import { BrowserWindow } from "electron";
import supabaseService from "./supabaseService";
import databaseService from "./databaseService";
import logService from "./logService";
import type { Transaction, SubmissionStatus } from "../types/models";

// ============================================
// TYPES & INTERFACES
// ============================================

/** Result of a sync operation */
export interface SyncResult {
  updated: number;
  failed: number;
  details: StatusChangeDetail[];
}

/** Details of a status change */
export interface StatusChangeDetail {
  transactionId: string;
  propertyAddress: string;
  oldStatus: SubmissionStatus;
  newStatus: SubmissionStatus;
  reviewNotes?: string;
}

/** Cloud submission status record */
interface CloudSubmissionStatus {
  id: string;
  status: string;
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

/** Local transaction with submission fields */
interface LocalSubmittedTransaction {
  id: string;
  property_address: string;
  submission_id: string;
  submission_status: SubmissionStatus;
  last_review_notes?: string | null;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_SYNC_INTERVAL_MS = 60000; // 1 minute
const MIN_SYNC_INTERVAL_MS = 10000; // 10 seconds minimum

// ============================================
// SERVICE CLASS
// ============================================

class SubmissionSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private syncIntervalMs: number = DEFAULT_SYNC_INTERVAL_MS;
  private isOnline: boolean = true;
  private mainWindow: BrowserWindow | null = null;

  /**
   * Set the main window reference for sending events
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Start periodic sync polling
   * @param intervalMs - Polling interval in milliseconds (default: 1 minute)
   */
  startPeriodicSync(intervalMs: number = DEFAULT_SYNC_INTERVAL_MS): void {
    if (this.syncInterval) {
      logService.info("[SyncService] Sync already running", "SubmissionSyncService");
      return;
    }

    this.syncIntervalMs = Math.max(intervalMs, MIN_SYNC_INTERVAL_MS);

    logService.info(
      `[SyncService] Starting periodic sync every ${this.syncIntervalMs / 1000}s`,
      "SubmissionSyncService"
    );

    // Start interval
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAllSubmissions();
      } catch (error) {
        logService.error(
          `[SyncService] Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          "SubmissionSyncService"
        );
      }
    }, this.syncIntervalMs);

    // Also run immediately
    this.syncAllSubmissions().catch((error) => {
      logService.error(
        `[SyncService] Initial sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SubmissionSyncService"
      );
    });
  }

  /**
   * Stop periodic sync polling
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logService.info("[SyncService] Stopped periodic sync", "SubmissionSyncService");
    }
  }

  /**
   * Check if sync is currently running
   */
  isRunning(): boolean {
    return this.syncInterval !== null;
  }

  /**
   * Manually trigger a sync
   */
  async manualSync(): Promise<SyncResult> {
    return this.syncAllSubmissions();
  }

  /**
   * Sync all submitted transactions
   */
  async syncAllSubmissions(): Promise<SyncResult> {
    // Check online status (in Electron main process, we check via net module or assume online)
    // For simplicity, we'll try the request and handle errors
    const result: SyncResult = {
      updated: 0,
      failed: 0,
      details: [],
    };

    try {
      // 1. Get all local transactions with submission_id that are not in terminal states
      const submittedTransactions = await this.getLocalSubmittedTransactions();

      if (submittedTransactions.length === 0) {
        logService.debug("[SyncService] No pending submissions to sync", "SubmissionSyncService");
        return result;
      }

      logService.debug(
        `[SyncService] Syncing ${submittedTransactions.length} submissions`,
        "SubmissionSyncService"
      );

      // 2. Fetch cloud statuses
      const submissionIds = submittedTransactions.map((t) => t.submission_id);
      const cloudStatuses = await this.fetchCloudStatuses(submissionIds);

      if (!cloudStatuses || cloudStatuses.length === 0) {
        logService.debug("[SyncService] No cloud statuses returned", "SubmissionSyncService");
        return result;
      }

      // 3. Compare and update
      for (const local of submittedTransactions) {
        const cloud = cloudStatuses.find((c) => c.id === local.submission_id);
        if (!cloud) continue;

        // Check if status or review notes changed
        const statusChanged = cloud.status !== local.submission_status;
        const notesChanged = cloud.review_notes !== local.last_review_notes;

        if (statusChanged || notesChanged) {
          try {
            await this.updateLocalTransaction(local.id, {
              submission_status: cloud.status as SubmissionStatus,
              last_review_notes: cloud.review_notes || null,
            });

            result.updated++;

            const detail: StatusChangeDetail = {
              transactionId: local.id,
              propertyAddress: local.property_address,
              oldStatus: local.submission_status,
              newStatus: cloud.status as SubmissionStatus,
              reviewNotes: cloud.review_notes,
            };
            result.details.push(detail);

            // Emit event for UI notification if status changed
            if (statusChanged) {
              this.emitStatusChange(detail);
            }

            logService.info(
              `[SyncService] Updated ${local.property_address}: ${local.submission_status} -> ${cloud.status}`,
              "SubmissionSyncService"
            );
          } catch (error) {
            result.failed++;
            logService.error(
              `[SyncService] Failed to update transaction ${local.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
              "SubmissionSyncService"
            );
          }
        }
      }

      if (result.updated > 0) {
        logService.info(
          `[SyncService] Sync complete: ${result.updated} updated, ${result.failed} failed`,
          "SubmissionSyncService"
        );
      }

      return result;
    } catch (error) {
      logService.error(
        `[SyncService] Sync error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SubmissionSyncService"
      );
      throw error;
    }
  }

  /**
   * Sync a specific transaction's submission status
   */
  async syncSubmission(transactionId: string): Promise<boolean> {
    try {
      const db = databaseService.getRawDatabase();
      const transaction = db
        .prepare(
          `SELECT id, property_address, submission_id, submission_status, last_review_notes
           FROM transactions
           WHERE id = ? AND submission_id IS NOT NULL`
        )
        .get(transactionId) as LocalSubmittedTransaction | undefined;

      if (!transaction) {
        return false;
      }

      const cloudStatuses = await this.fetchCloudStatuses([transaction.submission_id]);
      if (!cloudStatuses || cloudStatuses.length === 0) {
        return false;
      }

      const cloud = cloudStatuses[0];
      const statusChanged = cloud.status !== transaction.submission_status;
      const notesChanged = cloud.review_notes !== transaction.last_review_notes;

      if (statusChanged || notesChanged) {
        await this.updateLocalTransaction(transaction.id, {
          submission_status: cloud.status as SubmissionStatus,
          last_review_notes: cloud.review_notes || null,
        });

        if (statusChanged) {
          this.emitStatusChange({
            transactionId: transaction.id,
            propertyAddress: transaction.property_address,
            oldStatus: transaction.submission_status,
            newStatus: cloud.status as SubmissionStatus,
            reviewNotes: cloud.review_notes,
          });
        }

        return true;
      }

      return false;
    } catch (error) {
      logService.error(
        `[SyncService] Failed to sync single submission: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SubmissionSyncService"
      );
      return false;
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Get local transactions that are submitted but not in terminal states
   */
  private async getLocalSubmittedTransactions(): Promise<LocalSubmittedTransaction[]> {
    const db = databaseService.getRawDatabase();

    const rows = db
      .prepare(
        `SELECT id, property_address, submission_id, submission_status, last_review_notes
         FROM transactions
         WHERE submission_id IS NOT NULL
         AND submission_status NOT IN ('approved', 'rejected', 'not_submitted')
         ORDER BY submitted_at DESC`
      )
      .all() as LocalSubmittedTransaction[];

    return rows;
  }

  /**
   * Fetch submission statuses from Supabase cloud
   */
  private async fetchCloudStatuses(submissionIds: string[]): Promise<CloudSubmissionStatus[] | null> {
    try {
      const client = supabaseService.getClient();
      const { data, error } = await client
        .from("transaction_submissions")
        .select("id, status, review_notes, reviewed_by, reviewed_at")
        .in("id", submissionIds);

      if (error) {
        logService.error(
          `[SyncService] Supabase query error: ${error.message}`,
          "SubmissionSyncService"
        );
        return null;
      }

      return data;
    } catch (error) {
      logService.error(
        `[SyncService] Failed to fetch cloud statuses: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SubmissionSyncService"
      );
      return null;
    }
  }

  /**
   * Update local transaction with new submission data
   */
  private async updateLocalTransaction(
    transactionId: string,
    updates: {
      submission_status: SubmissionStatus;
      last_review_notes: string | null;
    }
  ): Promise<void> {
    const db = databaseService.getRawDatabase();

    db.prepare(
      `UPDATE transactions
       SET submission_status = ?,
           last_review_notes = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      updates.submission_status,
      updates.last_review_notes,
      new Date().toISOString(),
      transactionId
    );
  }

  /**
   * Emit status change event to renderer
   */
  private emitStatusChange(detail: StatusChangeDetail): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      logService.debug(
        "[SyncService] No main window to send status change event",
        "SubmissionSyncService"
      );
      return;
    }

    const notification = {
      transactionId: detail.transactionId,
      propertyAddress: detail.propertyAddress,
      oldStatus: detail.oldStatus,
      newStatus: detail.newStatus,
      reviewNotes: detail.reviewNotes,
      title: this.getNotificationTitle(detail.newStatus),
      message: this.getNotificationMessage(detail.newStatus, detail.propertyAddress, detail.reviewNotes),
    };

    this.mainWindow.webContents.send("submission-status-changed", notification);

    logService.info(
      `[SyncService] Emitted status change: ${detail.propertyAddress} -> ${detail.newStatus}`,
      "SubmissionSyncService"
    );
  }

  /**
   * Get notification title based on status
   */
  private getNotificationTitle(status: SubmissionStatus): string {
    switch (status) {
      case "under_review":
        return "Submission Under Review";
      case "needs_changes":
        return "Changes Requested";
      case "approved":
        return "Submission Approved!";
      case "rejected":
        return "Submission Rejected";
      case "submitted":
        return "Submission Received";
      case "resubmitted":
        return "Resubmission Received";
      default:
        return "Submission Status Updated";
    }
  }

  /**
   * Get notification message based on status
   */
  private getNotificationMessage(
    status: SubmissionStatus,
    propertyAddress: string,
    reviewNotes?: string
  ): string {
    const address = propertyAddress || "Transaction";

    switch (status) {
      case "under_review":
        return `${address} is now being reviewed by your broker.`;
      case "needs_changes":
        return reviewNotes
          ? `${address}: ${reviewNotes}`
          : `${address} requires changes before approval.`;
      case "approved":
        return `${address} has been approved by your broker.`;
      case "rejected":
        return reviewNotes
          ? `${address}: ${reviewNotes}`
          : `${address} was not approved.`;
      default:
        return `${address} status has been updated.`;
    }
  }
}

// Export singleton
export const submissionSyncService = new SubmissionSyncService();
export default submissionSyncService;
