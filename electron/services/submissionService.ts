/**
 * Transaction Submission Service (BACKLOG-394)
 *
 * Handles pushing complete transaction data from local SQLite to Supabase cloud
 * for broker review in the B2B portal.
 *
 * Flow:
 * 1. Load local data (transaction, messages, attachments)
 * 2. Upload attachments to Storage (via supabaseStorageService)
 * 3. Insert transaction_submission record
 * 4. Insert submission_messages records
 * 5. Insert submission_attachments records
 * 6. Update local submission_status
 *
 * @see BACKLOG-394 for full design
 */

import * as crypto from "crypto";
import { app } from "electron";
import supabaseService from "./supabaseService";
import supabaseStorageService, {
  LocalAttachment,
  AttachmentUploadResult,
} from "./supabaseStorageService";
import databaseService from "./databaseService";
import logService from "./logService";
import { getContactNames } from "./contactsService";
import type {
  Transaction,
  Message,
  Attachment,
  SubmissionStatus,
} from "../types/models";

/** Contact name map from phone/email to display name */
type ContactMap = Record<string, string>;

// ============================================
// TYPES & INTERFACES
// ============================================

/** Result of a submission operation */
export interface SubmissionResult {
  success: boolean;
  submissionId: string | null;
  error?: string;
  attachmentsFailed: number;
  messagesCount: number;
  attachmentsCount: number;
}

/** Progress stages for submission flow */
export type SubmissionStage =
  | "preparing"
  | "attachments"
  | "transaction"
  | "messages"
  | "complete"
  | "failed";

/** Progress callback data */
export interface SubmissionProgress {
  stage: SubmissionStage;
  stageProgress: number; // 0-100 within current stage
  overallProgress: number; // 0-100 total
  currentItem?: string;
}

/** Record structure for transaction_submissions table */
interface SubmissionRecord {
  id: string;
  organization_id: string;
  submitted_by: string;
  local_transaction_id: string;
  property_address: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  transaction_type: string;
  listing_price?: number;
  sale_price?: number;
  started_at?: string;
  closed_at?: string;
  status: string;
  version: number;
  parent_submission_id?: string;
  message_count: number;
  attachment_count: number;
  submission_metadata?: Record<string, unknown>;
}

/** Record structure for submission_messages table */
interface SubmissionMessageRecord {
  submission_id: string;
  local_message_id: string;
  channel: string;
  direction: string;
  subject?: string;
  body_text?: string;
  participants?: Record<string, unknown>;
  sent_at?: string;
  thread_id?: string;
  has_attachments: boolean;
  attachment_count: number;
}

/** Record structure for submission_attachments table */
interface SubmissionAttachmentRecord {
  submission_id: string;
  filename: string;
  mime_type?: string;
  file_size_bytes?: number;
  storage_path: string;
  document_type?: string;
}

/** Cloud submission status response */
interface CloudSubmissionStatus {
  id: string;
  status: string;
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

// ============================================
// CONSTANTS
// ============================================

const MESSAGE_BATCH_SIZE = 50;

// ============================================
// SERVICE CLASS
// ============================================

class SubmissionService {
  /**
   * Submit a transaction for broker review
   *
   * @param transactionId - Local transaction ID
   * @param onProgress - Progress callback
   * @returns Submission result with cloud submission ID
   */
  async submitTransaction(
    transactionId: string,
    onProgress?: (progress: SubmissionProgress) => void
  ): Promise<SubmissionResult> {
    return this.submitTransactionInternal(transactionId, undefined, onProgress);
  }

  /**
   * Resubmit a transaction (creates new version)
   *
   * @param transactionId - Local transaction ID
   * @param onProgress - Progress callback
   * @returns Submission result with new submission ID
   */
  async resubmitTransaction(
    transactionId: string,
    onProgress?: (progress: SubmissionProgress) => void
  ): Promise<SubmissionResult> {
    const transaction = await this.loadTransaction(transactionId);

    if (!transaction.submission_id) {
      throw new Error("Transaction has not been submitted before");
    }

    // Get current version from cloud
    const client = supabaseService.getClient();
    const { data: existingSubmission, error } = await client
      .from("transaction_submissions")
      .select("version")
      .eq("id", transaction.submission_id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      throw new Error(`Failed to get existing submission: ${error.message}`);
    }

    const newVersion = (existingSubmission?.version || 1) + 1;

    return this.submitTransactionInternal(
      transactionId,
      {
        version: newVersion,
        parentSubmissionId: transaction.submission_id,
      },
      onProgress
    );
  }

