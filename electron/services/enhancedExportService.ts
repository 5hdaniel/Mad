import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import pdfExportService from './pdfExportService';
import { Transaction, Communication } from '../types/models';

/**
 * Enhanced Export Service
 * Supports multiple export formats and content filtering
 * - PDF Report
 * - Excel (.xlsx) - CSV format for now
 * - CSV
 * - JSON
 * - TXT + EML files in folders
 */

interface ExportOptions {
  contentType?: 'text' | 'email' | 'both';
  exportFormat?: 'pdf' | 'excel' | 'csv' | 'json' | 'txt_eml';
  representationStartDate?: string;
  closingDate?: string;
}

class EnhancedExportService {
  constructor() {}

  /**
   * Export transaction with enhanced options
   * @param transaction - Transaction data
   * @param communications - All communications for the transaction
   * @param options - Export options
   * @returns Path to exported file/folder
   */
  async exportTransaction(
    transaction: Transaction,
    communications: Communication[],
    options: ExportOptions = {}
  ): Promise<string> {
    const {
      contentType = 'both',
      exportFormat = 'pdf',
      representationStartDate,
      closingDate,
    } = options;

    try {
      console.log('[Enhanced Export] Starting export:', {
        format: exportFormat,
        contentType,
        transactionId: transaction.id,
        propertyAddress: transaction.property_address,
      });

      // Filter communications by date range
      let filteredComms = this._filterCommunicationsByDate(
        communications,
        representationStartDate,
        closingDate
      );

      // IMPORTANT: Verify address relevance to prevent cross-transaction contamination
      // This ensures that contacts working on multiple transactions don't get mixed emails
      filteredComms = this._filterByAddressRelevance(
        filteredComms,
        transaction.property_address
      );

      // Filter by content type
      filteredComms = this._filterByContentType(filteredComms, contentType);

      // Sort descending (most recent first)
      filteredComms.sort((a, b) => {
        const dateA = a.sent_at ? new Date(a.sent_at as string).getTime() : 0;
        const dateB = b.sent_at ? new Date(b.sent_at as string).getTime() : 0;
        return dateB - dateA;
      });

      console.log(
        `[Enhanced Export] Filtered to ${filteredComms.length} communications (verified address relevance)`
      );

      // Export based on format
      let exportPath: string;
      switch (exportFormat) {
        case 'pdf':
          exportPath = await this._exportPDF(transaction, filteredComms);
          break;
        case 'excel':
        case 'csv':
          exportPath = await this._exportCSV(transaction, filteredComms, exportFormat);
          break;
        case 'json':
          exportPath = await this._exportJSON(transaction, filteredComms);
          break;
        case 'txt_eml':
          exportPath = await this._exportTxtEml(transaction, filteredComms);
          break;
        default:
          throw new Error(`Unknown export format: ${exportFormat}`);
      }

      console.log('[Enhanced Export] Export complete:', exportPath);
      return exportPath;
    } catch (error) {
      console.error('[Enhanced Export] Export failed:', error);
      throw error;
    }
  }

