/**
 * Folder Export Service
 * Creates organized export folder structure for transaction audits:
 *
 * Transaction_123_Main_St/
 * ├── Summary_Report.pdf        (transaction overview)
 * ├── emails/
 * │   ├── 001_2024-01-15_RE_Inspection.pdf
 * │   └── ...
 * ├── texts/
 * │   └── conversation_John_Smith.txt
 * └── attachments/
 *     ├── document.pdf
 *     └── manifest.json
 */

import path from "path";
import fs from "fs/promises";
import { app, BrowserWindow } from "electron";
import logService from "./logService";
import databaseService from "./databaseService";
import type { Transaction, Communication } from "../types/models";

export interface FolderExportOptions {
  transactionId: string;
  outputPath?: string;
  includeEmails: boolean;
  includeTexts: boolean;
  includeAttachments: boolean;
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
  status?: "exported" | "file_not_found" | "copy_failed";
}

interface AttachmentManifest {
  transactionId: string;
  propertyAddress: string;
  exportDate: string;
  attachments: AttachmentManifestEntry[];
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
    const { includeEmails, includeTexts, includeAttachments, onProgress } = options;

    try {
      logService.info("[Folder Export] Starting folder export", "FolderExport", {
        transactionId: transaction.id,
        emailCount: communications.filter((c) => c.communication_type === "email").length,
        textCount: communications.filter((c) => c.communication_type === "text").length,
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
      const emails = communications.filter((c) => c.communication_type === "email");
      const texts = communications.filter((c) => c.communication_type === "text");

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

      // Generate Summary PDF
      onProgress?.({
        stage: "summary",
        current: 0,
        total: 1,
        message: "Generating summary report...",
      });

      await this.generateSummaryPDF(transaction, communications, basePath);

      onProgress?.({
        stage: "summary",
        current: 1,
        total: 1,
        message: "Summary report complete",
      });

      // Export individual emails as PDFs
      if (includeEmails && emails.length > 0) {
        for (let i = 0; i < emails.length; i++) {
          onProgress?.({
            stage: "emails",
            current: i + 1,
            total: emails.length,
            message: `Exporting email ${i + 1} of ${emails.length}...`,
          });

          await this.exportEmailToPDF(emails[i], i + 1, emailsPath);
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

        await this.exportTextConversations(texts, textsPath);

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

        await this.exportAttachments(transaction, emails, attachmentsPath);

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
    basePath: string
  ): Promise<void> {
    const html = this.generateSummaryHTML(transaction, communications);
    const pdfBuffer = await this.htmlToPdf(html);
    await fs.writeFile(path.join(basePath, "Summary_Report.pdf"), pdfBuffer);
  }

  /**
   * Generate HTML for summary report
   */
  private generateSummaryHTML(
    transaction: Transaction,
    communications: Communication[]
  ): string {
    const formatCurrency = (amount?: number | null): string => {
      if (!amount) return "N/A";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (dateString?: string | Date | null): string => {
      if (!dateString) return "N/A";
      const date = typeof dateString === "string" ? new Date(dateString) : dateString;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const emails = communications.filter((c) => c.communication_type === "email");
    const texts = communications.filter((c) => c.communication_type === "text");

    // Sort emails for the list
    const sortedEmails = [...emails].sort((a, b) => {
      const dateA = new Date(a.sent_at as string).getTime();
      const dateB = new Date(b.sent_at as string).getTime();
      return dateA - dateB;
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      color: #1a202c;
      background: white;
    }
    .header {
      border-bottom: 4px solid #667eea;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 28px; color: #1a202c; margin-bottom: 8px; }
    .header .subtitle { font-size: 14px; color: #718096; }
    .property-info {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .property-info h2 { font-size: 20px; margin-bottom: 12px; }
    .property-info .address { font-size: 16px; opacity: 0.95; }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .detail-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background: #f7fafc;
    }
    .detail-card .label {
      font-size: 12px;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .detail-card .value { font-size: 18px; color: #1a202c; font-weight: 600; }
    .section { margin-bottom: 30px; }
    .section h3 {
      font-size: 18px;
      color: #2d3748;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .email-list { margin-top: 16px; }
    .email-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    .email-item:last-child { border-bottom: none; }
    .email-item .index { color: #718096; width: 40px; }
    .email-item .subject { flex: 1; font-weight: 500; color: #2d3748; }
    .email-item .from { color: #4a5568; width: 200px; }
    .email-item .date { color: #718096; width: 120px; text-align: right; }
    .note {
      background: #edf2f7;
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
      color: #4a5568;
      margin-top: 16px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #a0aec0;
      text-align: center;
    }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Transaction Audit Summary</h1>
    <div class="subtitle">Generated on ${formatDate(new Date())}</div>
  </div>

  <div class="property-info">
    <h2>Property Information</h2>
    <div class="address">${transaction.property_address || "N/A"}</div>
  </div>

  <div class="details-grid">
    <div class="detail-card">
      <div class="label">Transaction Type</div>
      <div class="value">${transaction.transaction_type === "purchase" ? "Purchase" : transaction.transaction_type === "sale" ? "Sale" : "N/A"}</div>
    </div>
    <div class="detail-card">
      <div class="label">Sale Price</div>
      <div class="value">${formatCurrency(transaction.sale_price)}</div>
    </div>
    <div class="detail-card">
      <div class="label">Closing Date</div>
      <div class="value">${formatDate(transaction.closing_date)}</div>
    </div>
    <div class="detail-card">
      <div class="label">Listing Price</div>
      <div class="value">${formatCurrency(transaction.listing_price)}</div>
    </div>
    <div class="detail-card">
      <div class="label">Total Emails</div>
      <div class="value">${emails.length}</div>
    </div>
    <div class="detail-card">
      <div class="label">Total Text Messages</div>
      <div class="value">${texts.length}</div>
    </div>
  </div>

  <div class="section">
    <h3>Communications Index (${emails.length} emails)</h3>
    <div class="email-list">
      ${sortedEmails
        .map((email, index) => {
          const date = new Date(email.sent_at as string);
          return `
        <div class="email-item">
          <span class="index">${String(index + 1).padStart(3, "0")}</span>
          <span class="subject">${this.escapeHtml(email.subject || "(No Subject)")}</span>
          <span class="from">${this.escapeHtml(email.sender || "Unknown")}</span>
          <span class="date">${date.toLocaleDateString()}</span>
        </div>
      `;
        })
        .join("")}
    </div>
    <div class="note">
      Full email content is available in the /emails folder as individual PDF files.
      ${texts.length > 0 ? "Text conversations are in the /texts folder." : ""}
    </div>
  </div>

  <div class="footer">
    <p>This report was automatically generated by MagicAudit</p>
    <p>Transaction ID: ${transaction.id}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Export a single email to PDF
   */
  private async exportEmailToPDF(
    email: Communication,
    index: number,
    outputPath: string
  ): Promise<void> {
    const html = this.generateEmailHTML(email);
    const pdfBuffer = await this.htmlToPdf(html);

    const date = new Date(email.sent_at as string);
    const dateStr = date.toISOString().split("T")[0];
    const subject = this.sanitizeFileName(email.subject || "no_subject");
    const paddedIndex = String(index).padStart(3, "0");

    const fileName = `${paddedIndex}_${dateStr}_${subject}.pdf`;
    await fs.writeFile(path.join(outputPath, fileName), pdfBuffer);
  }

  /**
   * Generate HTML for a single email
   */
  private generateEmailHTML(email: Communication): string {
    const formatDateTime = (dateString: string | Date): string => {
      if (!dateString) return "N/A";
      const date = typeof dateString === "string" ? new Date(dateString) : dateString;
      return date.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    // Use HTML body if available, otherwise use plain text
    const bodyContent = email.body || email.body_plain || "(No content)";
    const isHtmlBody = email.body && email.body.includes("<");

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      color: #1a202c;
      background: white;
    }
    .email-header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .email-subject {
      font-size: 20px;
      font-weight: 600;
      color: #1a202c;
      margin-bottom: 16px;
    }
    .email-meta {
      font-size: 14px;
      color: #4a5568;
    }
    .email-meta div { margin-bottom: 6px; }
    .email-meta .label {
      font-weight: 600;
      color: #718096;
      display: inline-block;
      width: 60px;
    }
    .email-body {
      padding: 20px 0;
      line-height: 1.6;
      font-size: 14px;
    }
    .email-body-text { white-space: pre-wrap; }
    .attachments {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }
    .attachments h4 {
      font-size: 14px;
      color: #718096;
      margin-bottom: 8px;
    }
    .attachments .note {
      font-size: 12px;
      color: #a0aec0;
    }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="email-header">
    <div class="email-subject">${this.escapeHtml(email.subject || "(No Subject)")}</div>
    <div class="email-meta">
      <div><span class="label">From:</span> ${this.escapeHtml(email.sender || "Unknown")}</div>
      <div><span class="label">To:</span> ${this.escapeHtml(email.recipients || "Unknown")}</div>
      ${email.cc ? `<div><span class="label">CC:</span> ${this.escapeHtml(email.cc)}</div>` : ""}
      <div><span class="label">Date:</span> ${formatDateTime(email.sent_at as string)}</div>
    </div>
  </div>

  <div class="email-body ${!isHtmlBody ? "email-body-text" : ""}">
    ${isHtmlBody ? bodyContent : this.escapeHtml(bodyContent)}
  </div>

  ${
    email.has_attachments
      ? `
  <div class="attachments">
    <h4>Attachments (${email.attachment_count || 0})</h4>
    <div class="note">Attachments are available in the /attachments folder</div>
  </div>
  `
      : ""
  }
</body>
</html>
    `;
  }

  /**
   * Export text conversations grouped by contact
   */
  private async exportTextConversations(
    texts: Communication[],
    outputPath: string
  ): Promise<void> {
    // Group texts by contact (sender or recipient)
    const conversationMap = new Map<string, Communication[]>();

    for (const text of texts) {
      // Use sender as the key (the other party in the conversation)
      const contactName = text.sender || "Unknown";
      if (!conversationMap.has(contactName)) {
        conversationMap.set(contactName, []);
      }
      conversationMap.get(contactName)!.push(text);
    }

    // Export each conversation as a separate file
    for (const [contactName, messages] of conversationMap) {
      // Sort messages by date
      messages.sort((a, b) => {
        const dateA = new Date(a.sent_at as string).getTime();
        const dateB = new Date(b.sent_at as string).getTime();
        return dateA - dateB;
      });

      const content = this.formatTextConversation(contactName, messages);
      const fileName = `conversation_${this.sanitizeFileName(contactName)}.txt`;
      await fs.writeFile(path.join(outputPath, fileName), content, "utf8");
    }
  }

  /**
   * Format a text conversation as readable transcript
   */
  private formatTextConversation(
    contactName: string,
    messages: Communication[]
  ): string {
    const lines: string[] = [];

    lines.push(`=== Conversation with ${contactName} ===`);
    lines.push("");
    lines.push(`Total Messages: ${messages.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    for (const msg of messages) {
      const date = new Date(msg.sent_at as string);
      const dateStr = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      lines.push(`[${dateStr} ${timeStr}] ${msg.sender || "Unknown"}:`);
      lines.push(msg.body_plain || msg.body || "(No content)");
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Export attachments and create manifest
   * Queries the attachments table by message_id and copies actual files to output folder
   */
  private async exportAttachments(
    transaction: Transaction,
    emails: Communication[],
    outputPath: string
  ): Promise<void> {
    const manifest: AttachmentManifest = {
      transactionId: transaction.id,
      propertyAddress: transaction.property_address,
      exportDate: new Date().toISOString(),
      attachments: [],
    };

    // Get message IDs for the linked communications
    const messageIds = emails
      .filter((email) => email.message_id)
      .map((email) => email.message_id as string);

    if (messageIds.length === 0) {
      // No linked messages, write empty manifest
      await fs.writeFile(
        path.join(outputPath, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        "utf8"
      );
      return;
    }

    // Query attachments table for all linked messages
    const db = databaseService.getRawDatabase();
    const placeholders = messageIds.map(() => "?").join(", ");
    const attachmentRows = db
      .prepare(
        `
        SELECT id, message_id, filename, mime_type, file_size_bytes, storage_path
        FROM attachments
        WHERE message_id IN (${placeholders})
      `
      )
      .all(...messageIds) as {
      id: string;
      message_id: string;
      filename: string;
      mime_type: string | null;
      file_size_bytes: number | null;
      storage_path: string | null;
    }[];

    // Build a map of message_id -> email index for quick lookup
    const messageIdToEmailIndex = new Map<string, number>();
    const messageIdToEmail = new Map<string, Communication>();
    emails.forEach((email, index) => {
      if (email.message_id) {
        messageIdToEmailIndex.set(email.message_id, index + 1);
        messageIdToEmail.set(email.message_id, email);
      }
    });

    // Track used filenames to avoid collisions
    const usedFilenames = new Set<string>();

    for (const att of attachmentRows) {
      const email = messageIdToEmail.get(att.message_id);
      const emailIndex = messageIdToEmailIndex.get(att.message_id);
      const originalFilename = att.filename || `attachment_${manifest.attachments.length + 1}`;

      // Generate unique filename to avoid collisions
      let exportFilename = this.sanitizeFileName(originalFilename);
      let counter = 1;
      const baseName = exportFilename.replace(/\.[^.]+$/, "");
      const extension = exportFilename.includes(".") ? exportFilename.slice(exportFilename.lastIndexOf(".")) : "";

      while (usedFilenames.has(exportFilename)) {
        exportFilename = `${baseName}_${counter}${extension}`;
        counter++;
      }
      usedFilenames.add(exportFilename);

      const destPath = path.join(outputPath, exportFilename);

      // Handle missing storage_path
      if (!att.storage_path) {
        logService.warn("[Folder Export] Attachment has no storage path", "FolderExport", {
          attachmentId: att.id,
          filename: att.filename,
        });
        manifest.attachments.push({
          filename: originalFilename,
          originalMessage: email?.subject || "(No Subject)",
          date: (email?.sent_at as string) || new Date().toISOString(),
          size: att.file_size_bytes || 0,
          sourceEmailIndex: emailIndex,
          status: "file_not_found",
        });
        continue;
      }

      try {
        // Check if source file exists
        if (await this.fileExists(att.storage_path)) {
          // Copy the file to the output folder
          await fs.copyFile(att.storage_path, destPath);
          manifest.attachments.push({
            filename: exportFilename,
            originalMessage: email?.subject || "(No Subject)",
            date: (email?.sent_at as string) || new Date().toISOString(),
            size: att.file_size_bytes || 0,
            sourceEmailIndex: emailIndex,
            status: "exported",
          });
          logService.debug("[Folder Export] Exported attachment", "FolderExport", {
            filename: exportFilename,
            sourcePath: att.storage_path,
          });
        } else {
          // File not found at storage path
          logService.warn("[Folder Export] Attachment file not found", "FolderExport", {
            attachmentId: att.id,
            storagePath: att.storage_path,
          });
          manifest.attachments.push({
            filename: originalFilename,
            originalMessage: email?.subject || "(No Subject)",
            date: (email?.sent_at as string) || new Date().toISOString(),
            size: att.file_size_bytes || 0,
            sourceEmailIndex: emailIndex,
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
          originalMessage: email?.subject || "(No Subject)",
          date: (email?.sent_at as string) || new Date().toISOString(),
          size: att.file_size_bytes || 0,
          sourceEmailIndex: emailIndex,
          status: "copy_failed",
        });
      }
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
    });
  }

  /**
   * Convert HTML to PDF using Electron's built-in capability
   */
  private async htmlToPdf(html: string): Promise<Buffer> {
    // Create hidden window for PDF generation
    this.exportWindow = new BrowserWindow({
      width: 800,
      height: 1200,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Load HTML content
    await this.exportWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    );

    // Wait for page to render
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate PDF
    const pdfData = await this.exportWindow.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: "Letter",
    });

    // Clean up window
    this.exportWindow.close();
    this.exportWindow = null;

    return pdfData;
  }

  /**
   * Get default export path for a transaction
   */
  getDefaultExportPath(transaction: Transaction): string {
    const downloadsPath = app.getPath("downloads");
    const folderName = this.sanitizeFileName(
      `Transaction_${transaction.property_address}_${Date.now()}`
    );
    return path.join(downloadsPath, folderName);
  }

  /**
   * Sanitize filename to remove invalid characters
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-z0-9_\-\.]/gi, "_")
      .replace(/_+/g, "_")
      .substring(0, 100);
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
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
}

export default new FolderExportService();