  /**
   * Get submission status from cloud
   *
   * @param submissionId - Cloud submission ID
   * @returns Current status and review info
   */
  async getSubmissionStatus(
    submissionId: string
  ): Promise<CloudSubmissionStatus | null> {
    try {
      const client = supabaseService.getClient();
      const { data, error } = await client
        .from("transaction_submissions")
        .select("id, status, review_notes, reviewed_by, reviewed_at")
        .eq("id", submissionId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw error;
      }

      return data;
    } catch (error) {
      logService.error(
        `[Submission] Failed to get status for ${submissionId}`,
        "SubmissionService",
        { error: error instanceof Error ? error.message : "Unknown error" }
      );
      throw error;
    }
  }

  /**
   * Internal submission implementation
   */
  private async submitTransactionInternal(
    transactionId: string,
    options?: {
      version?: number;
      parentSubmissionId?: string;
    },
    onProgress?: (progress: SubmissionProgress) => void
  ): Promise<SubmissionResult> {
    const submissionId = crypto.randomUUID();
    let attachmentUploadResults: AttachmentUploadResult[] = [];

    try {
      // Stage 1: Prepare (10%)
      onProgress?.({
        stage: "preparing",
        stageProgress: 0,
        overallProgress: 0,
        currentItem: "Loading transaction data...",
      });

      const transaction = await this.loadTransaction(transactionId);

      // Parse audit period dates from transaction
      const auditStartDate = transaction.started_at
        ? new Date(transaction.started_at)
        : null;
      const auditEndDate = transaction.closed_at
        ? new Date(transaction.closed_at)
        : null;

      // Load messages filtered by audit period
      const messages = await this.loadTransactionMessages(
        transactionId,
        auditStartDate,
        auditEndDate
      );
      const attachments = await this.loadTransactionAttachments(
        transactionId,
        auditStartDate,
        auditEndDate
      );
      const orgId = await this.getUserOrganizationId();

      // Load contact names for phone number resolution
      let contactMap: ContactMap = {};
      try {
        const contactResult = await getContactNames();
        if (contactResult.status.success) {
          contactMap = contactResult.contactMap;
          logService.info(
            `[Submission] Loaded ${Object.keys(contactMap).length} contacts for name resolution`,
            "SubmissionService"
          );
        }
      } catch (err) {
        logService.warn(
          `[Submission] Could not load contacts: ${err instanceof Error ? err.message : "Unknown error"}`,
          "SubmissionService"
        );
      }

      if (!orgId) {
        throw new Error("User is not a member of any organization");
      }

      // Check for existing submission
      const client = supabaseService.getClient();
      const { data: existingSubmission } = await client
        .from("transaction_submissions")
        .select("id, status")
        .eq("organization_id", orgId)
        .eq("local_transaction_id", transactionId)
        .maybeSingle();

      if (existingSubmission) {
        // Check if resubmission is allowed based on status
        const blockedStatuses = ["under_review", "approved", "rejected"];
        if (blockedStatuses.includes(existingSubmission.status)) {
          const statusMessages: Record<string, string> = {
            under_review:
              "Cannot resubmit while broker is reviewing. Please wait for their decision.",
            approved: "This submission has already been approved.",
            rejected: "This submission has been rejected.",
          };
          throw new Error(
            statusMessages[existingSubmission.status] ||
              `Cannot resubmit with status: ${existingSubmission.status}`
          );
        }

        // Allowed to resubmit (status is 'submitted', 'resubmitted', or 'needs_changes')
        logService.info(
          `[Submission] Replacing existing submission ${existingSubmission.id} (status: ${existingSubmission.status})`,
          "SubmissionService"
        );
        // Delete old submission (cascades to messages and attachments)
        await client
          .from("transaction_submissions")
          .delete()
          .eq("id", existingSubmission.id);
      }

      onProgress?.({
        stage: "preparing",
        stageProgress: 100,
        overallProgress: 10,
        currentItem: `Found ${messages.length} messages, ${attachments.length} attachments`,
      });

      // Stage 2: Upload attachments (30%)
      if (attachments.length > 0) {
        onProgress?.({
          stage: "attachments",
          stageProgress: 0,
          overallProgress: 10,
          currentItem: `Uploading ${attachments.length} attachments...`,
        });

        const localAttachments: LocalAttachment[] = attachments.map((a) => ({
          id: a.id,
          localPath: a.storage_path || "",
          filename: a.filename,
        }));

        const uploadResult = await supabaseStorageService.uploadAttachments(
          orgId,
          submissionId,
          localAttachments,
          (overallPct, current) => {
            onProgress?.({
              stage: "attachments",
              stageProgress: overallPct,
              overallProgress: 10 + overallPct * 0.3,
              currentItem: `Uploading ${current.filename}...`,
            });
          }
        );

        attachmentUploadResults = uploadResult.results;

        if (uploadResult.failedCount > 0) {
          logService.warn(
            `[Submission] ${uploadResult.failedCount} attachments failed to upload`,
            "SubmissionService"
          );
        }
      }

      // Stage 3: Insert transaction submission (20%)
      onProgress?.({
        stage: "transaction",
        stageProgress: 0,
        overallProgress: 40,
        currentItem: "Creating submission record...",
      });

      const submissionRecord = this.mapToSubmission(
        transaction,
        orgId,
        submissionId,
        messages.length,
        attachmentUploadResults.filter((r) => r.success).length,
        options
      );

      const { error: insertError } = await client
        .from("transaction_submissions")
        .insert(submissionRecord);

      if (insertError) {
        throw new Error(
          `Failed to insert submission: ${insertError.message}`
        );
      }

      onProgress?.({
        stage: "transaction",
        stageProgress: 100,
        overallProgress: 60,
        currentItem: "Submission record created",
      });

      // Stage 4: Insert messages (30%)
      if (messages.length > 0) {
        onProgress?.({
          stage: "messages",
          stageProgress: 0,
          overallProgress: 60,
          currentItem: `Uploading ${messages.length} messages...`,
        });

        const messageRecords = messages.map((m) =>
          this.mapToSubmissionMessage(m, submissionId, contactMap)
        );

        await this.insertMessagesBatched(
          messageRecords,
          (batchProgress) => {
            onProgress?.({
              stage: "messages",
              stageProgress: batchProgress,
              overallProgress: 60 + batchProgress * 0.3,
              currentItem: `Uploading messages...`,
            });
          }
        );
      }

      // Stage 5: Insert attachment metadata (10%)
      const successfulUploads = attachmentUploadResults.filter((r) => r.success);
      if (successfulUploads.length > 0) {
        const attachmentRecords = successfulUploads.map((upload, idx) => {
          const originalAttachment = attachments.find(
            (a) => a.storage_path === upload.localId || a.id === upload.localId
          );
          return this.mapToSubmissionAttachment(
            upload,
            submissionId,
            originalAttachment
          );
        });

        const { error: attachError } = await client
          .from("submission_attachments")
          .insert(attachmentRecords);

        if (attachError) {
          logService.warn(
            `[Submission] Failed to insert attachment records: ${attachError.message}`,
            "SubmissionService"
          );
        }
      }

      // Stage 6: Update local status
      await this.updateLocalSubmissionStatus(transactionId, {
        submission_status: options?.version
          ? "resubmitted"
          : ("submitted" as SubmissionStatus),
        submission_id: submissionId,
        submitted_at: new Date().toISOString(),
      });

      onProgress?.({
        stage: "complete",
        stageProgress: 100,
        overallProgress: 100,
        currentItem: "Submission complete",
      });

      logService.info(
        `[Submission] Transaction ${transactionId} submitted successfully as ${submissionId}`,
        "SubmissionService",
        {
          messagesCount: messages.length,
          attachmentsCount: successfulUploads.length,
          attachmentsFailed: attachmentUploadResults.filter((r) => !r.success)
            .length,
        }
      );

      return {
        success: true,
        submissionId,
        messagesCount: messages.length,
        attachmentsCount: successfulUploads.length,
        attachmentsFailed: attachmentUploadResults.filter((r) => !r.success)
          .length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logService.error(
        `[Submission] Failed to submit transaction ${transactionId}: ${errorMessage}`,
        "SubmissionService"
      );

      onProgress?.({
        stage: "failed",
        stageProgress: 0,
        overallProgress: 0,
        currentItem: errorMessage,
      });

      // Cleanup on failure
      await this.cleanupFailedSubmission(submissionId);

      return {
        success: false,
        submissionId: null,
        error: errorMessage,
        messagesCount: 0,
        attachmentsCount: 0,
        attachmentsFailed: 0,
      };
    }
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadTransaction(transactionId: string): Promise<Transaction> {
    const transaction = await databaseService.getTransactionById(transactionId);
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }
    return transaction;
  }

  private async loadTransactionMessages(
    transactionId: string,
    auditStartDate?: Date | null,
    auditEndDate?: Date | null
  ): Promise<Message[]> {
    // Get all messages linked to this transaction via communications junction table
    const db = databaseService.getRawDatabase();

    // Build query with optional audit period filter
    // BACKLOG-414: Use dual-join pattern to include both email (via message_id)
    // AND text messages (via thread_id) like getCommunicationsWithMessages does
    let sql = `
      SELECT DISTINCT m.*
      FROM messages m
      INNER JOIN communications c ON (
        (c.message_id IS NOT NULL AND c.message_id = m.id)
        OR
        (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
      )
      WHERE c.transaction_id = ?
    `;
    const params: (string | number)[] = [transactionId];

    // Filter by audit period if dates are provided
    if (auditStartDate) {
      sql += ` AND m.sent_at >= ?`;
      params.push(auditStartDate.toISOString());
    }
    if (auditEndDate) {
      // Use end of day for inclusive comparison
      const endOfDay = new Date(auditEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      sql += ` AND m.sent_at <= ?`;
      params.push(endOfDay.toISOString());
    }

    sql += ` ORDER BY m.sent_at ASC`;

    const rows = db.prepare(sql).all(...params) as Message[];

    logService.info(
      `[Submission] Loaded ${rows.length} messages for audit period`,
      "SubmissionService",
      {
        transactionId,
        auditStart: auditStartDate?.toISOString(),
        auditEnd: auditEndDate?.toISOString(),
      }
    );

    return rows;
  }

  private async loadTransactionAttachments(
    transactionId: string,
    auditStartDate?: Date | null,
    auditEndDate?: Date | null
  ): Promise<Attachment[]> {
    // Get attachments from messages and emails linked to this transaction
    // Filter by audit period if dates are provided
    const db = databaseService.getRawDatabase();

    // Build date filter conditions
    let dateFilter = "";
    const dateParams: string[] = [];
    if (auditStartDate) {
      dateFilter += " AND m.sent_at >= ?";
      dateParams.push(auditStartDate.toISOString());
    }
    if (auditEndDate) {
      const endOfDay = new Date(auditEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter += " AND m.sent_at <= ?";
      dateParams.push(endOfDay.toISOString());
    }

    // Query 1: Text message attachments (via message_id -> messages -> communications)
    // BACKLOG-414: Use dual-join pattern to include attachments from both email
    // (via message_id) AND text messages (via thread_id)
    // Now includes audit date filter on message sent_at
    const textAttachmentsSql = `
      SELECT DISTINCT a.*
      FROM attachments a
      INNER JOIN messages m ON a.message_id = m.id
      INNER JOIN communications c ON (
        (c.message_id IS NOT NULL AND c.message_id = m.id)
        OR
        (c.message_id IS NULL AND c.thread_id IS NOT NULL AND c.thread_id = m.thread_id)
      )
      WHERE c.transaction_id = ?
      AND a.storage_path IS NOT NULL
      ${dateFilter}
    `;
    const textAttachments = db
      .prepare(textAttachmentsSql)
      .all(transactionId, ...dateParams) as Attachment[];

    // Build email date filter (uses emails.sent_at instead of messages.sent_at)
    let emailDateFilter = "";
    const emailDateParams: string[] = [];
    if (auditStartDate) {
      emailDateFilter += " AND e.sent_at >= ?";
      emailDateParams.push(auditStartDate.toISOString());
    }
    if (auditEndDate) {
      const endOfDay = new Date(auditEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      emailDateFilter += " AND e.sent_at <= ?";
      emailDateParams.push(endOfDay.toISOString());
    }

    // Query 2: Email attachments (via email_id -> communications -> emails)
    // TASK-1779: Include email attachments in broker portal upload
    // Now includes audit date filter on email sent_at
    const emailAttachmentsSql = `
      SELECT DISTINCT a.*
      FROM attachments a
      INNER JOIN emails e ON a.email_id = e.id
      INNER JOIN communications c ON c.email_id = e.id
      WHERE c.transaction_id = ?
      AND a.email_id IS NOT NULL
      AND a.storage_path IS NOT NULL
      ${emailDateFilter}
    `;
    const emailAttachments = db
      .prepare(emailAttachmentsSql)
      .all(transactionId, ...emailDateParams) as Attachment[];

    if (emailAttachments.length > 0) {
      logService.info(
        `[Submission] Found ${emailAttachments.length} email attachments for transaction ${transactionId}`,
        "SubmissionService"
      );
    }

    // Combine and deduplicate by id, then sort by created_at
    const allAttachments = [...textAttachments, ...emailAttachments];
    const uniqueAttachments = Array.from(
      new Map(allAttachments.map((a) => [a.id, a])).values()
    );

    // Sort by created_at
    uniqueAttachments.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at as string).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at as string).getTime() : 0;
      return aTime - bTime;
    });

    return uniqueAttachments;
  }

