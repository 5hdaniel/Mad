/**
 * @jest-environment node
 */

/**
 * Unit tests for FolderExportService
 * Tests text thread PDF export functionality including:
 * - Thread grouping by thread_id
 * - Contact name resolution
 * - Group chat detection
 * - HTML generation
 */

import { jest } from "@jest/globals";

// Store HTML content for test verification (TASK-1802)
let lastLoadedHtmlContent: string | null = null;

// Mock electron
const mockPrintToPDF = jest.fn().mockResolvedValue(Buffer.from("mock-pdf-data"));
const mockLoadFile = jest.fn().mockResolvedValue(undefined);
const mockClose = jest.fn();

jest.mock("electron", () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: mockLoadFile,
    webContents: {
      printToPDF: mockPrintToPDF,
    },
    close: mockClose,
  })),
  app: {
    getPath: jest.fn((pathType: string) => {
      if (pathType === "downloads") return "/mock/downloads";
      if (pathType === "temp") return "/mock/temp";
      return "/mock/path";
    }),
  },
}));

// Mock fs/promises - capture HTML content for test verification
const mockWriteFile = jest.fn().mockImplementation(async (filePath: string, content: unknown) => {
  // Store HTML content for later verification if it's an HTML file
  if (typeof content === "string" && content.includes("<!DOCTYPE html>")) {
    lastLoadedHtmlContent = content;
  }
  return undefined;
});
const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockAccess = jest.fn().mockResolvedValue(undefined);
const mockCopyFile = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);

jest.mock("fs/promises", () => ({
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  access: mockAccess,
  copyFile: mockCopyFile,
  unlink: mockUnlink,
}));

// Mock logService - use factory to ensure all methods are available
jest.mock("../logService", () => {
  const mockLog = jest.fn();
  return {
    __esModule: true,
    default: {
      info: mockLog,
      warn: mockLog,
      error: mockLog,
      debug: mockLog,
      log: mockLog,
    },
  };
});

// Mock databaseService
const mockPrepare = jest.fn().mockReturnValue({
  all: jest.fn().mockReturnValue([]),
});

jest.mock("../databaseService", () => ({
  default: {
    getRawDatabase: jest.fn().mockReturnValue({
      prepare: mockPrepare,
    }),
  },
}));

import type { Communication, Transaction } from "../../types/models";

