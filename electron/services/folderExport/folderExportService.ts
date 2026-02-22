/**
 * Folder Export Service
 * Creates organized export folder structure for transaction audits:
 *
 * Transaction_123_Main_St/
 * +-- Summary_Report.pdf        (transaction overview)
 * +-- emails/
 * |   +-- 001_2024-01-15_RE_Inspection.pdf
 * |   +-- ...
 * +-- texts/
 * |   +-- thread_001_John_Smith_2024-01-15.pdf
 * |   +-- ...
 * +-- attachments/
 *     +-- document.pdf
 *     +-- manifest.json
 *
 * Orchestrator class that delegates HTML generation to helper modules:
 * - emailExportHelpers: Email HTML generation and quoted content stripping
 * - textExportHelpers: Text/SMS thread HTML generation
 * - summaryHelpers: Summary report HTML generation
 * - attachmentHelpers: Attachment querying and file management
 */

import path from "path";
import fs from "fs/promises";
import { app, BrowserWindow } from "electron";
import { PDFDocument } from "pdf-lib";
import logService from "../logService";
import databaseService from "../databaseService";
import { getUserById } from "../db/userDbService";
import type { Transaction, Communication } from "../../types/models";
import { isEmailMessage, isTextMessage } from "../../utils/channelHelpers";
import {
  resolveHandles as resolveAllHandles,
  resolveGroupChatParticipants as sharedResolveGroupChatParticipants,
  extractParticipantHandles,
} from "../contactResolutionService";

// Import extracted helpers
import { generateSummaryHTML } from "./summaryHelpers";
import {
  generateEmailThreadHTML,
  generateEmailHTML,
  isHtmlContent as _isHtmlContent,
  stripQuotedContent as _stripQuotedContent,
  stripSubjectPrefixes as _stripSubjectPrefixes,
} from "./emailExportHelpers";
import {
  getThreadKey,
  getThreadContact,
  isGroupChat,
  generateTextThreadHTML,
} from "./textExportHelpers";
import {
  getAttachmentsForMessage,
  getAttachmentsForEmail,
  sanitizeFileName,
  exportEmailAttachmentsToThreadDirs,
  type AttachmentExportResult,
} from "./attachmentHelpers";

export interface FolderExportOptions {
  transactionId: string;
  outputPath?: string;
  includeEmails: boolean;
  includeTexts: boolean;
  includeAttachments: boolean;
  emailExportMode?: "thread" | "individual";
  onProgress?: (progress: FolderExportProgress) => void;
}

export interface FolderExportProgress {
  stage: "preparing" | "summary" | "emails" | "texts" | "attachments" | "complete";
  current: number;
  total: number;
  message: string;
}

interface AttachmentManifestEntry {
  filename: string;
  originalMessage: string;
  date: string;
  size: number;
  sourceEmailIndex?: number;
  messageType?: "email" | "text";
  messagePreview?: string;
  status?: "exported" | "file_not_found" | "copy_failed";
}

interface AttachmentManifest {
  transactionId: string;
  propertyAddress: string;
  exportDate: string;
  attachments: AttachmentManifestEntry[];
  /** TASK-2050: Summary of email attachments exported to thread directories */
  emailAttachments?: {
    totalCount: number;
    exportedCount: number;
    skippedCount: number;
    totalSizeBytes: number;
    items: Array<{
      emailId: string;
      filename: string;
      contentType: string;
      sizeBytes: number;
      exportPath: string;
    }>;
    errors: string[];
  };
}

class FolderExportService {
  private exportWindow: BrowserWindow | null = null;