  private async getUserOrganizationId(): Promise<string | null> {
    // For demo: Use a hardcoded org ID or get from user's organization membership
    // In production: Query organization_members for current user

    // Check if user has Supabase auth session
    const userId = supabaseService.getAuthUserId();

    if (!userId) {
      // Fallback: Use demo org ID for testing
      logService.warn(
        "[Submission] No Supabase auth session, using demo org ID",
        "SubmissionService"
      );
      return "a0000000-0000-0000-0000-000000000001"; // Demo org from seed
    }

    try {
      const client = supabaseService.getClient();
      const { data, error } = await client
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        logService.warn(
          `[Submission] Failed to get org: ${error.message}`,
          "SubmissionService"
        );
        return "a0000000-0000-0000-0000-000000000001"; // Fallback to demo
      }

      return data?.organization_id || "a0000000-0000-0000-0000-000000000001";
    } catch {
      return "a0000000-0000-0000-0000-000000000001";
    }
  }

  private getCurrentUserId(): string {
    // Get from Supabase auth session or fallback
    const userId = supabaseService.getAuthUserId();
    if (userId) return userId;

    // Fallback for demo - use the demo user ID from seed data
    // This user must exist in auth.users for foreign key constraint
    logService.warn(
      "[Submission] No Supabase auth user, using demo user ID",
      "SubmissionService"
    );
    return "d5283d52-f612-4ab4-9e85-f3a5adc01bea"; // Demo user: magicauditwa@gmail.com
  }