describe("FolderExportService", () => {
  let folderExportService: typeof import("../folderExportService").default;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset HTML content capture for special message type tests
    lastLoadedHtmlContent = null;

    // Reset mock implementations
    mockPrepare.mockReturnValue({
      all: jest.fn().mockReturnValue([]),
    });

    const module = await import("../folderExportService");
    folderExportService = module.default;
  });

  describe("getDefaultExportPath", () => {
    it("should generate path in downloads folder", () => {
      const transaction = {
        id: "txn-123",
        property_address: "123 Main St",
      } as Transaction;

      const result = folderExportService.getDefaultExportPath(transaction);

      expect(result).toContain("mock");
      expect(result).toContain("downloads");
      expect(result).toContain("Transaction_");
      expect(result).toContain("123_Main_St");
    });

    it("should sanitize special characters in folder name", () => {
      const transaction = {
        id: "txn-456",
        property_address: "456 Oak Ave, Unit #5/A",
      } as Transaction;

      const result = folderExportService.getDefaultExportPath(transaction);

      // Should not contain special characters
      expect(result).not.toContain(",");
      expect(result).not.toContain("#");
      expect(result).not.toMatch(/\/A/);
      expect(result).toContain("456_Oak_Ave");
    });
  });

  describe("exportTransactionToFolder - texts as PDFs", () => {
    const mockTransaction: Transaction = {
      id: "txn-test",
      user_id: "user-123",
      property_address: "123 Test St",
      transaction_type: "purchase",
      is_active: true,
      created_at: new Date().toISOString(),
    } as Transaction;

    const createTextMessage = (
      id: string,
      threadId: string,
      sender: string,
      body: string,
      direction: "inbound" | "outbound",
      participants?: string,
      sentAt?: string
    ): Communication => ({
      id,
      user_id: "user-123",
      thread_id: threadId,
      sender,
      body_text: body,
      body_plain: body,
      direction,
      participants,
      sent_at: sentAt || "2024-01-15T10:00:00Z",
      communication_type: "text",
      channel: "text",
      has_attachments: false,
      is_false_positive: false,
      created_at: new Date().toISOString(),
    } as unknown as Communication);

    it("should group messages by thread_id and export as PDFs", async () => {
      const texts: Communication[] = [
        createTextMessage("msg-1", "thread-A", "+15551234567", "Hello", "inbound"),
        createTextMessage("msg-2", "thread-A", "+15551234567", "How are you?", "inbound", undefined, "2024-01-15T10:01:00Z"),
        createTextMessage("msg-3", "thread-B", "+15559876543", "Different thread", "inbound"),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Should create texts directory (path separator varies by OS)
      const textsDirectoryCreated = mockMkdir.mock.calls.some(
        (call: unknown[]) => (call[0] as string).includes("texts")
      );
      expect(textsDirectoryCreated).toBe(true);

      // Should export 2 PDFs (2 threads) - files are named text_XXX not thread_XXX
      const textPdfCalls = mockWriteFile.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("text_") && (call[0] as string).endsWith(".pdf")
      );
      expect(textPdfCalls).toHaveLength(2);

      // Check file naming pattern
      const fileNames = textPdfCalls.map((call: unknown[]) => call[0]);
      expect(fileNames.some((f: unknown) => (f as string).includes("text_001_"))).toBe(true);
      expect(fileNames.some((f: unknown) => (f as string).includes("text_002_"))).toBe(true);
      expect(fileNames.every((f: unknown) => (f as string).endsWith(".pdf"))).toBe(true);
    });

    it("should use participants for grouping when thread_id is not available", async () => {
      const texts: Communication[] = [
        createTextMessage(
          "msg-1",
          "", // No thread_id
          "+15551234567",
          "Message 1",
          "inbound",
          JSON.stringify({ from: "+15551234567", to: ["+15550001111"] })
        ),
        createTextMessage(
          "msg-2",
          "", // No thread_id
          "+15551234567",
          "Message 2",
          "inbound",
          JSON.stringify({ from: "+15551234567", to: ["+15550001111"] })
        ),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Should export 1 PDF (same participants = same thread)
      const textPdfCalls = mockWriteFile.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("text_")
      );
      expect(textPdfCalls).toHaveLength(1);
    });

    it("should use phone number when contact name is not available", async () => {
      // When no contact names are found, the phone number should appear
      const texts: Communication[] = [
        createTextMessage("msg-1", "thread-A", "+15551234567", "Hello", "inbound"),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check that phone number is used when no contact name is found
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();
      // Phone number should appear in the conversation header
      expect(htmlContent).toContain("+15551234567");
    });

    it("should detect group chats with more than 2 participants", async () => {
      const texts: Communication[] = [
        createTextMessage(
          "msg-1",
          "thread-group",
          "+15551111111",
          "Group message",
          "inbound",
          JSON.stringify({
            from: "+15551111111",
            to: ["+15552222222", "+15553333333"],
          })
        ),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check that the HTML contains "Group Chat" badge
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();
      expect(htmlContent).toContain("Group Chat");
    });

    it("should show 'You' for outbound messages", async () => {
      const texts: Communication[] = [
        createTextMessage("msg-1", "thread-A", null as unknown as string, "Outbound message", "outbound"),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check that the HTML shows "You" as sender
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();
      expect(htmlContent).toContain(">You<");
    });

    it("should sort messages chronologically within thread", async () => {
      const texts: Communication[] = [
        createTextMessage("msg-2", "thread-A", "+15551234567", "Second", "inbound", undefined, "2024-01-15T10:05:00Z"),
        createTextMessage("msg-1", "thread-A", "+15551234567", "First", "inbound", undefined, "2024-01-15T10:00:00Z"),
        createTextMessage("msg-3", "thread-A", "+15551234567", "Third", "inbound", undefined, "2024-01-15T10:10:00Z"),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check that messages appear in order in the HTML
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();

      const firstIndex = htmlContent.indexOf("First");
      const secondIndex = htmlContent.indexOf("Second");
      const thirdIndex = htmlContent.indexOf("Third");

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    it("should include message count in header", async () => {
      const texts: Communication[] = [
        createTextMessage("msg-1", "thread-A", "+15551234567", "One", "inbound"),
        createTextMessage("msg-2", "thread-A", "+15551234567", "Two", "inbound", undefined, "2024-01-15T10:01:00Z"),
        createTextMessage("msg-3", "thread-A", "+15551234567", "Three", "inbound", undefined, "2024-01-15T10:02:00Z"),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check that the HTML contains message count
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();
      expect(htmlContent).toContain("3 messages");
    });

    it("should handle single message threads correctly", async () => {
      const texts: Communication[] = [
        createTextMessage("msg-1", "thread-single", "+15551234567", "Only message", "inbound"),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check singular form "message" not "messages"
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();
      expect(htmlContent).toContain("1 message");
      expect(htmlContent).not.toContain("1 messages");
    });

    it("should escape HTML in message content", async () => {
      const texts: Communication[] = [
        createTextMessage("msg-1", "thread-A", "+15551234567", "<script>alert('xss')</script>", "inbound"),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check that script tags are escaped
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();
      expect(htmlContent).not.toContain("<script>alert");
      expect(htmlContent).toContain("&lt;script&gt;");
    });

    it("should include timestamps for each message", async () => {
      const texts: Communication[] = [
        createTextMessage("msg-1", "thread-A", "+15551234567", "Hello", "inbound", undefined, "2024-01-15T14:30:00Z"),
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check that timestamp appears
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();
      // Should contain formatted date (e.g., "Jan 15, 2024")
      expect(htmlContent).toContain("Jan");
      expect(htmlContent).toContain("15");
      expect(htmlContent).toContain("2024");
    });
  });

  describe("PDF file naming", () => {
    const mockTransaction: Transaction = {
      id: "txn-test",
      user_id: "user-123",
      property_address: "123 Test St",
      transaction_type: "purchase",
      is_active: true,
      created_at: new Date().toISOString(),
    } as Transaction;

    it("should name files with zero-padded index", async () => {
      const texts: Communication[] = Array.from({ length: 3 }, (_, i) =>
        ({
          id: `msg-${i}`,
          user_id: "user-123",
          thread_id: `thread-${i}`,
          sender: "+1555000000" + i,
          body_text: `Message ${i}`,
          direction: "inbound",
          sent_at: "2024-01-15T10:00:00Z",
          communication_type: "text",
          channel: "text",
          has_attachments: false,
          is_false_positive: false,
          created_at: new Date().toISOString(),
        } as unknown as Communication)
      );

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      const textPdfCalls = mockWriteFile.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("text_")
      );

      const fileNames = textPdfCalls.map((call: unknown[]) => call[0] as string);
      expect(fileNames.some(f => f.includes("text_001_"))).toBe(true);
      expect(fileNames.some(f => f.includes("text_002_"))).toBe(true);
      expect(fileNames.some(f => f.includes("text_003_"))).toBe(true);
    });

    it("should include date from first message in filename", async () => {
      const texts: Communication[] = [
        {
          id: "msg-1",
          user_id: "user-123",
          thread_id: "thread-A",
          sender: "+15551234567",
          body_text: "Hello",
          direction: "inbound",
          sent_at: "2024-03-20T10:00:00Z",
          communication_type: "text",
          channel: "text",
          has_attachments: false,
          is_false_positive: false,
          created_at: new Date().toISOString(),
        } as unknown as Communication,
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      const textPdfCalls = mockWriteFile.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("text_")
      );

      expect(textPdfCalls[0][0]).toContain("2024-03-20");
    });
  });

  describe("text message attachments", () => {
    const mockTransaction: Transaction = {
      id: "txn-test",
      user_id: "user-123",
      property_address: "123 Test St",
      transaction_type: "purchase",
      is_active: true,
      created_at: new Date().toISOString(),
    } as Transaction;

    it("should include CSS styles for attachments in text thread PDF", async () => {
      // Verify that the CSS styles for attachment-image and attachment-ref are included
      const texts: Communication[] = [
        {
          id: "text-msg-1",
          user_id: "user-123",
          thread_id: "thread-A",
          sender: "+15551234567",
          body_text: "Hello",
          direction: "inbound",
          sent_at: "2024-01-15T10:00:00Z",
          communication_type: "sms",
          channel: "sms",
          has_attachments: false,
          is_false_positive: false,
          created_at: new Date().toISOString(),
        } as unknown as Communication,
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false,
        }
      );

      // Check the HTML contains the attachment CSS styles
      const htmlContent = lastLoadedHtmlContent;
      expect(htmlContent).not.toBeNull();
      expect(htmlContent).toContain(".attachment-image");
      expect(htmlContent).toContain(".attachment-ref");
    });

    it("should create texts folder when exporting text messages", async () => {
      // This test verifies that text messages are properly handled
      const texts: Communication[] = [
        {
          id: "text-msg-1",
          user_id: "user-123",
          thread_id: "thread-A",
          sender: "+15551234567",
          body_text: "Hello",
          direction: "inbound",
          sent_at: "2024-01-15T10:00:00Z",
          communication_type: "sms",
          channel: "sms",
          has_attachments: false,
          is_false_positive: false,
          created_at: new Date().toISOString(),
        } as unknown as Communication,
      ];

      await folderExportService.exportTransactionToFolder(
        mockTransaction,
        texts,
        {
          transactionId: mockTransaction.id,
          outputPath: "/mock/output",
          includeEmails: false,
          includeTexts: true,
          includeAttachments: false, // Don't include attachments to avoid DB call
        }
      );

      // Verify texts folder was created (path separator varies by OS)
      const textsDirectoryCreated = mockMkdir.mock.calls.some(
        (call: unknown[]) => (call[0] as string).includes("texts")
      );
      expect(textsDirectoryCreated).toBe(true);

      // Verify a text thread PDF was written
      const textPdfCalls = mockWriteFile.mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes("text_") && (call[0] as string).endsWith(".pdf")
      );
      expect(textPdfCalls.length).toBeGreaterThan(0);
    });
  });
});