  /**
   * Export transaction to organized folder structure
   */
  async exportTransactionToFolder(
    transaction: Transaction,
    communications: Communication[],
    options: FolderExportOptions
  ): Promise<string> {
    const { includeEmails, includeTexts, includeAttachments, emailExportMode, onProgress } = options;

    try {
      logService.info("[Folder Export] Starting folder export", "FolderExport", {
        transactionId: transaction.id,
        emailCount: communications.filter((c) => isEmailMessage(c)).length,
        textCount: communications.filter((c) => isTextMessage(c)).length,
      });

      // Create base folder
      const basePath = options.outputPath || this.getDefaultExportPath(transaction);
      await fs.mkdir(basePath, { recursive: true });

      // Create subfolders
      const emailsPath = path.join(basePath, "emails");
      const textsPath = path.join(basePath, "texts");
      const attachmentsPath = path.join(basePath, "attachments");

      if (includeEmails) {
        await fs.mkdir(emailsPath, { recursive: true });
      }
      if (includeTexts) {
        await fs.mkdir(textsPath, { recursive: true });
      }
      if (includeAttachments) {
        await fs.mkdir(attachmentsPath, { recursive: true });
      }

      onProgress?.({
        stage: "preparing",
        current: 0,
        total: 100,
        message: "Creating folder structure...",
      });

      // Separate emails and texts
      const emails = communications.filter((c) => isEmailMessage(c));
      const texts = communications.filter((c) => isTextMessage(c));

      // Sort by date (oldest first for indexing)
      emails.sort((a, b) => {
        const dateA = new Date(a.sent_at as string).getTime();
        const dateB = new Date(b.sent_at as string).getTime();
        return dateA - dateB;
      });

      texts.sort((a, b) => {
        const dateA = new Date(a.sent_at as string).getTime();
        const dateB = new Date(b.sent_at as string).getTime();
        return dateA - dateB;
      });

      // TASK-2026: Pre-load contact names for all handles (phones + emails + Apple IDs)
      const allHandles = extractParticipantHandles(texts);
      const phoneNameMap = await resolveAllHandles(allHandles);

      // Get user's name and email for "me" display in group chats
      let userName: string | undefined;
      let userEmail: string | undefined;
      try {
        const user = await getUserById(transaction.user_id);
        if (user) {
          userName = user.display_name || user.first_name || user.email?.split("@")[0];
          userEmail = user.email || undefined;
        }
      } catch {
        // Ignore - will fall back to "You"
      }

      // Generate Summary PDF
      onProgress?.({
        stage: "summary",
        current: 0,
        total: 1,
        message: "Generating summary report...",
      });

      await this.generateSummaryPDF(transaction, communications, basePath, phoneNameMap);

      onProgress?.({
        stage: "summary",
        current: 1,
        total: 1,
        message: "Summary report complete",
      });

      // Export emails as PDFs
      if (includeEmails && emails.length > 0) {
        if (emailExportMode === "individual") {
          for (let i = 0; i < emails.length; i++) {
            onProgress?.({
              stage: "emails",
              current: i + 1,
              total: emails.length,
              message: `Exporting email ${i + 1} of ${emails.length}...`,
            });
            await this.exportEmailToPDF(emails[i], i + 1, emailsPath, true);
          }
        } else {
          onProgress?.({
            stage: "emails",
            current: 0,
            total: 1,
            message: "Exporting email threads...",
          });
          await this.exportEmailThreads(emails, emailsPath);
          onProgress?.({
            stage: "emails",
            current: 1,
            total: 1,
            message: "Email threads exported",
          });
        }
      }

      // TASK-2050: Export email attachments into per-thread subdirectories
      // This runs after email PDFs are exported, adding attachments/ subdirs alongside the PDFs
      let emailAttachmentResult: AttachmentExportResult | undefined;
      if (includeEmails && emails.length > 0) {
        emailAttachmentResult = await exportEmailAttachmentsToThreadDirs(
          emails,
          emailsPath,
        );
        if (emailAttachmentResult.exported > 0 || emailAttachmentResult.skipped > 0) {
          logService.info("[Folder Export] Email attachments phase complete", "FolderExport", {
            exported: emailAttachmentResult.exported,
            skipped: emailAttachmentResult.skipped,
            totalSizeMB: (emailAttachmentResult.totalSizeBytes / 1024 / 1024).toFixed(1),
          });
        }
      }

      // Export text conversations
      if (includeTexts && texts.length > 0) {
        onProgress?.({
          stage: "texts",
          current: 0,
          total: 1,
          message: "Exporting text conversations...",
        });

        await this.exportTextConversations(texts, textsPath, phoneNameMap, userName, userEmail);

        onProgress?.({
          stage: "texts",
          current: 1,
          total: 1,
          message: "Text conversations exported",
        });
      }

      // Export attachments with manifest
      if (includeAttachments) {
        onProgress?.({
          stage: "attachments",
          current: 0,
          total: 1,
          message: "Collecting attachments...",
        });

        const allCommunications = [...emails, ...texts];
        await this.exportAttachments(transaction, allCommunications, attachmentsPath, emailAttachmentResult);

        onProgress?.({
          stage: "attachments",
          current: 1,
          total: 1,
          message: "Attachments exported",
        });
      }

      onProgress?.({
        stage: "complete",
        current: 100,
        total: 100,
        message: "Export complete!",
      });

      logService.info("[Folder Export] Export complete", "FolderExport", { basePath });
      return basePath;
    } catch (error) {
      logService.error("[Folder Export] Export failed", "FolderExport", { error });
      throw error;
    } finally {
      if (this.exportWindow) {
        this.exportWindow.close();
        this.exportWindow = null;
      }
    }
  }