  // ============================================
  // DATA MAPPING
  // ============================================

  private mapToSubmission(
    transaction: Transaction,
    orgId: string,
    submissionId: string,
    messageCount: number,
    attachmentCount: number,
    options?: {
      version?: number;
      parentSubmissionId?: string;
    }
  ): SubmissionRecord {
    // Parse address parts if available
    let city = "";
    let state = "";
    let zip = "";

    if (transaction.property_city) city = transaction.property_city;
    if (transaction.property_state) state = transaction.property_state;
    if (transaction.property_zip) zip = transaction.property_zip;

    return {
      id: submissionId,
      organization_id: orgId,
      submitted_by: this.getCurrentUserId(),
      local_transaction_id: transaction.id,
      property_address: transaction.property_address || "",
      property_city: city || undefined,
      property_state: state || undefined,
      property_zip: zip || undefined,
      transaction_type: transaction.transaction_type || "other",
      listing_price: transaction.listing_price || undefined,
      sale_price: transaction.sale_price || undefined,
      started_at: transaction.started_at
        ? new Date(transaction.started_at).toISOString()
        : undefined,
      closed_at: transaction.closed_at
        ? new Date(transaction.closed_at).toISOString()
        : undefined,
      status: "submitted",
      version: options?.version || 1,
      parent_submission_id: options?.parentSubmissionId,
      message_count: messageCount,
      attachment_count: attachmentCount,
      submission_metadata: {
        desktop_version: app.getVersion(),
        detection_source: transaction.detection_source,
        detection_confidence: transaction.detection_confidence,
      },
    };
  }