  /**
   * Filter communications by date range
   * @private
   */
  private _filterCommunicationsByDate(
    communications: Communication[],
    startDate?: string,
    endDate?: string
  ): Communication[] {
    if (!startDate && !endDate) {
      return communications;
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    return communications.filter((comm) => {
      const commDate = new Date(comm.sent_at as string);
      if (start && commDate < start) return false;
      if (end && commDate > end) return false;
      return true;
    });
  }

  /**
   * Filter by content type (text/email/both)
   * @private
   */
  private _filterByContentType(
    communications: Communication[],
    contentType: 'text' | 'email' | 'both'
  ): Communication[] {
    if (contentType === 'both') {
      return communications;
    }

    if (contentType === 'email') {
      return communications.filter((c) => c.communication_type === 'email');
    }

    if (contentType === 'text') {
      return communications.filter((c) => c.communication_type === 'text');
    }

    return communications;
  }

  /**
   * Filter communications by address relevance
   * CRITICAL: Prevents cross-transaction contamination when contacts work on multiple properties
   * Example: Inspector working on 4 different transactions should only show emails for THIS property
   * @private
   */
  private _filterByAddressRelevance(
    communications: Communication[],
    propertyAddress?: string
  ): Communication[] {
    if (!propertyAddress) {
      console.warn('[Enhanced Export] No property address provided, skipping address verification');
      return communications;
    }

    // Normalize the property address for matching
    const normalizedAddress = this._normalizeAddress(propertyAddress);
    const addressParts = this._extractAddressParts(normalizedAddress);

    return communications.filter((comm) => {
      // Check subject and body for address references
      const subject = (comm.subject || '').toLowerCase();
      const body = (comm.body_plain || comm.body || '').toLowerCase();
      const combinedContent = `${subject} ${body}`;

      // Check if ANY part of the address is mentioned in the communication
      const hasAddressReference = addressParts.some((part) => {
        if (part.length < 3) return false; // Skip very short parts
        return combinedContent.includes(part);
      });

      if (hasAddressReference) {
        return true;
      }

      // If no direct match, check if it's in the parties_involved or keywords_detected
      // (These might have been extracted during email scanning)
      if (comm.parties_involved) {
        const parties = comm.parties_involved.toLowerCase();
        if (addressParts.some((part) => part.length >= 3 && parties.includes(part))) {
          return true;
        }
      }

      if (comm.keywords_detected) {
        const keywords = Array.isArray(comm.keywords_detected)
          ? comm.keywords_detected.join(' ').toLowerCase()
          : (comm.keywords_detected as string).toLowerCase();
        if (addressParts.some((part) => part.length >= 3 && keywords.includes(part))) {
          return true;
        }
      }

      // Log filtered out emails for debugging
      console.log(
        `[Enhanced Export] Filtered out email (no address match): "${comm.subject}" from ${comm.sender}`
      );
      return false;
    });
  }

  /**
   * Normalize address for comparison (lowercase, remove extra spaces)
   * @private
   */
  private _normalizeAddress(address: string): string {
    return address.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract searchable parts from an address
   * Examples:
   *   "123 Main St, Anytown, CA 12345" → ["123", "main", "st", "anytown", "ca", "12345", "123 main", "main st"]
   * @private
   */
  private _extractAddressParts(normalizedAddress: string): string[] {
    const parts: string[] = [];

    // Remove common separators and split
    const words = normalizedAddress
      .replace(/[,\.]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0);

    // Add individual words
    parts.push(...words);

    // Add 2-word combinations (street number + street name, etc)
    for (let i = 0; i < words.length - 1; i++) {
      parts.push(`${words[i]} ${words[i + 1]}`);
    }

    // Add 3-word combinations for better matching
    for (let i = 0; i < words.length - 2; i++) {
      parts.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    return parts;
  }

  /**
   * Export as PDF using existing PDF export service
   * @private
   */
  private async _exportPDF(transaction: Transaction, communications: Communication[]): Promise<string> {
    const downloadsPath = app.getPath('downloads');
    const fileName = this._sanitizeFileName(
      `Transaction_${transaction.property_address}_${Date.now()}.pdf`
    );
    const outputPath = path.join(downloadsPath, fileName);

    return await pdfExportService.generateTransactionPDF(
      transaction,
      communications,
      outputPath
    );
  }

  /**
   * Export as CSV or Excel (CSV format)
   * @private
   */
  private async _exportCSV(
    transaction: Transaction,
    communications: Communication[],
    format: 'excel' | 'csv'
  ): Promise<string> {
    const downloadsPath = app.getPath('downloads');
    const ext = format === 'excel' ? 'xlsx' : 'csv';
    const fileName = this._sanitizeFileName(
      `Transaction_${transaction.property_address}_${Date.now()}.${ext}`
    );
    const outputPath = path.join(downloadsPath, fileName);

    // Create CSV content
    const headers = [
      'Date',
      'Type',
      'From',
      'To',
      'Subject',
      'Body Preview',
      'Has Attachments',
      'Attachment Count',
    ];

    const rows = communications.map((comm) => [
      new Date(comm.sent_at as string).toLocaleString(),
      comm.communication_type || 'email',
      comm.sender || '',
      comm.recipients || '',
      comm.subject || '',
      (comm.body_plain || '').substring(0, 200).replace(/"/g, '""'),
      comm.has_attachments ? 'Yes' : 'No',
      comm.attachment_count || 0,
    ]);

    // Add transaction info at the top
    const csvLines = [
      `Transaction Report: ${transaction.property_address}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Representation Start: ${
        transaction.representation_start_date
          ? new Date(transaction.representation_start_date).toLocaleDateString()
          : 'N/A'
      }`,
      `Closing Date: ${
        transaction.closing_date
          ? new Date(transaction.closing_date).toLocaleDateString()
          : 'N/A'
      }`,
      `Total Communications: ${communications.length}`,
      '',
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ];

    const csvContent = csvLines.join('\n');

    await fs.writeFile(outputPath, csvContent, 'utf8');

    return outputPath;
  }

  /**
   * Export as JSON
   * @private
   */
  private async _exportJSON(transaction: Transaction, communications: Communication[]): Promise<string> {
    const downloadsPath = app.getPath('downloads');
    const fileName = this._sanitizeFileName(
      `Transaction_${transaction.property_address}_${Date.now()}.json`
    );
    const outputPath = path.join(downloadsPath, fileName);

    const exportData = {
      transaction: {
        id: transaction.id,
        property_address: transaction.property_address,
        transaction_type: transaction.transaction_type,
        status: transaction.status,
        representation_start_date: transaction.representation_start_date,
        closing_date: transaction.closing_date,
        sale_price: transaction.sale_price,
        listing_price: transaction.listing_price,
        earnest_money_amount: transaction.earnest_money_amount,
        extraction_confidence: transaction.extraction_confidence,
        total_communications_count: communications.length,
        exported_at: new Date().toISOString(),
      },
      communications: communications.map((comm) => ({
        id: comm.id,
        type: comm.communication_type,
        sender: comm.sender,
        recipients: comm.recipients,
        cc: comm.cc,
        bcc: comm.bcc,
        subject: comm.subject,
        body_plain: comm.body_plain,
        sent_at: comm.sent_at,
        received_at: comm.received_at,
        has_attachments: comm.has_attachments,
        attachment_count: comm.attachment_count,
        attachment_metadata: comm.attachment_metadata,
        keywords_detected: comm.keywords_detected,
        parties_involved: comm.parties_involved,
        relevance_score: comm.relevance_score,
      })),
    };

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

    return outputPath;
  }

  /**
   * Export as TXT + EML files in folder structure
   * Creates: {address}_{client}/emails/ and texts/
   * @private
   */
  private async _exportTxtEml(transaction: Transaction, communications: Communication[]): Promise<string> {
    const downloadsPath = app.getPath('downloads');
    const folderName = this._sanitizeFileName(
      `${transaction.property_address}_Export_${Date.now()}`
    );
    const basePath = path.join(downloadsPath, folderName);

    // Create folder structure
    await fs.mkdir(basePath, { recursive: true });
    const emailsPath = path.join(basePath, 'emails');
    const textsPath = path.join(basePath, 'texts');
    await fs.mkdir(emailsPath, { recursive: true });
    await fs.mkdir(textsPath, { recursive: true });

    // Export emails as .eml files
    const emails = communications.filter((c) => c.communication_type === 'email');
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const emlContent = this._createEMLContent(email);
      const emlFileName = this._sanitizeFileName(
        `${i + 1}_${email.subject || 'no_subject'}.eml`
      );
      await fs.writeFile(path.join(emailsPath, emlFileName), emlContent, 'utf8');
    }

    // Export texts as .txt files
    const texts = communications.filter((c) => c.communication_type === 'text');
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const txtContent = this._createTextContent(text);
      const txtFileName = this._sanitizeFileName(
        `${i + 1}_${new Date(text.sent_at as string).toISOString().split('T')[0]}.txt`
      );
      await fs.writeFile(path.join(textsPath, txtFileName), txtContent, 'utf8');
    }

    // Create summary.txt
    const summaryContent = this._createSummary(transaction, communications);
    await fs.writeFile(path.join(basePath, 'SUMMARY.txt'), summaryContent, 'utf8');

    return basePath;
  }

  /**
   * Create EML file content (RFC 822 format)
   * @private
   */
  private _createEMLContent(email: Communication): string {
    const lines: string[] = [];

    lines.push(`From: ${email.sender || 'Unknown'}`);
    if (email.recipients) lines.push(`To: ${email.recipients}`);
    if (email.cc) lines.push(`Cc: ${email.cc}`);
    if (email.bcc) lines.push(`Bcc: ${email.bcc}`);
    lines.push(`Subject: ${email.subject || '(No Subject)'}`);
    lines.push(
      `Date: ${
        email.sent_at ? new Date(email.sent_at as string).toUTCString() : 'Unknown'
      }`
    );
    if (email.has_attachments) {
      lines.push(
        `X-Attachments: ${email.attachment_count || 0} attachment(s)`
      );
    }
    lines.push('Content-Type: text/plain; charset=utf-8');
    lines.push('');
    lines.push(email.body_plain || email.body || '(No content)');

    return lines.join('\r\n');
  }

  /**
   * Create text message content
   * @private
   */
  private _createTextContent(text: Communication): string {
    const lines: string[] = [];

    lines.push('=== TEXT MESSAGE ===');
    lines.push(`From: ${text.sender || 'Unknown'}`);
    lines.push(`To: ${text.recipients || 'Unknown'}`);
    lines.push(
      `Date: ${text.sent_at ? new Date(text.sent_at as string).toLocaleString() : 'Unknown'}`
    );
    lines.push('');
    lines.push(text.body_plain || text.body || '(No content)');

    return lines.join('\n');
  }

  /**
   * Create summary file
   * @private
   */
  private _createSummary(transaction: Transaction, communications: Communication[]): string {
    const lines: string[] = [];

    lines.push('========================================');
    lines.push('  TRANSACTION EXPORT SUMMARY');
    lines.push('========================================');
    lines.push('');
    lines.push(`Property Address: ${transaction.property_address}`);
    lines.push(
      `Transaction Type: ${transaction.transaction_type || 'N/A'}`
    );
    lines.push(`Status: ${transaction.status || 'N/A'}`);
    lines.push('');
    lines.push(
      `Representation Start Date: ${
        transaction.representation_start_date
          ? new Date(transaction.representation_start_date).toLocaleDateString()
          : 'N/A'
      }`
    );
    lines.push(
      `Closing Date: ${
        transaction.closing_date
          ? new Date(transaction.closing_date).toLocaleDateString()
          : 'N/A'
      }`
    );
    lines.push('');
    lines.push(
      `Sale Price: ${
        transaction.sale_price
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(transaction.sale_price)
          : 'N/A'
      }`
    );
    lines.push('');
    lines.push(`Total Communications Exported: ${communications.length}`);
    lines.push(
      `  - Emails: ${
        communications.filter((c) => c.communication_type === 'email').length
      }`
    );
    lines.push(
      `  - Texts: ${
        communications.filter((c) => c.communication_type === 'text').length
      }`
    );
    lines.push('');
    lines.push(`Export Date: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('========================================');

    return lines.join('\n');
  }

  /**
   * Sanitize file/folder name
   * @private
   */
  private _sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-z0-9_\-\.]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 200);
  }
}

export default new EnhancedExportService();