  /**
   * Generate summary PDF for the transaction
   */
  private async generateSummaryPDF(
    transaction: Transaction,
    communications: Communication[],
    basePath: string,
    phoneNameMap?: Record<string, string>
  ): Promise<void> {
    const html = generateSummaryHTML(transaction, communications, phoneNameMap);
    const pdfBuffer = await this.htmlToPdf(html);
    await fs.writeFile(path.join(basePath, "Summary_Report.pdf"), pdfBuffer);
  }

  /**
   * Export a single email to PDF
   */
  private async exportEmailToPDF(
    email: Communication,
    index: number,
    outputPath: string,
    stripQuotes: boolean = false
  ): Promise<void> {
    const attachments = email.id ? getAttachmentsForEmail(email.id) : [];
    const html = generateEmailHTML(email, attachments, stripQuotes);
    const pdfBuffer = await this.htmlToPdf(html);

    const date = new Date(email.sent_at as string);
    const dateStr = date.toISOString().split("T")[0];
    const subject = sanitizeFileName(email.subject || "no_subject");
    const paddedIndex = String(index).padStart(3, "0");

    const fileName = `email_${paddedIndex}_${dateStr}_${subject}.pdf`;
    await fs.writeFile(path.join(outputPath, fileName), pdfBuffer);
  }

  /**
   * Export emails grouped by thread -- one PDF per conversation thread.
   */
  private async exportEmailThreads(
    emails: Communication[],
    outputPath: string
  ): Promise<void> {
    // Group emails by thread
    const threads = new Map<string, Communication[]>();
    for (const email of emails) {
      const key = getThreadKey(email);
      const thread = threads.get(key) || [];
      thread.push(email);
      threads.set(key, thread);
    }

    // Sort messages within each thread chronologically
    threads.forEach((msgs, key) => {
      threads.set(
        key,
        msgs.sort((a, b) => {
          const dateA = new Date(a.sent_at as string).getTime();
          const dateB = new Date(b.sent_at as string).getTime();
          return dateA - dateB;
        })
      );
    });

    // Export each thread as a single PDF
    let threadIndex = 0;
    for (const [, msgs] of threads) {
      const html = generateEmailThreadHTML(msgs, getAttachmentsForEmail);
      const pdfBuffer = await this.htmlToPdf(html);

      const firstDate = msgs[0].sent_at
        ? new Date(msgs[0].sent_at as string).toISOString().split("T")[0]
        : "unknown";
      const subject = sanitizeFileName(msgs[0].subject || "no_subject");
      const paddedIndex = String(threadIndex + 1).padStart(3, "0");
      const fileName = `thread_${paddedIndex}_${firstDate}_${subject}.pdf`;

      await fs.writeFile(path.join(outputPath, fileName), pdfBuffer);
      threadIndex++;
    }
  }