  private mapToSubmissionMessage(
    message: Message,
    submissionId: string,
    contactMap: ContactMap = {}
  ): SubmissionMessageRecord {
    // Parse participants JSON
    let participants: Record<string, unknown> = {};
    if (message.participants) {
      try {
        participants =
          typeof message.participants === "string"
            ? JSON.parse(message.participants)
            : message.participants;
      } catch {
        participants = { from: "", to: [] };
      }
    }

    // Resolve contact names and add to participants
    const resolvePhone = (phone: string): string | undefined => {
      if (!phone || phone === "me" || phone === "unknown") return undefined;
      // Try direct lookup
      if (contactMap[phone]) return contactMap[phone];
      // Try normalized (last 10 digits)
      const normalized = phone.replace(/\D/g, "").slice(-10);
      if (normalized.length >= 7) {
        for (const [p, name] of Object.entries(contactMap)) {
          if (p.replace(/\D/g, "").slice(-10) === normalized) {
            return name;
          }
        }
      }
      return undefined;
    };

    // Add resolved names to participants
    if (participants.from && typeof participants.from === "string") {
      const name = resolvePhone(participants.from);
      if (name) participants.from_name = name;
    }
    if (participants.to) {
      const toList = Array.isArray(participants.to)
        ? participants.to
        : [participants.to];
      const toNames: Record<string, string> = {};
      toList.forEach((phone: string) => {
        const name = resolvePhone(phone);
        if (name) toNames[phone] = name;
      });
      if (Object.keys(toNames).length > 0) {
        participants.to_names = toNames;
      }
    }
    if (
      participants.chat_members &&
      Array.isArray(participants.chat_members)
    ) {
      const memberNames: Record<string, string> = {};
      participants.chat_members.forEach((phone: string) => {
        const name = resolvePhone(phone);
        if (name) memberNames[phone] = name;
      });
      if (Object.keys(memberNames).length > 0) {
        participants.chat_member_names = memberNames;
      }
    }

    return {
      submission_id: submissionId,
      local_message_id: message.id,
      channel: message.channel || "email",
      direction: message.direction || "inbound",
      subject: message.subject || undefined,
      body_text: message.body_text || undefined,
      participants,
      sent_at: message.sent_at
        ? new Date(message.sent_at as string).toISOString()
        : undefined,
      thread_id: message.thread_id || undefined,
      has_attachments: message.has_attachments || false,
      attachment_count: 0, // Would need to count from attachments table
    };
  }

