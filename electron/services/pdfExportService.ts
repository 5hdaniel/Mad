import { BrowserWindow, app } from "electron";
import path from "path";
import fs from "fs/promises";
import { Transaction, Communication } from "../types/models";
import logService from "./logService";
import { dbAll } from "./db/core/dbConnection";

/**
 * Look up contact names for phone numbers
 */
function getContactNamesByPhones(phones: string[]): Record<string, string> {
  if (phones.length === 0) return {};

  try {
    // Normalize phones to last 10 digits for matching
    const normalizedPhones = phones.map(p => p.replace(/\D/g, '').slice(-10));

    // Query contact_phones to find names
    const placeholders = normalizedPhones.map(() => '?').join(',');
    const sql = `
      SELECT
        cp.phone_e164,
        cp.phone_display,
        c.display_name
      FROM contact_phones cp
      JOIN contacts c ON cp.contact_id = c.id
      WHERE SUBSTR(REPLACE(cp.phone_e164, '+', ''), -10) IN (${placeholders})
         OR SUBSTR(REPLACE(cp.phone_display, '-', ''), -10) IN (${placeholders})
    `;

    const results = dbAll<{ phone_e164: string; phone_display: string; display_name: string }>(
      sql,
      [...normalizedPhones, ...normalizedPhones]
    );

    const nameMap: Record<string, string> = {};
    for (const row of results) {
      // Map both original and normalized forms
      const e164Normalized = row.phone_e164.replace(/\D/g, '').slice(-10);
      const displayNormalized = row.phone_display.replace(/\D/g, '').slice(-10);
      nameMap[e164Normalized] = row.display_name;
      nameMap[displayNormalized] = row.display_name;
      nameMap[row.phone_e164] = row.display_name;
      nameMap[row.phone_display] = row.display_name;
    }

    return nameMap;
  } catch (error) {
    logService.warn("[PDF Export] Failed to look up contact names", "PDFExport", { error });
    return {};
  }
}

/**
 * Format phone number or resolve to contact name
 */
function formatSenderName(sender: string | null | undefined, nameMap: Record<string, string>): string {
  if (!sender) return "Unknown";

  // Check if it's a phone number (starts with + or contains mostly digits)
  const isPhone = sender.startsWith('+') || /^\d{10,}$/.test(sender.replace(/\D/g, ''));

  if (isPhone) {
    const normalized = sender.replace(/\D/g, '').slice(-10);
    const name = nameMap[normalized] || nameMap[sender];
    if (name) {
      return `${name} (${sender})`;
    }
  }

  return sender;
}

/**
 * PDF Export Service
 * Generates PDF reports for transactions using Electron's built-in PDF export
 * Uses HTML templates for beautiful, customizable reports
 */
class PDFExportService {
  private exportWindow: BrowserWindow | null;

  constructor() {
    this.exportWindow = null;
  }

