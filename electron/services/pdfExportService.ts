import { BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { Transaction, Communication } from '../types/models';

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
    outputPath: string
  ): Promise<string> {
    try {
      console.log('[PDF Export] Generating PDF for transaction:', transaction.id);

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
      await this.exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Wait for page to fully render
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate PDF
      const pdfData = await this.exportWindow.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        pageSize: 'Letter',
      });

      // Save PDF
      await fs.writeFile(outputPath, pdfData);

      // Clean up
      this.exportWindow.close();
      this.exportWindow = null;

      console.log('[PDF Export] PDF generated successfully:', outputPath);
      return outputPath;
    } catch (error) {
      console.error('[PDF Export] Failed to generate PDF:', error);
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
  private _generateHTML(transaction: Transaction, communications: Communication[]): string {
    const formatCurrency = (amount?: number | null): string => {
      if (!amount) return 'N/A';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (dateString?: string | Date | null): string => {
      if (!dateString) return 'N/A';
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const formatDateTime = (dateString: string | Date): string => {
      if (!dateString) return 'N/A';
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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

    .header .subtitle {
      font-size: 14px;
      color: #718096;
    }

    .property-info {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .property-info h2 {
      font-size: 20px;
      margin-bottom: 12px;
    }

    .property-info .address {
      font-size: 16px;
      opacity: 0.95;
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
      margin-bottom: 8px;
    }

    .communication .body {
      font-size: 12px;
      color: #4a5568;
      line-height: 1.6;
      border-left: 3px solid #e2e8f0;
      padding-left: 12px;
      margin-top: 8px;
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

    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>Real Estate Transaction Report</h1>
    <div class="subtitle">Generated on ${formatDateTime(new Date().toISOString())}</div>
  </div>

  <!-- Property Info -->
  <div class="property-info">
    <h2>Property Information</h2>
    <div class="address">${transaction.property_address || 'N/A'}</div>
  </div>

  <!-- Transaction Details -->
  <div class="details-grid">
    <div class="detail-card">
      <div class="label">Transaction Type</div>
      <div class="value">
        ${transaction.transaction_type ? `<span class="badge badge-${transaction.transaction_type}">${transaction.transaction_type === 'purchase' ? 'Purchase' : 'Sale'}</span>` : 'N/A'}
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
  <div class="section">
    <h3>Related Communications (${communications.length})</h3>
    <div class="communications">
      ${communications
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
        .map(
          (comm) => `
        <div class="communication">
          <div class="meta">
            <span>${formatDateTime(comm.sent_at)}</span>
            ${comm.has_attachments ? '<span>📎 Has Attachments</span>' : ''}
          </div>
          <div class="subject">${comm.subject || '(No Subject)'}</div>
          <div class="from">From: ${comm.sender || 'Unknown'}</div>
          ${comm.recipients ? `<div class="from">To: ${comm.recipients}</div>` : ''}
          ${
            comm.body_plain
              ? `<div class="body">${comm.body_plain.substring(0, 500).replace(/</g, '&lt;').replace(/>/g, '&gt;')}${comm.body_plain.length > 500 ? '...' : ''}</div>`
              : ''
          }
        </div>
      `
        )
        .join('')}
    </div>
  </div>

  <!-- Extraction Details -->
  <div class="section">
    <h3>Extraction Details</h3>
    <div class="detail-card">
      <div class="label">Confidence Score</div>
      <div class="value">${transaction.extraction_confidence || 'N/A'}%</div>
    </div>
    <div class="detail-card" style="margin-top: 12px;">
      <div class="label">Date Range</div>
      <div class="value">
        ${formatDate(transaction.first_communication_date)} - ${formatDate(transaction.last_communication_date)}
      </div>
    </div>
  </div>

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
   * Get default export path for a transaction
   */
  getDefaultExportPath(transaction: Transaction): string {
    const downloadsPath = app.getPath('downloads');
    const fileName = `Transaction_${transaction.property_address?.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
    return path.join(downloadsPath, fileName);
  }
}

export default new PDFExportService();