  private mapToSubmissionAttachment(
    uploadResult: AttachmentUploadResult,
    submissionId: string,
    originalAttachment?: Attachment
  ): SubmissionAttachmentRecord {
    return {
      submission_id: submissionId,
      filename: originalAttachment?.filename || "unknown",
      mime_type: uploadResult.mimeType || originalAttachment?.mime_type,
      file_size_bytes:
        uploadResult.fileSizeBytes || originalAttachment?.file_size_bytes,
      storage_path: uploadResult.storagePath,
      document_type: originalAttachment?.document_type,
    };
  }

  // ============================================
  // DATABASE OPERATIONS
  // ============================================

  private async insertMessagesBatched(
    records: SubmissionMessageRecord[],
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const client = supabaseService.getClient();
    const total = records.length;

    for (let i = 0; i < records.length; i += MESSAGE_BATCH_SIZE) {
      const batch = records.slice(i, i + MESSAGE_BATCH_SIZE);

      const { error } = await client.from("submission_messages").insert(batch);

      if (error) {
        logService.warn(
          `[Submission] Batch insert warning: ${error.message}`,
          "SubmissionService"
        );
      }

      const progress = Math.min(100, ((i + batch.length) / total) * 100);
      onProgress?.(progress);
    }
  }

  private async updateLocalSubmissionStatus(
    transactionId: string,
    updates: {
      submission_status: SubmissionStatus;
      submission_id: string;
      submitted_at: string;
    }
  ): Promise<void> {
    try {
      await databaseService.updateTransaction(transactionId, {
        submission_status: updates.submission_status,
        submission_id: updates.submission_id,
        submitted_at: updates.submitted_at,
      });
    } catch (error) {
      logService.error(
        `[Submission] Failed to update local status: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SubmissionService"
      );
      // Don't throw - the cloud submission succeeded
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  private async cleanupFailedSubmission(submissionId: string): Promise<void> {
    try {
      const client = supabaseService.getClient();

      // Delete messages (cascade will handle this, but be explicit)
      await client
        .from("submission_messages")
        .delete()
        .eq("submission_id", submissionId);

      // Delete attachments records
      await client
        .from("submission_attachments")
        .delete()
        .eq("submission_id", submissionId);

      // Delete submission record
      await client
        .from("transaction_submissions")
        .delete()
        .eq("id", submissionId);

      // Note: Storage files are NOT deleted here (orphaned files are cleaned up separately)

      logService.info(
        `[Submission] Cleaned up failed submission ${submissionId}`,
        "SubmissionService"
      );
    } catch (error) {
      logService.warn(
        `[Submission] Cleanup warning: ${error instanceof Error ? error.message : "Unknown error"}`,
        "SubmissionService"
      );
    }
  }
}

// Export singleton
export const submissionService = new SubmissionService();
export default submissionService;