  /**
   * Generate PDF for a transaction
   * @param transaction - Transaction object with all data
   * @param communications - Related emails
   * @param outputPath - Where to save the PDF
   * @returns Path to generated PDF
   */
  async generateTransactionPDF(
    transaction: Transaction,
    communications: Communication[],
    outputPath: string,
  ): Promise<string> {
    try {
      logService.info(
        "[PDF Export] Generating PDF for transaction:",
        "PDFExport",
        { transactionId: transaction.id },
      );

      // Create HTML content
      const html = this._generateHTML(transaction, communications);

      // Create hidden window for PDF generation
      this.exportWindow = new BrowserWindow({
        width: 800,
        height: 1200,
        show: false, // Hidden window
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      // Load HTML content
      await this.exportWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
      );

      // Wait for page to fully render
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate PDF
      const pdfData = await this.exportWindow.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        pageSize: "Letter",
      });

      // Save PDF
      await fs.writeFile(outputPath, pdfData);

      // Clean up
      this.exportWindow.close();
      this.exportWindow = null;

      logService.info("[PDF Export] PDF generated successfully:", "PDFExport", { outputPath });
      return outputPath;
    } catch (error) {
      logService.error("[PDF Export] Failed to generate PDF:", "PDFExport", { error });
      if (this.exportWindow) {
        this.exportWindow.close();
        this.exportWindow = null;
      }
      throw error;
    }
  }

  /**
   * Generate HTML for PDF
   * @private
   */
  private _generateHTML(
    transaction: Transaction,
    communications: Communication[],
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
      const date =
        typeof dateString === "string" ? new Date(dateString) : dateString;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const formatDateTime = (dateString: string | Date): string => {
      if (!dateString) return "N/A";
      const date =
        typeof dateString === "string" ? new Date(dateString) : dateString;
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      padding: 40px;
      color: #1a202c;
      background: white;
    }

    .header {
      border-bottom: 4px solid #667eea;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 28px;
      color: #1a202c;
      margin-bottom: 8px;
    }

    .header .address {
      font-size: 18px;
      color: #2d3748;
      margin-bottom: 4px;
    }

    .header .subtitle {
      font-size: 14px;
      color: #718096;
    }

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

    .detail-card .value {
      font-size: 18px;
      color: #1a202c;
      font-weight: 600;
    }

    .section {
      margin-bottom: 30px;
    }

    .section h3 {
      font-size: 18px;
      color: #2d3748;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }

    .communications {
      margin-top: 16px;
    }

    .communication {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 12px;
      background: white;
      page-break-inside: avoid;
    }

    .communication .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
      color: #718096;
    }

    .communication .subject {
      font-size: 14px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 8px;
    }

    .communication .from {
      font-size: 13px;
      color: #4a5568;
      margin-bottom: 4px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #a0aec0;
      text-align: center;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-purchase {
      background: #c6f6d5;
      color: #276749;
    }

    .badge-sale {
      background: #bee3f8;
      color: #2c5282;
    }

    .view-full-link {
      color: #667eea;
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
    }

    .view-full-link:hover {
      text-decoration: underline;
    }

    .appendix {
      margin-top: 60px;
      page-break-before: always;
    }

    .appendix h2 {
      font-size: 24px;
      color: #1a202c;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 4px solid #667eea;
    }

    .appendix-item {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
      background: white;
      page-break-inside: avoid;
      page-break-before: always;
    }

    .appendix-item .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    .appendix-item .msg-id {
      font-size: 11px;
      color: #a0aec0;
      background: #f7fafc;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .appendix-item .subject-line {
      font-size: 16px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 8px;
    }

    .appendix-item .meta-info {
      font-size: 13px;
      color: #4a5568;
      margin-bottom: 4px;
    }

    .appendix-item .message-body {
      margin-top: 16px;
      padding: 16px;
      background: #f7fafc;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.6;
      color: #2d3748;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Plain text message body (for SMS/texts) */
    .appendix-item .message-body-plain {
      white-space: pre-wrap;
    }

    /* Rich HTML email body styles */
    .appendix-item .message-body-html {
      /* White background for HTML emails so their own styling shows properly */
      background: white;
      border: 1px solid #e2e8f0;
    }

    .appendix-item .message-body-html img {
      max-width: 100%;
      height: auto;
    }

    .appendix-item .message-body-html table {
      max-width: 100%;
      border-collapse: collapse;
    }

    .appendix-item .message-body-html a {
      color: #667eea;
      text-decoration: underline;
    }

    .appendix-item .message-body-html blockquote {
      margin: 8px 0;
      padding-left: 12px;
      border-left: 3px solid #e2e8f0;
      color: #718096;
    }

    .appendix-item .message-body-html ul,
    .appendix-item .message-body-html ol {
      padding-left: 24px;
      margin: 8px 0;
    }

    .appendix-item .message-body-html p {
      margin: 8px 0;
    }

    .appendix-item .message-body-html h1,
    .appendix-item .message-body-html h2,
    .appendix-item .message-body-html h3,
    .appendix-item .message-body-html h4 {
      margin: 12px 0 8px 0;
      color: #2d3748;
    }

    .back-to-top {
      color: #667eea;
      text-decoration: underline;
      font-size: 12px;
      display: inline-block;
      margin-top: 12px;
    }

    @media print {
      body {
        padding: 20px;
      }
    }

    /* Page numbers */
    @page {
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10px;
        color: #718096;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>Transaction Audit Report</h1>
    <div class="address">${transaction.property_address || "N/A"}</div>
    <div class="subtitle">Generated on ${formatDateTime(new Date().toISOString())}</div>
  </div>

  <!-- Transaction Details -->
  <div class="details-grid">
    <div class="detail-card">
      <div class="label">Transaction Type</div>
      <div class="value">
        ${transaction.transaction_type ? `<span class="badge badge-${transaction.transaction_type}">${transaction.transaction_type === "purchase" ? "Purchase" : "Sale"}</span>` : "N/A"}
      </div>
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
      <div class="label">Earnest Money</div>
      <div class="value">${formatCurrency(transaction.earnest_money_amount)}</div>
    </div>

    <div class="detail-card">
      <div class="label">Total Communications</div>
      <div class="value">${transaction.total_communications_count || communications.length}</div>
    </div>
  </div>

  <!-- Communications -->
  ${this._generateCommunicationsHTML(communications, formatDateTime)}

  <!-- Footer -->
  <div class="footer">
    <p>This report was automatically generated by MagicAudit</p>
    <p>Transaction ID: ${transaction.id}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate communications HTML with hyperlinks to full content appendix
   * Groups text messages by thread/conversation like the UI does
   * @private
   */
  private _generateCommunicationsHTML(
    communications: Communication[],
    formatDateTime: (dateString: string | Date) => string
  ): string {
    // Split communications by type
    const emails = communications.filter(c =>
      c.communication_type === 'email' ||
      (!c.communication_type && c.subject && c.subject.length > 0)
    );
    const texts = communications.filter(c =>
      c.communication_type === 'sms' ||
      c.communication_type === 'imessage' ||
      c.communication_type === 'text' ||
      (!c.communication_type && (!c.subject || c.subject.length === 0))
    );

    // Look up contact names for text message phone numbers
    const textPhones = texts
      .map(t => t.sender)
      .filter((s): s is string => !!s && (s.startsWith('+') || /^\d{7,}$/.test(s.replace(/\D/g, ''))));
    const phoneNameMap = getContactNamesByPhones(textPhones);

    // Helper to escape HTML
    const escapeHtml = (str: string | null | undefined): string => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Helper to sanitize HTML for PDF display
    // Removes dangerous elements while preserving formatting
    const sanitizeHtml = (html: string | null | undefined): string => {
      if (!html) return '';

      let sanitized = html;

      // Remove script tags and their content
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

      // Remove style tags and their content (we use our own styles)
      sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

      // Remove all event handlers (onclick, onerror, onload, etc.)
      sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
      sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

      // Remove javascript: URLs
      sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
      sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');

      // Remove data: URLs (could contain malicious content)
      sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""');
      sanitized = sanitized.replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"');

      // Remove iframe, embed, object tags
      sanitized = sanitized.replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '');
      sanitized = sanitized.replace(/<iframe\b[^>]*\/?>/gi, '');
      sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, '');
      sanitized = sanitized.replace(/<object\b[^>]*>.*?<\/object>/gi, '');
      sanitized = sanitized.replace(/<object\b[^>]*\/?>/gi, '');

      // Remove form elements
      sanitized = sanitized.replace(/<form\b[^>]*>.*?<\/form>/gi, '');
      sanitized = sanitized.replace(/<input\b[^>]*\/?>/gi, '');
      sanitized = sanitized.replace(/<button\b[^>]*>.*?<\/button>/gi, '');
      sanitized = sanitized.replace(/<textarea\b[^>]*>.*?<\/textarea>/gi, '');

      // Remove meta, link, base tags
      sanitized = sanitized.replace(/<meta\b[^>]*\/?>/gi, '');
      sanitized = sanitized.replace(/<link\b[^>]*\/?>/gi, '');
      sanitized = sanitized.replace(/<base\b[^>]*\/?>/gi, '');

      // CRITICAL: Remove document-level tags that can affect the whole PDF
      // These tags from email HTML bleed styles into our document
      sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '');
      sanitized = sanitized.replace(/<\/?html\b[^>]*>/gi, '');
      sanitized = sanitized.replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '');
      sanitized = sanitized.replace(/<\/?body\b[^>]*>/gi, '');

      // Remove any background-color styles that could affect the page
      sanitized = sanitized.replace(/background(-color)?\s*:\s*[^;"}]+[;"]?/gi, '');

      return sanitized;
    };

    // Helper to truncate preview text
    const truncatePreview = (text: string | null | undefined, maxLen = 80): string => {
      if (!text) return '(No content)';
      const cleaned = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleaned.length <= maxLen) return escapeHtml(cleaned);
      return escapeHtml(cleaned.substring(0, maxLen)) + '...';
    };

    // Helper to normalize phone for matching
    const normalizePhone = (phone: string): string => {
      return phone.replace(/\D/g, '').slice(-10);
    };

    // Helper to get thread key (matches UI logic)
    const getThreadKey = (msg: Communication): string => {
      // Use thread_id if available
      if (msg.thread_id) return msg.thread_id;

      // Fallback: compute from participants
      try {
        if (msg.participants) {
          const parsed = typeof msg.participants === 'string'
            ? JSON.parse(msg.participants)
            : msg.participants;

          const allParticipants = new Set<string>();
          if (parsed.from) allParticipants.add(normalizePhone(parsed.from));
          if (parsed.to) {
            const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
            toList.forEach((p: string) => allParticipants.add(normalizePhone(p)));
          }

          if (allParticipants.size > 0) {
            return 'participants-' + Array.from(allParticipants).sort().join('-');
          }
        }
      } catch {
        // Fall through
      }

      // Last resort: use message id
      return 'msg-' + msg.id;
    };

    // Helper to extract phone/contact name from thread
    const getThreadContact = (msgs: Communication[]): { phone: string; name: string | null } => {
      for (const msg of msgs) {
        try {
          if (msg.participants) {
            const parsed = typeof msg.participants === 'string'
              ? JSON.parse(msg.participants)
              : msg.participants;

            let phone: string | null = null;
            if (msg.direction === 'inbound' && parsed.from) {
              phone = parsed.from;
            } else if (msg.direction === 'outbound' && parsed.to?.length > 0) {
              phone = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
            }

            if (phone) {
              const normalized = normalizePhone(phone);
              const name = phoneNameMap[normalized] || phoneNameMap[phone] || null;
              return { phone, name };
            }
          }
        } catch {
          // Continue
        }

        // Fallback to sender
        if (msg.sender) {
          const normalized = normalizePhone(msg.sender);
          const name = phoneNameMap[normalized] || phoneNameMap[msg.sender] || null;
          return { phone: msg.sender, name };
        }
      }
      return { phone: 'Unknown', name: null };
    };

    // Group text messages by thread
    const textThreads = new Map<string, Communication[]>();
    texts.forEach(msg => {
      const key = getThreadKey(msg);
      const thread = textThreads.get(key) || [];
      thread.push(msg);
      textThreads.set(key, thread);
    });

    // Sort messages within each thread chronologically
    textThreads.forEach((msgs, key) => {
      textThreads.set(key, msgs.sort((a, b) => {
        const dateA = new Date(a.sent_at || a.received_at || 0).getTime();
        const dateB = new Date(b.sent_at || b.received_at || 0).getTime();
        return dateA - dateB;
      }));
    });

    // Convert to array and sort threads by most recent message
    const sortedThreads = Array.from(textThreads.entries()).sort((a, b) => {
      const lastA = a[1][a[1].length - 1];
      const lastB = b[1][b[1].length - 1];
      const dateA = new Date(lastA.sent_at || lastA.received_at || 0).getTime();
      const dateB = new Date(lastB.sent_at || lastB.received_at || 0).getTime();
      return dateB - dateA; // Most recent first
    });

    // Sort emails by date (most recent first)
    const sortedEmails = [...emails].sort((a, b) =>
      new Date(b.sent_at as string).getTime() - new Date(a.sent_at as string).getTime()
    );

    // Check if there's any content for appendix
    // Note: HTML content is in 'body' field, not 'body_html'
    const emailsWithContent = sortedEmails.filter(c => c.body_text || c.body_plain || (c as { body?: string }).body);
    const threadsWithContent = sortedThreads.filter(([_, msgs]) =>
      msgs.some(m => m.body_text || m.body_plain)
    );
    const hasAppendix = emailsWithContent.length > 0 || threadsWithContent.length > 0;

    let html = '';

    // Email Threads Section
    if (sortedEmails.length > 0) {
      html += '<div class="section">';
      html += '<h3>Email Threads (' + sortedEmails.length + ')</h3>';
      html += '<div class="communications">';

      sortedEmails.forEach((comm, idx) => {
        const hasContent = comm.body_text || comm.body_plain || (comm as { body?: string }).body;
        const anchorId = 'email-' + idx;
        html += '<div class="communication">';
        html += '<div class="subject">' + (escapeHtml(comm.subject) || '(No Subject)') + '</div>';
        html += '<div class="from">From: ' + (escapeHtml(comm.sender) || 'Unknown') + '</div>';
        html += '<div class="meta">';
        html += '<span>' + formatDateTime(comm.sent_at as string) + '</span>';
        if (hasContent) {
          html += '<a href="#' + anchorId + '" class="view-full-link">View Full &rarr;</a>';
        }
        html += '</div></div>';
      });

      html += '</div></div>';
    }

    // Text Threads Section (grouped by conversation)
    if (sortedThreads.length > 0) {
      html += '<div class="section">';
      html += '<a name="text-conversations"></a>';
      html += '<h3>Text Conversations (' + sortedThreads.length + ')</h3>';
      html += '<div class="communications">';

      sortedThreads.forEach(([threadId, msgs], idx) => {
        const contact = getThreadContact(msgs);
        const lastMsg = msgs[msgs.length - 1];
        const preview = truncatePreview(lastMsg.body_text || lastMsg.body_plain);
        const hasContent = msgs.some(m => m.body_text || m.body_plain);
        const anchorId = 'thread-' + idx;
        const isGroupChat = this._isGroupChat(msgs);

        html += '<div class="communication">';
        // Contact name in bold (or phone if no name)
        html += '<div class="subject">' + escapeHtml(contact.name || contact.phone);
        if (isGroupChat) {
          html += ' <span style="font-size: 11px; color: #718096; font-weight: normal;">(Group Chat)</span>';
        }
        html += '</div>';
        // Phone number on separate line (only if we have a name)
        if (contact.name) {
          html += '<div style="font-size: 12px; color: #718096;">' + escapeHtml(contact.phone) + '</div>';
        }
        html += '<div style="font-size: 13px; color: #4a5568; margin: 8px 0;">' + preview + '</div>';
        html += '<div class="meta">';
        html += '<span>' + msgs.length + ' message' + (msgs.length === 1 ? '' : 's');
        html += ' &middot; ' + formatDateTime(lastMsg.sent_at as string) + '</span>';
        if (hasContent) {
          html += '<a href="#' + anchorId + '" class="view-full-link">View Full &rarr;</a>';
        }
        html += '</div></div>';
      });

      html += '</div></div>';
    }

    // If no communications at all
    if (sortedEmails.length === 0 && sortedThreads.length === 0) {
      html += '<div class="section">';
      html += '<h3>Related Communications (0)</h3>';
      html += '<div class="communications">';
      html += '<p style="color: #718096; font-style: italic;">No communications linked to this transaction.</p>';
      html += '</div></div>';
    }

    // Appendix: Full Messages
    if (hasAppendix) {
      html += '<div class="appendix">';
      html += '<a name="appendix"></a>';
      html += '<h2>Full Messages</h2>';

      // Email appendix items
      emailsWithContent.forEach((comm, idx) => {
        // Prefer HTML body for rich formatting, fall back to plain text
        // Note: The query returns HTML content in 'body' field (not 'body_html')
        const htmlBody = (comm as { body?: string }).body;
        // Check for actual HTML tags (not just angle brackets from URLs like <https://...>)
        // Look for common HTML tags that indicate rich content
        const hasHtmlBody = htmlBody && htmlBody.trim().length > 0 &&
          (/<(html|body|div|p|table|tr|td|span|a\s|img|br|hr|h[1-6]|ul|ol|li|strong|em|b|i)\b/i.test(htmlBody));
        let bodyContent: string;
        let bodyClass: string;

        if (hasHtmlBody) {
          // Use sanitized HTML for rich formatting
          bodyContent = sanitizeHtml(htmlBody);
          bodyClass = 'message-body message-body-html';
        } else {
          // Fall back to plain text
          const plainText = comm.body_text || comm.body_plain || '';
          bodyContent = escapeHtml(plainText);
          bodyClass = 'message-body message-body-plain';
        }

        html += '<div class="appendix-item">';
        html += '<a name="email-' + idx + '"></a>';
        html += '<div class="header-row">';
        html += '<div>';
        html += '<div class="subject-line">' + (escapeHtml(comm.subject) || '(No Subject)') + '</div>';
        html += '<div class="meta-info">From: ' + (escapeHtml(comm.sender) || 'Unknown') + '</div>';
        html += '<div class="meta-info">' + formatDateTime(comm.sent_at as string) + '</div>';
        html += '</div>';
        html += '<span class="msg-id">Email #' + (idx + 1) + '</span>';
        html += '</div>';
        html += '<div class="' + bodyClass + '">' + bodyContent + '</div>';
        html += '<a href="#appendix" class="back-to-top">&larr; Back to Messages</a>';
        html += '</div>';
      });

      // Text thread appendix items (show all messages in thread)
      threadsWithContent.forEach(([threadId, msgs], threadIdx) => {
        const contact = getThreadContact(msgs);
        const isGroupChat = this._isGroupChat(msgs);

        html += '<div class="appendix-item">';
        html += '<a name="thread-' + threadIdx + '"></a>';
        html += '<div class="header-row">';
        html += '<div>';
        // Contact name in bold, with phone below
        html += '<div class="subject-line">Conversation with ' + escapeHtml(contact.name || contact.phone);
        if (isGroupChat) {
          html += ' (Group Chat)';
        }
        html += '</div>';
        // Show phone on separate line if we have a contact name
        if (contact.name) {
          html += '<div class="meta-info">' + escapeHtml(contact.phone) + '</div>';
        }
        html += '<div class="meta-info">' + msgs.length + ' message' + (msgs.length === 1 ? '' : 's') + '</div>';
        html += '</div>';
        html += '<span class="msg-id">Thread #' + (threadIdx + 1) + '</span>';
        html += '</div>';

        // Show each message in the thread (text messages use plain text formatting)
        html += '<div class="message-body message-body-plain">';
        msgs.forEach((msg, msgIdx) => {
          const isOutbound = msg.direction === 'outbound';
          let senderName = 'You';
          let senderPhone: string | null = null;

          if (!isOutbound) {
            // For group chats, try to show individual sender
            if (isGroupChat && msg.sender) {
              const senderNormalized = normalizePhone(msg.sender);
              const resolvedName = phoneNameMap[senderNormalized] || phoneNameMap[msg.sender];
              senderName = resolvedName || msg.sender;
              // Show phone if we resolved to a name
              if (resolvedName) {
                senderPhone = msg.sender;
              }
            } else {
              // Use thread contact info
              senderName = contact.name || contact.phone;
              // Show phone if we have a contact name
              if (contact.name) {
                senderPhone = contact.phone;
              }
            }
          }
          const body = msg.body_text || msg.body_plain || '';
          const time = formatDateTime(msg.sent_at as string);

          if (msgIdx > 0) html += '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 0;">';
          // Name in bold with timestamp
          html += '<div style="margin-bottom: 4px;">';
          html += '<strong>' + escapeHtml(senderName) + '</strong>';
          html += ' <span style="color: #718096; font-size: 11px;">' + time + '</span>';
          html += '</div>';
          // Phone number below name (if resolved to contact name)
          if (senderPhone) {
            html += '<div style="font-size: 11px; color: #718096; margin-bottom: 8px;">' + escapeHtml(senderPhone) + '</div>';
          }
          html += '<div>' + escapeHtml(body) + '</div>';
        });
        html += '</div>';

        html += '<a href="#text-conversations" class="back-to-top">&larr; Back to Messages</a>';
        html += '</div>';
      });

      html += '</div>';
    }

    return html;
  }

  /**
   * Check if a thread is a group chat (has multiple unique participants)
   * @private
   */
  private _isGroupChat(msgs: Communication[]): boolean {
    const participants = new Set<string>();

    for (const msg of msgs) {
      try {
        if (msg.participants) {
          const parsed = typeof msg.participants === 'string'
            ? JSON.parse(msg.participants)
            : msg.participants;

          if (parsed.from) participants.add(parsed.from.replace(/\D/g, '').slice(-10));
          if (parsed.to) {
            const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
            toList.forEach((p: string) => participants.add(p.replace(/\D/g, '').slice(-10)));
          }
        }
      } catch {
        // Continue
      }
    }

    // More than 2 unique participants means group chat
    return participants.size > 2;
  }

  /**
   * Get default export path for a transaction
   */
  getDefaultExportPath(transaction: Transaction): string {
    const downloadsPath = app.getPath("downloads");
    const fileName = `Transaction_${transaction.property_address?.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.pdf`;
    return path.join(downloadsPath, fileName);
  }
}

export default new PDFExportService();
