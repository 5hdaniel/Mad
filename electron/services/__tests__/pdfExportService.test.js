/**
 * PDF Export Service Tests
 * Tests PDF generation for transactions
 */

const PDFExportService = require('../pdfExportService');
const { BrowserWindow } = require('electron');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('electron', () => ({
  BrowserWindow: jest.fn(),
  app: {
    getPath: jest.fn(() => '/mock/user/data'),
  },
}));

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
  },
}));

describe('PDFExportService', () => {
  let pdfExportService;
  let mockWindow;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock BrowserWindow instance
    mockWindow = {
      loadURL: jest.fn().mockResolvedValue(),
      close: jest.fn(),
      webContents: {
        printToPDF: jest.fn().mockResolvedValue(Buffer.from('PDF data')),
      },
    };

    BrowserWindow.mockImplementation(() => mockWindow);

    pdfExportService = new PDFExportService();
  });

  describe('generateTransactionPDF', () => {
    const mockTransaction = {
      id: 'txn-123',
      property_address: '123 Main St, City, CA 90210',
      transaction_type: 'purchase',
      sale_price: 500000,
      closing_date: '2024-12-31',
    };

    const mockCommunications = [
      {
        id: 'comm-1',
        subject: 'Offer Accepted',
        from_name: 'Agent Smith',
        date: '2024-01-15',
        body_preview: 'Congratulations on your offer',
      },
      {
        id: 'comm-2',
        subject: 'Closing Documents',
        from_name: 'Escrow Officer',
        date: '2024-12-20',
        body_preview: 'Please review and sign',
      },
    ];

    const outputPath = '/tmp/transaction-report.pdf';

    it('should generate PDF successfully', async () => {
      fs.writeFile.mockResolvedValue();

      const result = await pdfExportService.generateTransactionPDF(
        mockTransaction,
        mockCommunications,
        outputPath
      );

      expect(result).toBe(outputPath);
      expect(BrowserWindow).toHaveBeenCalled();
      expect(mockWindow.loadURL).toHaveBeenCalled();
      expect(mockWindow.webContents.printToPDF).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(outputPath, expect.any(Buffer));
      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should create hidden BrowserWindow', async () => {
      fs.writeFile.mockResolvedValue();

      await pdfExportService.generateTransactionPDF(
        mockTransaction,
        mockCommunications,
        outputPath
      );

      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          show: false,
          webPreferences: expect.objectContaining({
            nodeIntegration: false,
            contextIsolation: true,
          }),
        })
      );
    });

    it('should load HTML content in window', async () => {
      fs.writeFile.mockResolvedValue();

      await pdfExportService.generateTransactionPDF(
        mockTransaction,
        mockCommunications,
        outputPath
      );

      expect(mockWindow.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('data:text/html')
      );
    });

    it('should configure PDF print options', async () => {
      fs.writeFile.mockResolvedValue();

      await pdfExportService.generateTransactionPDF(
        mockTransaction,
        mockCommunications,
        outputPath
      );

      expect(mockWindow.webContents.printToPDF).toHaveBeenCalledWith(
        expect.objectContaining({
          marginsType: 0,
          printBackground: true,
          printSelectionOnly: false,
          landscape: false,
          pageSize: 'Letter',
        })
      );
    });

    it('should write PDF data to file', async () => {
      const pdfBuffer = Buffer.from('PDF content');
      mockWindow.webContents.printToPDF.mockResolvedValue(pdfBuffer);
      fs.writeFile.mockResolvedValue();

      await pdfExportService.generateTransactionPDF(
        mockTransaction,
        mockCommunications,
        outputPath
      );

      expect(fs.writeFile).toHaveBeenCalledWith(outputPath, pdfBuffer);
    });

    it('should close window after PDF generation', async () => {
      fs.writeFile.mockResolvedValue();

      await pdfExportService.generateTransactionPDF(
        mockTransaction,
        mockCommunications,
        outputPath
      );

      expect(mockWindow.close).toHaveBeenCalled();
      expect(pdfExportService.exportWindow).toBeNull();
    });

    it('should clean up window on error', async () => {
      mockWindow.webContents.printToPDF.mockRejectedValue(new Error('Print failed'));

      await expect(
        pdfExportService.generateTransactionPDF(mockTransaction, mockCommunications, outputPath)
      ).rejects.toThrow('Print failed');

      expect(mockWindow.close).toHaveBeenCalled();
      expect(pdfExportService.exportWindow).toBeNull();
    });

    it('should handle file write errors', async () => {
      fs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(
        pdfExportService.generateTransactionPDF(mockTransaction, mockCommunications, outputPath)
      ).rejects.toThrow('Disk full');

      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should wait for page to render before printing', async () => {
      jest.useFakeTimers();
      fs.writeFile.mockResolvedValue();

      const promise = pdfExportService.generateTransactionPDF(
        mockTransaction,
        mockCommunications,
        outputPath
      );

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      await promise;

      expect(mockWindow.webContents.printToPDF).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should handle transactions with missing data', async () => {
      fs.writeFile.mockResolvedValue();

      const incompleteTransaction = {
        id: 'txn-456',
        property_address: '456 Oak Ave',
      };

      await pdfExportService.generateTransactionPDF(
        incompleteTransaction,
        [],
        outputPath
      );

      expect(mockWindow.webContents.printToPDF).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should handle empty communications array', async () => {
      fs.writeFile.mockResolvedValue();

      await pdfExportService.generateTransactionPDF(mockTransaction, [], outputPath);

      expect(mockWindow.loadURL).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('_generateHTML', () => {
    const mockTransaction = {
      id: 'txn-123',
      property_address: '123 Main St',
      transaction_type: 'purchase',
      sale_price: 500000,
      closing_date: '2024-12-31',
    };

    const mockCommunications = [
      {
        subject: 'Test Email',
        from_name: 'Test Sender',
        date: '2024-01-01',
      },
    ];

    it('should generate HTML with transaction data', () => {
      const html = pdfExportService._generateHTML(mockTransaction, mockCommunications);

      expect(html).toContain('123 Main St');
      expect(html).toContain('purchase');
    });

    it('should include communications in HTML', () => {
      const html = pdfExportService._generateHTML(mockTransaction, mockCommunications);

      expect(html).toContain('Test Email');
      expect(html).toContain('Test Sender');
    });

    it('should format currency values', () => {
      const html = pdfExportService._generateHTML(mockTransaction, mockCommunications);

      expect(html).toContain('$500,000');
    });

    it('should format dates', () => {
      const html = pdfExportService._generateHTML(mockTransaction, mockCommunications);

      expect(html).toContain('December 31, 2024');
    });

    it('should handle missing values gracefully', () => {
      const incompleteTransaction = {
        id: 'txn-123',
        property_address: '123 Main St',
      };

      const html = pdfExportService._generateHTML(incompleteTransaction, []);

      expect(html).toContain('123 Main St');
      expect(html).toBeDefined();
    });

    it('should generate valid HTML structure', () => {
      const html = pdfExportService._generateHTML(mockTransaction, mockCommunications);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('should include CSS styles', () => {
      const html = pdfExportService._generateHTML(mockTransaction, mockCommunications);

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });
  });

  describe('error handling', () => {
    it('should clean up on window creation error', async () => {
      BrowserWindow.mockImplementation(() => {
        throw new Error('Window creation failed');
      });

      await expect(
        pdfExportService.generateTransactionPDF({}, [], '/tmp/test.pdf')
      ).rejects.toThrow('Window creation failed');

      expect(pdfExportService.exportWindow).toBeNull();
    });

    it('should handle URL loading errors', async () => {
      mockWindow.loadURL.mockRejectedValue(new Error('Load failed'));

      await expect(
        pdfExportService.generateTransactionPDF({}, [], '/tmp/test.pdf')
      ).rejects.toThrow('Load failed');

      expect(mockWindow.close).toHaveBeenCalled();
    });

    it('should propagate printToPDF errors', async () => {
      mockWindow.webContents.printToPDF.mockRejectedValue(new Error('Print error'));

      await expect(
        pdfExportService.generateTransactionPDF({}, [], '/tmp/test.pdf')
      ).rejects.toThrow('Print error');
    });
  });

  describe('concurrent exports', () => {
    it('should handle sequential PDF generations', async () => {
      fs.writeFile.mockResolvedValue();

      await pdfExportService.generateTransactionPDF({}, [], '/tmp/test1.pdf');
      await pdfExportService.generateTransactionPDF({}, [], '/tmp/test2.pdf');

      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(mockWindow.close).toHaveBeenCalledTimes(2);
    });
  });
});
