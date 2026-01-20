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
 * │   ├── thread_001_John_Smith_2024-01-15.pdf
 * │   └── ...
 * └── attachments/
 *     ├── document.pdf
 *     └── manifest.json
 */

import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
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
  messageType?: "email" | "text";
  messagePreview?: string;
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
        textCount: communications.filter((c) =>
          c.communication_type === "sms" ||
          c.communication_type === "imessage" ||
          c.communication_type === "text"
        ).length,
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
      // Note: Text messages use channel 'sms' or 'imessage', not 'text'
      const emails = communications.filter((c) => c.communication_type === "email");
      const texts = communications.filter((c) =>
        c.communication_type === "sms" ||
        c.communication_type === "imessage" ||
        c.communication_type === "text"  // Legacy fallback
      );

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

        // Include both email and text attachments
        const allCommunications = [...emails, ...texts];
        await this.exportAttachments(transaction, allCommunications, attachmentsPath);

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
    const texts = communications.filter((c) =>
      c.communication_type === "sms" ||
      c.communication_type === "imessage" ||
      c.communication_type === "text"  // Legacy fallback
    );

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
   * Export text conversations as individual PDF files (one per thread)
   */
  private async exportTextConversations(
    texts: Communication[],
    outputPath: string
  ): Promise<void> {
    // Look up contact names for phone numbers
    const textPhones = texts
      .map((t) => t.sender)
      .filter(
        (s): s is string =>
          !!s && (s.startsWith("+") || /^\d{7,}$/.test(s.replace(/\D/g, "")))
      );
    const phoneNameMap = this.getContactNamesByPhones(textPhones);

    // Group texts by thread
    const textThreads = new Map<string, Communication[]>();
    for (const msg of texts) {
      const key = this.getThreadKey(msg);
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
      const contact = this.getThreadContact(msgs, phoneNameMap);
      const isGroupChat = this._isGroupChat(msgs);
      const html = this.generateTextThreadHTML(
        msgs,
        contact,
        phoneNameMap,
        isGroupChat
      );
      const pdfBuffer = await this.htmlToPdf(html);

      // Get date from first message
      const firstMsgDate = msgs[0].sent_at || msgs[0].received_at;
      const firstDate = firstMsgDate
        ? new Date(firstMsgDate as string).toISOString().split("T")[0]
        : "unknown";
      const contactName = this.sanitizeFileName(contact.name || contact.phone);
      const fileName = `thread_${String(threadIndex + 1).padStart(3, "0")}_${contactName}_${firstDate}.pdf`;

      await fs.writeFile(path.join(outputPath, fileName), pdfBuffer);
      threadIndex++;
    }
  }

  /**
   * Normalize phone number to last 10 digits for matching
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "").slice(-10);
  }

  /**
   * Get thread key for grouping messages (uses thread_id if available)
   */
  private getThreadKey(msg: Communication): string {
    // Use thread_id if available
    if (msg.thread_id) return msg.thread_id;

    // Fallback: compute from participants
    try {
      if (msg.participants) {
        const parsed =
          typeof msg.participants === "string"
            ? JSON.parse(msg.participants)
            : msg.participants;

        const allParticipants = new Set<string>();
        if (parsed.from) allParticipants.add(this.normalizePhone(parsed.from));
        if (parsed.to) {
          const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
          toList.forEach((p: string) =>
            allParticipants.add(this.normalizePhone(p))
          );
        }

        if (allParticipants.size > 0) {
          return (
            "participants-" + Array.from(allParticipants).sort().join("-")
          );
        }
      }
    } catch {
      // Fall through
    }

    // Last resort: use message id
    return "msg-" + msg.id;
  }

  /**
   * Extract phone/contact name from thread
   */
  private getThreadContact(
    msgs: Communication[],
    phoneNameMap: Record<string, string>
  ): { phone: string; name: string | null } {
    for (const msg of msgs) {
      try {
        if (msg.participants) {
          const parsed =
            typeof msg.participants === "string"
              ? JSON.parse(msg.participants)
              : msg.participants;

          let phone: string | null = null;
          if (msg.direction === "inbound" && parsed.from) {
            phone = parsed.from;
          } else if (msg.direction === "outbound" && parsed.to?.length > 0) {
            phone = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
          }

          if (phone) {
            const normalized = this.normalizePhone(phone);
            const name =
              phoneNameMap[normalized] || phoneNameMap[phone] || null;
            return { phone, name };
          }
        }
      } catch {
        // Continue
      }

      // Fallback to sender
      if (msg.sender) {
        const normalized = this.normalizePhone(msg.sender);
        const name =
          phoneNameMap[normalized] || phoneNameMap[msg.sender] || null;
        return { phone: msg.sender, name };
      }
    }
    return { phone: "Unknown", name: null };
  }

  /**
   * Check if a thread is a group chat (has multiple unique participants)
   */
  private _isGroupChat(msgs: Communication[]): boolean {
    const participants = new Set<string>();

    for (const msg of msgs) {
      try {
        if (msg.participants) {
          const parsed =
            typeof msg.participants === "string"
              ? JSON.parse(msg.participants)
              : msg.participants;

          if (parsed.from)
            participants.add(parsed.from.replace(/\D/g, "").slice(-10));
          if (parsed.to) {
            const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
            toList.forEach((p: string) =>
              participants.add(p.replace(/\D/g, "").slice(-10))
            );
          }
        }
      } catch {
        // Continue
      }
    }

    // Group chat if more than 2 participants
    return participants.size > 2;
  }

  /**
   * Look up contact names for phone numbers
   */
  private getContactNamesByPhones(phones: string[]): Record<string, string> {
    if (phones.length === 0) return {};

    try {
      // Normalize phones to last 10 digits for matching
      const normalizedPhones = phones.map((p) =>
        p.replace(/\D/g, "").slice(-10)
      );

      // Query contact_phones to find names
      const placeholders = normalizedPhones.map(() => "?").join(",");
      const sql = `
        SELECT
          cp.phone_e164,
          cp.phone_display,
          c.display_name
        FROM contact_phones cp
        JOIN contacts c ON cp.contact_id = c.id
        WHERE substr(replace(replace(replace(cp.phone_e164, '+', ''), '-', ''), ' ', ''), -10) IN (${placeholders})
           OR substr(replace(replace(replace(cp.phone_display, '+', ''), '-', ''), ' ', ''), -10) IN (${placeholders})
      `;

      const db = databaseService.getRawDatabase();
      const rows = db.prepare(sql).all(...normalizedPhones, ...normalizedPhones) as {
        phone_e164: string | null;
        phone_display: string | null;
        display_name: string | null;
      }[];

      const result: Record<string, string> = {};
      for (const row of rows) {
        if (row.display_name) {
          if (row.phone_e164) {
            const norm = row.phone_e164.replace(/\D/g, "").slice(-10);
            result[norm] = row.display_name;
            result[row.phone_e164] = row.display_name;
          }
          if (row.phone_display) {
            const norm = row.phone_display.replace(/\D/g, "").slice(-10);
            result[norm] = row.display_name;
            result[row.phone_display] = row.display_name;
          }
        }
      }

      return result;
    } catch (error) {
      logService.warn(
        "[Folder Export] Failed to look up contact names",
        "FolderExport",
        { error }
      );
      return {};
    }
  }

  /**
   * Generate HTML for a single text conversation thread (styled like PDF export)
   */
  private generateTextThreadHTML(
    msgs: Communication[],
    contact: { phone: string; name: string | null },
    phoneNameMap: Record<string, string>,
    isGroupChat: boolean
  ): string {
    const messagesHtml = msgs
      .map((msg) =>
        this.generateTextMessageHTML(msg, contact, phoneNameMap, isGroupChat)
      )
      .join("");

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
    .header h1 { font-size: 20px; color: #1a202c; margin-bottom: 8px; }
    .header .meta { font-size: 13px; color: #718096; }
    .message {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .message:last-child { border-bottom: none; }
    .message .sender { font-weight: 600; color: #2d3748; }
    .message .time { font-size: 11px; color: #718096; margin-left: 8px; }
    .message .phone { font-size: 11px; color: #718096; display: block; margin-bottom: 4px; }
    .message .body { margin-top: 4px; line-height: 1.5; }
    .attachment-image {
      margin-top: 8px;
    }
    .attachment-image img {
      max-width: 200px;
      max-height: 200px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .attachment-ref {
      margin-top: 8px;
      padding: 8px 12px;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 12px;
      color: #4a5568;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      background: #e2e8f0;
      border-radius: 4px;
      font-size: 11px;
      color: #718096;
      margin-left: 8px;
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
    <h1>Conversation with ${this.escapeHtml(contact.name || contact.phone)}${isGroupChat ? '<span class="badge">Group Chat</span>' : ""}</h1>
    <div class="meta">${contact.name ? this.escapeHtml(contact.phone) + " | " : ""}${msgs.length} message${msgs.length === 1 ? "" : "s"}</div>
  </div>

  ${messagesHtml}

  <div class="footer">
    <p>Exported from MagicAudit</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate HTML for a single text message within a thread
   * Includes inline images for attachments
   */
  private generateTextMessageHTML(
    msg: Communication,
    contact: { phone: string; name: string | null },
    phoneNameMap: Record<string, string>,
    isGroupChat: boolean
  ): string {
    const isOutbound = msg.direction === "outbound";
    let senderName = "You";
    let senderPhone: string | null = null;

    if (!isOutbound) {
      if (isGroupChat && msg.sender) {
        const normalized = this.normalizePhone(msg.sender);
        const resolvedName =
          phoneNameMap[normalized] || phoneNameMap[msg.sender];
        senderName = resolvedName || msg.sender;
        if (resolvedName) senderPhone = msg.sender;
      } else {
        senderName = contact.name || contact.phone;
        if (contact.name) senderPhone = contact.phone;
      }
    }

    const msgDate = msg.sent_at || msg.received_at;
    const time = msgDate
      ? new Date(msgDate as string).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    // Get attachments for this message
    // Check both message_id and id since text messages may link differently
    const messageId = msg.message_id || msg.id;
    const attachments = messageId ? this.getAttachmentsForMessage(messageId) : [];

    // Generate attachment HTML
    let attachmentHtml = "";
    for (const att of attachments) {
      if (att.mime_type?.startsWith("image/") && att.storage_path) {
        // Try to embed image as base64 for PDF
        try {
          if (fsSync.existsSync(att.storage_path)) {
            const imageData = fsSync.readFileSync(att.storage_path);
            const base64 = imageData.toString("base64");
            attachmentHtml += `<div class="attachment-image"><img src="data:${att.mime_type};base64,${base64}" alt="${this.escapeHtml(att.filename)}" /></div>`;
          } else {
            // Image file not found - show placeholder
            attachmentHtml += `<div class="attachment-ref">[Image: ${this.escapeHtml(att.filename)} - file not found]</div>`;
          }
        } catch (error) {
          // Failed to read image - show placeholder
          logService.warn("[Folder Export] Failed to embed image in PDF", "FolderExport", {
            filename: att.filename,
            error,
          });
          attachmentHtml += `<div class="attachment-ref">[Image: ${this.escapeHtml(att.filename)}]</div>`;
        }
      } else {
        // Non-image attachment - show reference
        attachmentHtml += `<div class="attachment-ref">[Attachment: ${this.escapeHtml(att.filename)}]</div>`;
      }
    }

    return `
    <div class="message">
      <span class="sender">${this.escapeHtml(senderName)}</span>
      <span class="time">${time}</span>
      ${senderPhone ? `<span class="phone">${this.escapeHtml(senderPhone)}</span>` : ""}
      <div class="body">${this.escapeHtml(msg.body_text || msg.body_plain || "")}</div>
      ${attachmentHtml}
    </div>
    `;
  }

  /**
   * Export attachments and create manifest
   * Queries the attachments table by message_id and copies actual files to output folder
   */
  private async exportAttachments(
    transaction: Transaction,
    communications: Communication[],
    outputPath: string
  ): Promise<void> {
    const manifest: AttachmentManifest = {
      transactionId: transaction.id,
      propertyAddress: transaction.property_address,
      exportDate: new Date().toISOString(),
      attachments: [],
    };

    // Get message IDs for the linked communications
    // For emails, use message_id; for texts, also check the communication id
    const messageIds = communications
      .filter((comm) => comm.message_id || comm.id)
      .map((comm) => comm.message_id || comm.id) as string[];

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

    // Build maps for quick lookup
    // We need to track both message_id and communication id for text messages
    const messageIdToCommIndex = new Map<string, number>();
    const messageIdToComm = new Map<string, Communication>();
    communications.forEach((comm, index) => {
      // Map by message_id if available
      if (comm.message_id) {
        messageIdToCommIndex.set(comm.message_id, index + 1);
        messageIdToComm.set(comm.message_id, comm);
      }
      // Also map by communication id (for text messages that link by id)
      if (comm.id) {
        messageIdToCommIndex.set(comm.id, index + 1);
        messageIdToComm.set(comm.id, comm);
      }
    });

    // Helper to determine message type
    const getMessageType = (comm: Communication): "email" | "text" => {
      const type = comm.communication_type;
      if (type === "sms" || type === "imessage" || type === "text") {
        return "text";
      }
      return "email";
    };

    // Helper to get message preview (first 100 chars)
    const getMessagePreview = (comm: Communication): string => {
      const body = comm.body_text || comm.body_plain || "";
      return body.slice(0, 100);
    };

    // Helper to get original message description
    const getOriginalMessage = (comm: Communication): string => {
      const type = getMessageType(comm);
      if (type === "email") {
        return comm.subject || "(No Subject)";
      }
      // For texts, show sender/recipient and preview
      const preview = getMessagePreview(comm);
      const participant = comm.sender || "Unknown";
      return preview ? `${participant}: ${preview.slice(0, 50)}...` : participant;
    };

    // Track used filenames to avoid collisions
    const usedFilenames = new Set<string>();

    for (const att of attachmentRows) {
      const comm = messageIdToComm.get(att.message_id);
      const commIndex = messageIdToCommIndex.get(att.message_id);
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

      // Determine message type and preview
      const messageType = comm ? getMessageType(comm) : "email";
      const messagePreview = comm ? getMessagePreview(comm) : undefined;

      // Handle missing storage_path
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
        // Check if source file exists
        if (await this.fileExists(att.storage_path)) {
          // Copy the file to the output folder
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
          // File not found at storage path
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
   * Uses a temp file instead of data URL to avoid URL length limits with large base64 images
   */
  private async htmlToPdf(html: string): Promise<Buffer> {
    // Write HTML to temp file to avoid data URL length limits
    const tempDir = app.getPath("temp");
    const tempFile = path.join(tempDir, `export-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    await fs.writeFile(tempFile, html, "utf8");

    try {
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

      // Load HTML from temp file
      await this.exportWindow.loadFile(tempFile);

      // Wait for page to render (including images)
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
    } finally {
      // Clean up temp file
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
    const folderName = this.sanitizeFileName(
      `Transaction_${transaction.property_address}_${Date.now()}`
    );
    return path.join(downloadsPath, folderName);
  }

  /**
   * Get attachments for a specific message
   * Used for embedding images inline in text thread PDFs
   */
  private getAttachmentsForMessage(messageId: string): {
    id: string;
    filename: string;
    mime_type: string | null;
    storage_path: string | null;
    file_size_bytes: number | null;
  }[] {
    try {
      const db = databaseService.getRawDatabase();
      const sql = `
        SELECT id, filename, mime_type, storage_path, file_size_bytes
        FROM attachments
        WHERE message_id = ?
      `;
      return db.prepare(sql).all(messageId) as {
        id: string;
        filename: string;
        mime_type: string | null;
        storage_path: string | null;
        file_size_bytes: number | null;
      }[];
    } catch (error) {
      logService.warn("[Folder Export] Failed to get attachments for message", "FolderExport", {
        messageId,
        error,
      });
      return [];
    }
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