  /**
   * Export text conversations as individual PDF files (one per thread)
   */
  private async exportTextConversations(
    texts: Communication[],
    outputPath: string,
    phoneNameMap?: Record<string, string>,
    userName?: string,
    userEmail?: string
  ): Promise<void> {
    const nameMap = phoneNameMap || {};

    // Group texts by thread
    const textThreads = new Map<string, Communication[]>();
    for (const msg of texts) {
      const key = getThreadKey(msg);
      const thread = textThreads.get(key) || [];
      thread.push(msg);
      textThreads.set(key, thread);
    }

    // Sort messages within each thread chronologically
    textThreads.forEach((msgs, key) => {
      textThreads.set(
        key,
        msgs.sort((a, b) => {
          const dateA = new Date(a.sent_at || a.received_at || 0).getTime();
          const dateB = new Date(b.sent_at || b.received_at || 0).getTime();
          return dateA - dateB;
        })
      );
    });

    // Export each thread as PDF
    let threadIndex = 0;
    for (const [, msgs] of textThreads) {
      const contact = getThreadContact(msgs, nameMap);
      const groupChat = isGroupChat(msgs);
      // TASK-2027: Delegate to shared service, adapt ResolvedParticipant to {phone, name} format
      const participants = groupChat
        ? (await sharedResolveGroupChatParticipants(msgs, nameMap, userName, userEmail))
            .map(p => ({ phone: p.handle, name: p.name }))
        : undefined;
      const html = generateTextThreadHTML(
        msgs,
        contact,
        nameMap,
        groupChat,
        threadIndex,
        participants,
        getAttachmentsForMessage
      );
      const pdfBuffer = await this.htmlToPdf(html);

      // Get date from first message
      const firstMsgDate = msgs[0].sent_at || msgs[0].received_at;
      const firstDate = firstMsgDate
        ? new Date(firstMsgDate as string).toISOString().split("T")[0]
        : "unknown";
      // Use better display name for unknown contacts
      let displayName: string;
      if (!contact.name && contact.phone.toLowerCase() === "unknown") {
        displayName = groupChat ? "Group_Chat" : "Unknown_Contact";
      } else {
        displayName = contact.name || contact.phone;
      }
      const contactName = sanitizeFileName(displayName);
      const fileName = `text_${String(threadIndex + 1).padStart(3, "0")}_${contactName}_${firstDate}.pdf`;

      await fs.writeFile(path.join(outputPath, fileName), pdfBuffer);
      threadIndex++;
    }
  }

