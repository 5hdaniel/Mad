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
import { PDFDocument } from "pdf-lib";
import logService from "./logService";
import databaseService from "./databaseService";
import { getContactNames } from "./contactsService";
import { getUserById } from "./db/userDbService";
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

      // Pre-load contact names for all phone numbers (from both imported contacts and macOS Contacts)
      const allPhones = this.extractAllPhones(texts);
      const phoneNameMap = await this.getContactNamesByPhonesAsync(allPhones);

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
    basePath: string,
    phoneNameMap?: Record<string, string>
  ): Promise<void> {
    const html = this.generateSummaryHTML(transaction, communications, phoneNameMap);
    const pdfBuffer = await this.htmlToPdf(html);
    await fs.writeFile(path.join(basePath, "Summary_Report.pdf"), pdfBuffer);
  }

  /**
   * Generate HTML for summary report
   */
  private generateSummaryHTML(
    transaction: Transaction,
    communications: Communication[],
    phoneNameMap?: Record<string, string>
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
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    .email-item:last-child { border-bottom: none; }
    .email-item .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .email-item .index { color: #718096; width: 40px; }
    .email-item .subject { flex: 1; font-weight: 500; color: #2d3748; }
    .email-item .date { color: #718096; width: 120px; text-align: right; }
    .email-item .from { color: #4a5568; font-size: 12px; margin-top: 4px; margin-left: 40px; }
    .text-item {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    .text-item:last-child { border-bottom: none; }
    .text-item .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .text-item .index { color: #718096; width: 40px; }
    .text-item .contact { flex: 1; font-weight: 500; color: #2d3748; }
    .text-item .date { color: #718096; width: 120px; text-align: right; }
    .text-item .preview { color: #4a5568; font-size: 12px; margin-top: 4px; margin-left: 40px; }
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
      <div class="value">${formatDate(transaction.closed_at)}</div>
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

  ${emails.length > 0 ? `
  <div class="section">
    <h3>Email Threads Index (${emails.length})</h3>
    <div class="email-list">
      ${sortedEmails
        .map((email, index) => {
          return `
        <div class="email-item">
          <div class="header-row">
            <span class="index">${String(index + 1).padStart(3, "0")}</span>
            <span class="subject">${this.escapeHtml(email.subject || "(No Subject)")}</span>
          </div>
          <div class="from">${this.escapeHtml(email.sender || "Unknown")}</div>
        </div>
      `;
        })
        .join("")}
    </div>
    <div class="note">
      Full email content is available in the /emails folder as individual PDF files.
    </div>
  </div>
  ` : ""}

  ${texts.length > 0 ? `
  <div class="section">
    <h3>Text Threads Index (${this.countTextThreads(texts)})</h3>
    <div class="email-list">
      ${this.generateTextIndex(texts, phoneNameMap)}
    </div>
    <div class="note">
      Full text conversations are available in the /texts folder as individual PDF files.
    </div>
  </div>
  ` : ""}

  <div class="footer">
    <p>This report was automatically generated by MagicAudit</p>
    <p>Transaction ID: ${transaction.id}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Count unique text threads for the summary index
   */
  private countTextThreads(texts: Communication[]): number {
    const threads = new Set<string>();
    for (const msg of texts) {
      threads.add(this.getThreadKey(msg));
    }
    return threads.size;
  }

  /**
   * Generate HTML for text conversations index in summary
   */
  private generateTextIndex(texts: Communication[], phoneNameMap?: Record<string, string>): string {
    // Use provided phoneNameMap or fall back to sync lookup
    const nameMap = phoneNameMap || this.getContactNamesByPhones(this.extractAllPhones(texts));

    // Group by thread
    const textThreads = new Map<string, Communication[]>();
    for (const msg of texts) {
      const key = this.getThreadKey(msg);
      const thread = textThreads.get(key) || [];
      thread.push(msg);
      textThreads.set(key, thread);
    }

    // Sort threads by most recent message
    const sortedThreads = Array.from(textThreads.entries())
      .map(([_, msgs]) => {
        msgs.sort((a, b) => {
          const dateA = new Date(a.sent_at || a.received_at || 0).getTime();
          const dateB = new Date(b.sent_at || b.received_at || 0).getTime();
          return dateA - dateB;
        });
        return msgs;
      })
      .sort((a, b) => {
        const lastA = a[a.length - 1];
        const lastB = b[b.length - 1];
        const dateA = new Date(lastA.sent_at || lastA.received_at || 0).getTime();
        const dateB = new Date(lastB.sent_at || lastB.received_at || 0).getTime();
        return dateA - dateB; // Oldest first for indexing
      });

    return sortedThreads
      .map((msgs, index) => {
        const contact = this.getThreadContact(msgs, nameMap);
        const isGroupChat = this._isGroupChat(msgs);
        // Use better display name for unknown contacts
        let displayName: string;
        if (!contact.name && contact.phone.toLowerCase() === "unknown") {
          displayName = isGroupChat ? "Group Chat" : "Unknown Contact";
        } else {
          displayName = contact.name || contact.phone;
        }

        return `
          <div class="text-item">
            <div class="header-row">
              <span class="index">${String(index + 1).padStart(3, "0")}</span>
              <span class="contact">${this.escapeHtml(displayName)} (${msgs.length} msg${msgs.length === 1 ? "" : "s"})</span>
            </div>
          </div>
        `;
      })
      .join("");
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

    const fileName = `email_${paddedIndex}_${dateStr}_${subject}.pdf`;
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
    outputPath: string,
    phoneNameMap?: Record<string, string>,
    userName?: string,
    userEmail?: string
  ): Promise<void> {
    // Use provided phoneNameMap or fall back to sync lookup
    const nameMap = phoneNameMap || this.getContactNamesByPhones(this.extractAllPhones(texts));

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
      const contact = this.getThreadContact(msgs, nameMap);
      const isGroupChat = this._isGroupChat(msgs);
      const participants = isGroupChat ? this.getGroupChatParticipants(msgs, nameMap, userName, userEmail) : undefined;
      const html = this.generateTextThreadHTML(
        msgs,
        contact,
        nameMap,
        isGroupChat,
        threadIndex,
        participants
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
        displayName = isGroupChat ? "Group_Chat" : "Unknown_Contact";
      } else {
        displayName = contact.name || contact.phone;
      }
      const contactName = this.sanitizeFileName(displayName);
      const fileName = `text_${String(threadIndex + 1).padStart(3, "0")}_${contactName}_${firstDate}.pdf`;

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
   * Extract all unique phone numbers from communications
   * Includes both sender field and all participants (from/to) from JSON
   */
  private extractAllPhones(communications: Communication[]): string[] {
    const phones = new Set<string>();

    for (const comm of communications) {
      // Add sender if it's a phone number
      if (comm.sender && (comm.sender.startsWith("+") || /^\d{7,}$/.test(comm.sender.replace(/\D/g, "")))) {
        phones.add(comm.sender);
      }

      // Parse participants JSON to get all phone numbers
      if (comm.participants) {
        try {
          const parsed = typeof comm.participants === "string"
            ? JSON.parse(comm.participants)
            : comm.participants;

          if (parsed.from && (parsed.from.startsWith("+") || /^\d{7,}$/.test(parsed.from.replace(/\D/g, "")))) {
            phones.add(parsed.from);
          }

          if (parsed.to) {
            const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
            for (const p of toList) {
              if (p && (p.startsWith("+") || /^\d{7,}$/.test(p.replace(/\D/g, "")))) {
                phones.add(p);
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return Array.from(phones);
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
   * Uses chat_members (authoritative) when available, falls back to from/to parsing
   */
  private _isGroupChat(msgs: Communication[]): boolean {
    // First check for chat_members (authoritative source)
    for (const msg of msgs) {
      try {
        if (msg.participants) {
          const parsed =
            typeof msg.participants === "string"
              ? JSON.parse(msg.participants)
              : msg.participants;

          // chat_members is the authoritative list from Apple's chat_handle_join
          if (parsed.chat_members && Array.isArray(parsed.chat_members)) {
            // chat_members doesn't include "me", so 2+ members means group chat (3+ total with user)
            return parsed.chat_members.length >= 2;
          }
        }
      } catch {
        // Continue
      }
    }

    // Fallback: extract from from/to (less reliable)
    const participants = new Set<string>();
    for (const msg of msgs) {
      try {
        if (msg.participants) {
          const parsed =
            typeof msg.participants === "string"
              ? JSON.parse(msg.participants)
              : msg.participants;

          if (parsed.from) {
            const normalized = parsed.from.replace(/\D/g, "").slice(-10);
            // Skip "unknown" ghost participants
            if (normalized && parsed.from.toLowerCase() !== "unknown") {
              participants.add(normalized);
            }
          }
          if (parsed.to) {
            const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
            toList.forEach((p: string) => {
              const normalized = p.replace(/\D/g, "").slice(-10);
              // Skip "unknown" ghost participants
              if (normalized && p.toLowerCase() !== "unknown") {
                participants.add(normalized);
              }
            });
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
   * Get all participants in a group chat with their names and phone numbers
   * Uses chat_members (from Apple's chat_handle_join table) as the authoritative source
   * Falls back to from/to extraction only if chat_members unavailable
   */
  private getGroupChatParticipants(
    msgs: Communication[],
    phoneNameMap: Record<string, string>,
    userName?: string,
    userEmail?: string
  ): Array<{ phone: string; name: string | null }> {
    const participantPhones = new Set<string>();
    let hasChatMembers = false;
    let userIdentifier: string | null = null;

    // First pass: look for chat_members (authoritative source from Apple's chat_handle_join)
    // Also extract the user's identifier from outbound messages
    for (const msg of msgs) {
      try {
        if (msg.participants) {
          const parsed =
            typeof msg.participants === "string"
              ? JSON.parse(msg.participants)
              : msg.participants;

          // Use chat_members as authoritative source if available
          if (!hasChatMembers && parsed.chat_members && Array.isArray(parsed.chat_members) && parsed.chat_members.length > 0) {
            hasChatMembers = true;
            parsed.chat_members.forEach((member: string) => participantPhones.add(member));
          }

          // Extract user's identifier from outbound messages (from field when direction is outbound)
          // The from field now contains the actual identifier (email or phone) instead of "me"
          if (!userIdentifier && msg.direction === "outbound" && parsed.from) {
            userIdentifier = parsed.from;
          }
        }
      } catch {
        // Continue
      }
    }

    // Add user's identifier (or fallback to "me" for old data)
    if (hasChatMembers) {
      participantPhones.add(userIdentifier || "me");
    }

    // Fallback: if no chat_members, extract from from/to (less reliable)
    if (!hasChatMembers) {
      for (const msg of msgs) {
        try {
          if (msg.participants) {
            const parsed =
              typeof msg.participants === "string"
                ? JSON.parse(msg.participants)
                : msg.participants;

            if (parsed.from) {
              participantPhones.add(parsed.from);
            }
            if (parsed.to) {
              const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
              toList.forEach((p: string) => participantPhones.add(p));
            }
          }
        } catch {
          // Continue
        }
      }
    }

    // Convert to array with names, handling special cases
    return Array.from(participantPhones)
      .filter((phone) => {
        // Filter out empty/null values
        if (!phone || phone.trim() === "") return false;
        // Filter out "unknown" - ghost participants from NULL handles (only relevant in fallback path)
        if (phone.toLowerCase().trim() === "unknown") return false;
        return true;
      })
      .map((phone) => {
        const lowerPhone = phone.toLowerCase().trim();

        // Handle "me" - this is the user
        if (lowerPhone === "me") {
          return { phone: "", name: userName || "You" };
        }

        // Check if it's a valid phone number (has digits)
        const isPhone = /\d{7,}/.test(phone.replace(/\D/g, ""));

        if (isPhone) {
          const normalized = this.normalizePhone(phone);
          const name = phoneNameMap[normalized] || phoneNameMap[phone] || null;
          return { phone, name };
        }

        // If it's not "me" or a phone number, it might be an Apple ID/email (like "magicauditwa")
        // Check if it matches the user's email identifier - if so, show their name
        if (userName && userEmail) {
          const emailPrefix = userEmail.split("@")[0].toLowerCase();
          // Check if this identifier matches the user's email or email prefix
          if (lowerPhone === userEmail.toLowerCase() ||
              lowerPhone === emailPrefix ||
              lowerPhone.includes(emailPrefix)) {
            // This is the user's iMessage identifier
            return { phone, name: userName };
          }
        }

        // Try to look it up in contacts, otherwise use it as the display name
        const name = phoneNameMap[phone] || null;
        return { phone, name: name || phone };
      });
  }

  /**
   * Look up contact names for phone numbers from multiple sources:
   * 1. App's imported contacts (contact_phones table)
   * 2. macOS Contacts database (AddressBook)
   */
  private getContactNamesByPhones(phones: string[]): Record<string, string> {
    if (phones.length === 0) return {};

    const result: Record<string, string> = {};

    // Source 1: App's imported contacts
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
    } catch (error) {
      logService.warn(
        "[Folder Export] Failed to look up contact names from imported contacts",
        "FolderExport",
        { error }
      );
    }

    return result;
  }

  /**
   * Async version that also checks macOS Contacts database
   * Call this once at the start of export and pass the result to other methods
   */
  private async getContactNamesByPhonesAsync(phones: string[]): Promise<Record<string, string>> {
    if (phones.length === 0) return {};

    // Start with synchronous lookup from imported contacts
    const result = this.getContactNamesByPhones(phones);

    // Source 2: macOS Contacts database (AddressBook)
    try {
      const { contactMap } = await getContactNames();

      // Add any names from macOS Contacts that we don't already have
      for (const phone of phones) {
        const normalized = this.normalizePhone(phone);
        const digitsOnly = phone.replace(/\D/g, "");

        // Skip if we already have a name for this phone
        if (result[normalized] || result[phone]) continue;

        // Try to find in macOS contacts
        // contactMap keys might be formatted differently, try multiple formats
        const possibleKeys = [
          phone,                          // +14082104874
          normalized,                     // 4082104874 (last 10 digits)
          digitsOnly,                     // 14082104874 (all digits)
          `+1${normalized}`,              // +14082104874
          `1${normalized}`,               // 14082104874
          normalized.slice(-10),          // 4082104874
          digitsOnly.slice(-10),          // 4082104874
          digitsOnly.slice(-11),          // 14082104874 (with country code)
        ];

        for (const key of possibleKeys) {
          if (key && contactMap[key]) {
            result[normalized] = contactMap[key];
            result[phone] = contactMap[key];
            logService.debug("[Folder Export] Found contact in macOS Contacts", "FolderExport", {
              phone,
              matchedKey: key,
              name: contactMap[key],
            });
            break;
          }
        }
      }
    } catch (error) {
      logService.warn(
        "[Folder Export] Failed to look up contact names from macOS Contacts",
        "FolderExport",
        { error }
      );
    }

    return result;
  }

  /**
   * Generate HTML for a single text conversation thread (styled like PDF export)
   */
  private generateTextThreadHTML(
    msgs: Communication[],
    contact: { phone: string; name: string | null },
    phoneNameMap: Record<string, string>,
    isGroupChat: boolean,
    threadIndex: number,
    participants?: Array<{ phone: string; name: string | null }>
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
      padding: 12px;
      border-radius: 12px;
      max-width: 80%;
      background: #f1f1f1;
    }
    .message.outbound {
      margin-left: auto;
      background: #007aff;
      color: white;
    }
    .message.outbound .sender { color: rgba(255,255,255,0.9); }
    .message.outbound .time { color: rgba(255,255,255,0.7); }
    .message.outbound .phone { color: rgba(255,255,255,0.7); }
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
    <h1>${(() => {
      const threadId = String(threadIndex + 1).padStart(3, "0");
      if (!contact.name && contact.phone.toLowerCase() === "unknown") {
        return isGroupChat ? `Group Chat <span class="badge">#${threadId}</span>` : `Unknown Contact <span class="badge">#${threadId}</span>`;
      }
      return `Conversation with ${this.escapeHtml(contact.name || contact.phone)} <span class="badge">#${threadId}</span>${isGroupChat ? '<span class="badge">Group Chat</span>' : ""}`;
    })()}</h1>
    <div class="meta">${contact.name ? this.escapeHtml(contact.phone) + " | " : ""}${msgs.length} message${msgs.length === 1 ? "" : "s"}</div>
    ${isGroupChat && participants && participants.length > 0 ? `
    <div class="participants" style="margin-top: 12px; padding: 12px; background: #f7fafc; border-radius: 8px; font-size: 13px;">
      <div style="font-weight: 600; margin-bottom: 8px; color: #4a5568;">Participants (${participants.length}):</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
        ${participants.map(p => `
          <div style="padding: 4px 0;">
            <span style="color: #2d3748;">${this.escapeHtml(p.name || p.phone || "Unknown")}</span>
            ${p.phone && p.name ? `<span style="color: #718096; font-size: 12px; display: block;">${this.escapeHtml(p.phone)}</span>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
    ` : ""}
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
        // Use file:// URL to reference image directly (more efficient than base64)
        try {
          if (fsSync.existsSync(att.storage_path)) {
            // Use file:// URL - works because we load HTML from temp file
            const fileUrl = `file://${att.storage_path}`;
            attachmentHtml += `<div class="attachment-image"><img src="${fileUrl}" alt="${this.escapeHtml(att.filename)}" /></div>`;
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

    // Determine body content - show attachment indicator for attachment-only messages
    const bodyText = msg.body_text || msg.body_plain || "";
    const hasBody = bodyText.trim().length > 0;
    const bodyContent = hasBody
      ? this.escapeHtml(bodyText)
      : (attachments.length > 0 ? "" : ""); // Empty if no text and no attachments

    return `
    <div class="message${isOutbound ? " outbound" : ""}">
      <span class="sender">${this.escapeHtml(senderName)}</span>
      <span class="time">${time}</span>
      ${senderPhone ? `<span class="phone">${this.escapeHtml(senderPhone)}</span>` : ""}
      ${bodyContent ? `<div class="body">${bodyContent}</div>` : ""}
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
   * Uses a temp file to allow file:// URLs for images (more efficient than base64 embedding)
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
   *
   * Includes external_message_id fallback for when message_id is stale after re-import
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

      // First try direct message_id lookup
      const sql = `
        SELECT id, filename, mime_type, storage_path, file_size_bytes
        FROM attachments
        WHERE message_id = ?
      `;
      let rows = db.prepare(sql).all(messageId) as {
        id: string;
        filename: string;
        mime_type: string | null;
        storage_path: string | null;
        file_size_bytes: number | null;
      }[];

      // If no results, try external_message_id fallback
      // After re-import, message IDs change but external_message_id (macOS GUID) is stable
      if (rows.length === 0) {
        // Get the message's external_id (macOS GUID)
        const messageRow = db.prepare(
          `SELECT external_id FROM messages WHERE id = ?`
        ).get(messageId) as { external_id: string | null } | undefined;

        if (messageRow?.external_id) {
          rows = db.prepare(`
            SELECT id, filename, mime_type, storage_path, file_size_bytes
            FROM attachments
            WHERE external_message_id = ?
          `).all(messageRow.external_id) as typeof rows;

          // If found via fallback, update the stale message_id for future queries
          if (rows.length > 0) {
            logService.debug(
              `[Folder Export] Found ${rows.length} attachments via external_message_id fallback`,
              "FolderExport",
              { messageId, externalId: messageRow.external_id }
            );
            const updateStmt = db.prepare(
              `UPDATE attachments SET message_id = ? WHERE external_message_id = ?`
            );
            updateStmt.run(messageId, messageRow.external_id);
          }
        }
      }

      return rows;
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

  /**
   * Export transaction to a single combined PDF
   * Uses folder export logic to generate individual PDFs, then combines them
   * This provides consistent output with the audit package but in a single file
   */
  async exportTransactionToCombinedPDF(
    transaction: Transaction,
    communications: Communication[],
    outputPath: string
  ): Promise<string> {
    // Create temp folder for individual PDFs
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

      // Separate emails and texts
      const emails = communications.filter((c) => c.communication_type === "email");
      const texts = communications.filter((c) =>
        c.communication_type === "sms" ||
        c.communication_type === "imessage" ||
        c.communication_type === "text"
      );

      // Sort by date (oldest first for consistent ordering)
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

      // Pre-load contact names for all phone numbers (from both imported contacts and macOS Contacts)
      const allPhones = this.extractAllPhones(texts);
      const phoneNameMap = await this.getContactNamesByPhonesAsync(allPhones);

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
      await this.generateSummaryPDF(transaction, communications, tempFolder, phoneNameMap);

      // Generate individual email PDFs
      for (let i = 0; i < emails.length; i++) {
        await this.exportEmailToPDF(emails[i], i + 1, emailsPath);
      }

      // Generate text conversation PDFs
      if (texts.length > 0) {
        await this.exportTextConversations(texts, textsPath, phoneNameMap, userName, userEmail);
      }

      // Collect all PDF files in order: Summary, then emails, then texts
      const pdfFiles: string[] = [];

      // Add summary
      const summaryPath = path.join(tempFolder, "Summary_Report.pdf");
      if (await this.fileExists(summaryPath)) {
        pdfFiles.push(summaryPath);
      }

      // Add emails (sorted by filename which includes index)
      const emailFiles = await fs.readdir(emailsPath);
      const sortedEmailFiles = emailFiles.filter(f => f.endsWith(".pdf")).sort();
      for (const file of sortedEmailFiles) {
        pdfFiles.push(path.join(emailsPath, file));
      }

      // Add texts (sorted by filename which includes index)
      const textFiles = await fs.readdir(textsPath);
      const sortedTextFiles = textFiles.filter(f => f.endsWith(".pdf")).sort();
      for (const file of sortedTextFiles) {
        pdfFiles.push(path.join(textsPath, file));
      }

      // Combine all PDFs using pdf-lib
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

      // Save combined PDF
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
      // Clean up temp folder
      try {
        await fs.rm(tempFolder, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      // Clean up any lingering export window
      if (this.exportWindow) {
        this.exportWindow.close();
        this.exportWindow = null;
      }
    }
  }
}

export default new FolderExportService();