  /**
   * Export attachments and create manifest
   * TASK-2050: Updated to include email attachment metadata in manifest
   */
  private async exportAttachments(
    transaction: Transaction,
    communications: Communication[],
    outputPath: string,
    emailAttachmentResult?: AttachmentExportResult
  ): Promise<void> {
    const manifest: AttachmentManifest = {
      transactionId: transaction.id,
      propertyAddress: transaction.property_address,
      exportDate: new Date().toISOString(),
      attachments: [],
    };

    const emailComms = communications.filter((comm) => isEmailMessage(comm));
    const textComms = communications.filter((comm) => isTextMessage(comm));

    const messageIds = textComms
      .filter((comm) => comm.message_id || comm.id)
      .map((comm) => comm.message_id || comm.id) as string[];

    const emailIds = emailComms
      .filter((comm) => comm.id)
      .map((comm) => comm.id) as string[];

    const externalIds = textComms
      .filter((comm) => (comm as any).external_id)
      .map((comm) => (comm as any).external_id) as string[];

    const commsWithAttachments = communications.filter((c) => c.has_attachments);
    logService.info(
      `[Folder Export] exportAttachments called`,
      "FolderExport",
      {
        totalCommunications: communications.length,
        withHasAttachments: commsWithAttachments.length,
        messageIds: messageIds.length,
        emailIds: emailIds.length,
        externalIds: externalIds.length,
      }
    );

    if (messageIds.length === 0 && emailIds.length === 0) {
      await fs.writeFile(
        path.join(outputPath, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        "utf8"
      );
      return;
    }

    // Query attachments table for all linked messages and emails
    const db = databaseService.getRawDatabase();
    let attachmentRows: {
      id: string;
      message_id: string | null;
      email_id: string | null;
      filename: string;
      mime_type: string | null;
      file_size_bytes: number | null;
      storage_path: string | null;
    }[] = [];

    if (messageIds.length > 0) {
      const placeholders = messageIds.map(() => "?").join(", ");
      const textAttachmentRows = db
        .prepare(
          `
          SELECT id, message_id, NULL as email_id, filename, mime_type, file_size_bytes, storage_path
          FROM attachments
          WHERE message_id IN (${placeholders})
        `
        )
        .all(...messageIds) as typeof attachmentRows;

      attachmentRows = [...attachmentRows, ...textAttachmentRows];

      if (externalIds.length > 0) {
        const externalPlaceholders = externalIds.map(() => "?").join(", ");
        const fallbackRows = db
          .prepare(
            `
            SELECT id, message_id, NULL as email_id, filename, mime_type, file_size_bytes, storage_path
            FROM attachments
            WHERE external_message_id IN (${externalPlaceholders})
              AND id NOT IN (SELECT id FROM attachments WHERE message_id IN (${placeholders}))
          `
          )
          .all(...externalIds, ...messageIds) as typeof attachmentRows;

        if (fallbackRows.length > 0) {
          logService.info(
            `[Folder Export] Found ${fallbackRows.length} additional attachments via external_message_id fallback`,
            "FolderExport"
          );
          attachmentRows = [...attachmentRows, ...fallbackRows];
        }
      }
    }

    if (emailIds.length > 0) {
      const emailPlaceholders = emailIds.map(() => "?").join(", ");
      const emailAttachmentRows = db
        .prepare(
          `
          SELECT id, NULL as message_id, email_id, filename, mime_type, file_size_bytes, storage_path
          FROM attachments
          WHERE email_id IN (${emailPlaceholders})
        `
        )
        .all(...emailIds) as typeof attachmentRows;

      if (emailAttachmentRows.length > 0) {
        logService.info(
          `[Folder Export] Found ${emailAttachmentRows.length} email attachments`,
          "FolderExport"
        );
        attachmentRows = [...attachmentRows, ...emailAttachmentRows];
      }
    }

    // Build maps for quick lookup
    const messageIdToCommIndex = new Map<string, number>();
    const messageIdToComm = new Map<string, Communication>();
    const externalIdToCommIndex = new Map<string, number>();
    const externalIdToComm = new Map<string, Communication>();
    communications.forEach((comm, index) => {
      if (comm.message_id) {
        messageIdToCommIndex.set(comm.message_id, index + 1);
        messageIdToComm.set(comm.message_id, comm);
      }
      if (comm.id) {
        messageIdToCommIndex.set(comm.id, index + 1);
        messageIdToComm.set(comm.id, comm);
      }
      const extId = (comm as any).external_id;
      if (extId) {
        externalIdToCommIndex.set(extId, index + 1);
        externalIdToComm.set(extId, comm);
      }
    });

    const getMessageType = (comm: Communication): "email" | "text" => {
      const type = comm.communication_type;
      if (type === "sms" || type === "imessage" || type === "text") {
        return "text";
      }
      return "email";
    };

    const getMessagePreview = (comm: Communication): string => {
      const body = comm.body_text || comm.body_plain || "";
      return body.slice(0, 100);
    };

    const getOriginalMessage = (comm: Communication): string => {
      const type = getMessageType(comm);
      if (type === "email") {
        return comm.subject || "(No Subject)";
      }
      const preview = getMessagePreview(comm);
      const participant = comm.sender || "Unknown";
      return preview ? `${participant}: ${preview.slice(0, 50)}...` : participant;
    };

    const usedFilenames = new Set<string>();

    for (const att of attachmentRows) {
      let comm: Communication | undefined;
      let commIndex: number | undefined;

      if (att.message_id) {
        comm = messageIdToComm.get(att.message_id);
        commIndex = messageIdToCommIndex.get(att.message_id);
      }

      if (!comm && att.email_id) {
        comm = messageIdToComm.get(att.email_id);
        commIndex = messageIdToCommIndex.get(att.email_id);
      }

      if (!comm && (att as any).external_message_id) {
        comm = externalIdToComm.get((att as any).external_message_id);
        commIndex = externalIdToCommIndex.get((att as any).external_message_id);
      }

      const originalFilename = att.filename || `attachment_${manifest.attachments.length + 1}`;

      let exportFilename = sanitizeFileName(originalFilename);
      let counter = 1;
      const baseName = exportFilename.replace(/\.[^.]+$/, "");
      const extension = exportFilename.includes(".") ? exportFilename.slice(exportFilename.lastIndexOf(".")) : "";

      while (usedFilenames.has(exportFilename)) {
        exportFilename = `${baseName}_${counter}${extension}`;
        counter++;
      }
      usedFilenames.add(exportFilename);

      const destPath = path.join(outputPath, exportFilename);

      const messageType = comm ? getMessageType(comm) : "email";
      const messagePreview = comm ? getMessagePreview(comm) : undefined;

      if (!att.storage_path) {
        logService.warn("[Folder Export] Attachment has no storage path", "FolderExport", {
          attachmentId: att.id,
          filename: att.filename,
        });
        manifest.attachments.push({
          filename: originalFilename,
          originalMessage: comm ? getOriginalMessage(comm) : "(No Subject)",
          date: (comm?.sent_at as string) || new Date().toISOString(),
          size: att.file_size_bytes || 0,
          sourceEmailIndex: commIndex,
          messageType,
          messagePreview,
          status: "file_not_found",
        });
        continue;
      }

      try {
        if (await this.fileExists(att.storage_path)) {
          await fs.copyFile(att.storage_path, destPath);
          manifest.attachments.push({
            filename: exportFilename,
            originalMessage: comm ? getOriginalMessage(comm) : "(No Subject)",
            date: (comm?.sent_at as string) || new Date().toISOString(),
            size: att.file_size_bytes || 0,
            sourceEmailIndex: commIndex,
            messageType,
            messagePreview,
            status: "exported",
          });
          logService.debug("[Folder Export] Exported attachment", "FolderExport", {
            filename: exportFilename,
            sourcePath: att.storage_path,
          });
        } else {
          logService.warn("[Folder Export] Attachment file not found", "FolderExport", {
            attachmentId: att.id,
            storagePath: att.storage_path,
          });
          manifest.attachments.push({
            filename: originalFilename,
            originalMessage: comm ? getOriginalMessage(comm) : "(No Subject)",
            date: (comm?.sent_at as string) || new Date().toISOString(),
            size: att.file_size_bytes || 0,
            sourceEmailIndex: commIndex,
            messageType,
            messagePreview,
            status: "file_not_found",
          });
        }
      } catch (copyError) {
        logService.warn("[Folder Export] Failed to copy attachment", "FolderExport", {
          filename: att.filename,
          error: copyError,
        });
        manifest.attachments.push({
          filename: originalFilename,
          originalMessage: comm ? getOriginalMessage(comm) : "(No Subject)",
          date: (comm?.sent_at as string) || new Date().toISOString(),
          size: att.file_size_bytes || 0,
          sourceEmailIndex: commIndex,
          messageType,
          messagePreview,
          status: "copy_failed",
        });
      }
    }

    // TASK-2050: Include email attachment metadata in manifest
    if (emailAttachmentResult) {
      manifest.emailAttachments = {
        totalCount: emailAttachmentResult.exported + emailAttachmentResult.skipped,
        exportedCount: emailAttachmentResult.exported,
        skippedCount: emailAttachmentResult.skipped,
        totalSizeBytes: emailAttachmentResult.totalSizeBytes,
        items: emailAttachmentResult.items
          .filter((item) => item.status === "exported")
          .map((item) => ({
            emailId: item.emailId,
            filename: item.filename,
            contentType: item.contentType,
            sizeBytes: item.sizeBytes,
            exportPath: item.exportPath,
          })),
        errors: emailAttachmentResult.errors,
      };
    }

    // Write manifest
    await fs.writeFile(
      path.join(outputPath, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    logService.info("[Folder Export] Attachments export complete", "FolderExport", {
      total: attachmentRows.length,
      exported: manifest.attachments.filter((a) => a.status === "exported").length,
      notFound: manifest.attachments.filter((a) => a.status === "file_not_found").length,
      failed: manifest.attachments.filter((a) => a.status === "copy_failed").length,
      emailAttachmentsExported: emailAttachmentResult?.exported ?? 0,
    });
  }

  /**
   * Convert HTML to PDF using Electron's built-in capability
   */
  private async htmlToPdf(html: string): Promise<Buffer> {
    const tempDir = app.getPath("temp");
    const tempFile = path.join(tempDir, `export-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    await fs.writeFile(tempFile, html, "utf8");

    try {
      this.exportWindow = new BrowserWindow({
        width: 800,
        height: 1200,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      await this.exportWindow.loadFile(tempFile);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const pdfData = await this.exportWindow.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        pageSize: "Letter",
      });

      this.exportWindow.close();
      this.exportWindow = null;

      return pdfData;
    } finally {
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Get default export path for a transaction
   */
  getDefaultExportPath(transaction: Transaction): string {
    const downloadsPath = app.getPath("downloads");
    const folderName = sanitizeFileName(
      `Transaction_${transaction.property_address}_${Date.now()}`
    );
    return path.join(downloadsPath, folderName);
  }

  /**
   * Check if a file exists at the given path
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Export transaction to a single combined PDF
   */
  async exportTransactionToCombinedPDF(
    transaction: Transaction,
    communications: Communication[],
    outputPath: string,
    summaryOnly: boolean = false,
    emailExportMode: "thread" | "individual" = "thread"
  ): Promise<string> {
    const tempDir = app.getPath("temp");
    const tempFolder = path.join(tempDir, `pdf-combine-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    try {
      logService.info("[Folder Export] Starting combined PDF export", "FolderExport", {
        transactionId: transaction.id,
        outputPath,
      });

      await fs.mkdir(tempFolder, { recursive: true });
      const emailsPath = path.join(tempFolder, "emails");
      const textsPath = path.join(tempFolder, "texts");
      await fs.mkdir(emailsPath, { recursive: true });
      await fs.mkdir(textsPath, { recursive: true });

      const emails = communications.filter((c) => isEmailMessage(c));
      const texts = communications.filter((c) => isTextMessage(c));

      emails.sort((a, b) => {
        const dateA = new Date(a.sent_at as string).getTime();
        const dateB = new Date(b.sent_at as string).getTime();
        return dateA - dateB;
      });

      texts.sort((a, b) => {
        const dateA = new Date(a.sent_at as string).getTime();
        const dateB = new Date(b.sent_at as string).getTime();
        return dateA - dateB;
      });

      const allHandles = extractParticipantHandles(texts);
      const phoneNameMap = await resolveAllHandles(allHandles);

      let userName: string | undefined;
      let userEmail: string | undefined;
      try {
        const user = await getUserById(transaction.user_id);
        if (user) {
          userName = user.display_name || user.first_name || user.email?.split("@")[0];
          userEmail = user.email || undefined;
        }
      } catch {
        // Ignore - will fall back to "You"
      }

      await this.generateSummaryPDF(transaction, communications, tempFolder, phoneNameMap);

      if (!summaryOnly) {
        if (emailExportMode === "individual") {
          for (let i = 0; i < emails.length; i++) {
            await this.exportEmailToPDF(emails[i], i + 1, emailsPath, true);
          }
        } else {
          await this.exportEmailThreads(emails, emailsPath);
        }

        if (texts.length > 0) {
          await this.exportTextConversations(texts, textsPath, phoneNameMap, userName, userEmail);
        }
      } else {
        logService.info("[Folder Export] Summary-only mode: skipping full content PDFs", "FolderExport");
      }

      const pdfFiles: string[] = [];

      const summaryPath = path.join(tempFolder, "Summary_Report.pdf");
      if (await this.fileExists(summaryPath)) {
        pdfFiles.push(summaryPath);
      }

      const emailFiles = await fs.readdir(emailsPath);
      const sortedEmailFiles = emailFiles.filter(f => f.endsWith(".pdf")).sort();
      for (const file of sortedEmailFiles) {
        pdfFiles.push(path.join(emailsPath, file));
      }

      const textFiles = await fs.readdir(textsPath);
      const sortedTextFiles = textFiles.filter(f => f.endsWith(".pdf")).sort();
      for (const file of sortedTextFiles) {
        pdfFiles.push(path.join(textsPath, file));
      }

      const combinedPdf = await PDFDocument.create();

      for (const pdfPath of pdfFiles) {
        try {
          const pdfBytes = await fs.readFile(pdfPath);
          const pdf = await PDFDocument.load(pdfBytes);
          const pages = await combinedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach((page) => combinedPdf.addPage(page));
        } catch (err) {
          logService.warn("[Folder Export] Failed to add PDF to combined document", "FolderExport", {
            pdfPath,
            error: err,
          });
        }
      }

      const combinedPdfBytes = await combinedPdf.save();
      await fs.writeFile(outputPath, combinedPdfBytes);

      logService.info("[Folder Export] Combined PDF export complete", "FolderExport", {
        outputPath,
        pageCount: combinedPdf.getPageCount(),
        sourceFiles: pdfFiles.length,
      });

      return outputPath;
    } catch (error) {
      logService.error("[Folder Export] Combined PDF export failed", "FolderExport", { error });
      throw error;
    } finally {
      try {
        await fs.rm(tempFolder, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      if (this.exportWindow) {
        this.exportWindow.close();
        this.exportWindow = null;
      }
    }
  }
}

export default new FolderExportService();
