/**
 * iPhoneSyncStorageService - ACID Rollback Unit Tests
 *
 * Tests for the rollback logic added in TASK-2110b:
 * - rollbackSession() (tested indirectly through persistSyncResult)
 * - Cancel signal at different phases
 * - Content-addressed file safety (orphaned file detection)
 * - cancelledResult() output format
 */

// Polyfill setImmediate for Jest (used by yieldToEventLoop)
if (typeof globalThis.setImmediate === "undefined") {
  (globalThis as unknown as Record<string, unknown>).setImmediate = (fn: () => void) => setTimeout(fn, 0);
}

// Mock electron before any imports
jest.mock("electron", () => ({
  app: {
    getPath: jest.fn().mockReturnValue("/mock/userData"),
  },
}));

jest.mock("electron-log", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    promises: {
      unlink: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
      stat: jest.fn().mockResolvedValue({ size: 1024 }),
      copyFile: jest.fn().mockResolvedValue(undefined),
    },
    createReadStream: jest.fn(),
  };
});

jest.mock("../databaseService");
jest.mock("../db/externalContactDbService");
jest.mock("../iosMessagesParser", () => ({
  iOSMessagesParser: {
    resolveAttachmentPath: jest.fn(),
  },
}));
jest.mock("../../utils/messageTypeDetector", () => ({
  detectMessageType: jest.fn().mockReturnValue("text"),
}));
jest.mock("../../utils/preferenceHelper", () => ({
  isContactSourceEnabled: jest.fn().mockResolvedValue(true),
}));

import fs from "fs";
import databaseService from "../databaseService";
import * as externalContactDb from "../db/externalContactDbService";
import { iPhoneSyncStorageService } from "../iPhoneSyncStorageService";
import type { SyncResult } from "../deviceSyncOrchestrator";
import type { iOSMessage, iOSConversation } from "../../types/iosMessages";
import type { iOSContact } from "../../types/iosContacts";

// Type the mocks
const mockDbService = databaseService as jest.Mocked<typeof databaseService>;
const mockExternalContactDb = externalContactDb as jest.Mocked<typeof externalContactDb>;
const mockFsPromises = fs.promises as jest.Mocked<typeof fs.promises>;

// ============================================
// Test Fixtures
// ============================================

function makeSyncResult(overrides?: Partial<SyncResult>): SyncResult {
  return {
    success: true,
    messages: [],
    contacts: [],
    conversations: [],
    error: null,
    duration: 100,
    ...overrides,
  };
}

function makeMessage(id: number, guid: string): iOSMessage {
  return {
    id,
    guid,
    text: `Test message ${id}`,
    handle: "+15551234567",
    isFromMe: false,
    date: new Date("2024-01-01T10:00:00Z"),
    dateRead: null,
    dateDelivered: null,
    isRead: true,
    attachments: [],
    chatId: 1,
    service: "iMessage",
  } as iOSMessage;
}

function makeConversation(chatId: number, messages: iOSMessage[]): iOSConversation {
  return {
    chatId,
    guid: `chat-guid-${chatId}`,
    displayName: "Test Chat",
    participants: ["+15551234567"],
    lastMessageDate: new Date("2024-01-01T10:00:00Z"),
    messageCount: messages.length,
    isGroupChat: false,
    messages,
  };
}

function makeContact(id: number): iOSContact {
  return {
    id,
    firstName: `First${id}`,
    lastName: `Last${id}`,
    displayName: `First${id} Last${id}`,
    organization: null,
    phoneNumbers: [{ label: "mobile", number: "+15551234567", normalizedNumber: "+15551234567" }],
    emails: [{ label: "home", email: `test${id}@example.com` }],
  };
}

// ============================================
// Setup
// ============================================

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock implementations for database service
  mockDbService.getExistingMessageExternalIds.mockReturnValue(new Set<string>());
  mockDbService.batchInsertMessages.mockReturnValue({ stored: 0, skipped: 0 });
  mockDbService.deleteAttachmentsBySessionId.mockReturnValue({
    deleted: 0,
    orphanedFiles: [],
  });
  mockDbService.deleteMessagesBySessionId.mockReturnValue(0);
  mockExternalContactDb.deleteBySessionId.mockReturnValue(0);
  mockExternalContactDb.upsertFromiPhone.mockReturnValue(0);
});

// ============================================
// 1. rollbackSession() via persistSyncResult()
// ============================================

describe("rollbackSession (via persistSyncResult)", () => {
  it("should call rollback and return cancelled result when cancel signal is set after messages phase", async () => {
    const cancelSignal = { cancelled: false };
    const messages = [makeMessage(1, "guid-1"), makeMessage(2, "guid-2")];
    const conversations = [makeConversation(1, messages)];

    mockDbService.batchInsertMessages.mockReturnValue({ stored: 2, skipped: 0 });
    // Simulate cancel happening after messages are stored
    mockDbService.batchInsertMessages.mockImplementation(() => {
      cancelSignal.cancelled = true;
      return { stored: 2, skipped: 0 };
    });

    mockDbService.deleteAttachmentsBySessionId.mockReturnValue({
      deleted: 0,
      orphanedFiles: [],
    });
    mockDbService.deleteMessagesBySessionId.mockReturnValue(2);
    mockExternalContactDb.deleteBySessionId.mockReturnValue(0);

    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations }),
      undefined,
      undefined,
      "session-123",
      cancelSignal
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Sync cancelled by user");
    expect(result.messagesStored).toBe(0);

    // Verify rollback was called
    expect(mockDbService.deleteAttachmentsBySessionId).toHaveBeenCalledWith("session-123");
    expect(mockDbService.deleteMessagesBySessionId).toHaveBeenCalledWith("user-1", "session-123");
    expect(mockExternalContactDb.deleteBySessionId).toHaveBeenCalledWith("user-1", "session-123");
  });

  it("should delete orphaned files from disk during rollback", async () => {
    const cancelSignal = { cancelled: false };
    const messages = [makeMessage(1, "guid-1")];
    const conversations = [makeConversation(1, messages)];

    // Cancel after messages phase
    mockDbService.batchInsertMessages.mockImplementation(() => {
      cancelSignal.cancelled = true;
      return { stored: 1, skipped: 0 };
    });

    mockDbService.deleteAttachmentsBySessionId.mockReturnValue({
      deleted: 3,
      orphanedFiles: ["/mock/path/file1.jpg", "/mock/path/file2.png", "/mock/path/file3.pdf"],
    });

    await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations }),
      undefined,
      undefined,
      "session-456",
      cancelSignal
    );

    // Verify each orphaned file was deleted
    expect(mockFsPromises.unlink).toHaveBeenCalledTimes(3);
    expect(mockFsPromises.unlink).toHaveBeenCalledWith("/mock/path/file1.jpg");
    expect(mockFsPromises.unlink).toHaveBeenCalledWith("/mock/path/file2.png");
    expect(mockFsPromises.unlink).toHaveBeenCalledWith("/mock/path/file3.pdf");
  });

  it("should skip rollback when no sessionId is provided", async () => {
    const cancelSignal = { cancelled: false };
    const messages = [makeMessage(1, "guid-1")];
    const conversations = [makeConversation(1, messages)];

    // Cancel after messages phase but with no sessionId
    mockDbService.batchInsertMessages.mockImplementation(() => {
      cancelSignal.cancelled = true;
      return { stored: 1, skipped: 0 };
    });

    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations }),
      undefined,
      undefined,
      undefined, // no sessionId
      cancelSignal
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Sync cancelled by user");

    // rollback should NOT call delete methods (no sessionId)
    expect(mockDbService.deleteAttachmentsBySessionId).not.toHaveBeenCalled();
    expect(mockDbService.deleteMessagesBySessionId).not.toHaveBeenCalled();
    expect(mockExternalContactDb.deleteBySessionId).not.toHaveBeenCalled();
  });

  it("should handle rollback errors gracefully (log but don't throw)", async () => {
    const cancelSignal = { cancelled: false };
    const messages = [makeMessage(1, "guid-1")];
    const conversations = [makeConversation(1, messages)];

    // Cancel after messages
    mockDbService.batchInsertMessages.mockImplementation(() => {
      cancelSignal.cancelled = true;
      return { stored: 1, skipped: 0 };
    });

    // Make rollback throw
    mockDbService.deleteAttachmentsBySessionId.mockImplementation(() => {
      throw new Error("DB locked");
    });

    // Should NOT throw - rollback catches errors internally
    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations }),
      undefined,
      undefined,
      "session-err",
      cancelSignal
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Sync cancelled by user");
  });
});

// ============================================
// 2. Cancel signal timing
// ============================================

describe("cancel signal timing", () => {
  it("should return cancelled result immediately when cancelled before messages phase", async () => {
    const cancelSignal = { cancelled: true }; // Already cancelled

    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages: [makeMessage(1, "guid-1")] }),
      undefined,
      undefined,
      "session-pre",
      cancelSignal
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Sync cancelled by user");
    expect(result.messagesStored).toBe(0);
    expect(result.contactsStored).toBe(0);
    expect(result.attachmentsStored).toBe(0);

    // No DB operations should have been called at all
    expect(mockDbService.getExistingMessageExternalIds).not.toHaveBeenCalled();
    expect(mockDbService.batchInsertMessages).not.toHaveBeenCalled();

    // No rollback needed since nothing was stored
    expect(mockDbService.deleteAttachmentsBySessionId).not.toHaveBeenCalled();
    expect(mockDbService.deleteMessagesBySessionId).not.toHaveBeenCalled();
  });

  it("should cancel between messages and contacts, rolling back messages", async () => {
    const cancelSignal = { cancelled: false };
    const messages = [makeMessage(1, "guid-1")];
    const conversations = [makeConversation(1, messages)];

    // Cancel after storeMessages completes (batchInsertMessages triggers cancel)
    mockDbService.batchInsertMessages.mockImplementation(() => {
      cancelSignal.cancelled = true;
      return { stored: 1, skipped: 0 };
    });

    mockDbService.deleteAttachmentsBySessionId.mockReturnValue({ deleted: 0, orphanedFiles: [] });
    mockDbService.deleteMessagesBySessionId.mockReturnValue(1);
    mockExternalContactDb.deleteBySessionId.mockReturnValue(0);

    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations, contacts: [makeContact(1)] }),
      undefined,
      undefined,
      "session-mid1",
      cancelSignal
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Sync cancelled by user");

    // Rollback should have been called
    expect(mockDbService.deleteMessagesBySessionId).toHaveBeenCalledWith("user-1", "session-mid1");

    // Contacts should NOT have been stored (cancel happened before contact phase)
    expect(mockExternalContactDb.upsertFromiPhone).not.toHaveBeenCalled();
  });

  it("should cancel between contacts and attachments, rolling back messages + contacts", async () => {
    const cancelSignal = { cancelled: false };
    const messages = [makeMessage(1, "guid-1")];
    const conversations = [makeConversation(1, messages)];
    const contacts = [makeContact(1)];

    mockDbService.batchInsertMessages.mockReturnValue({ stored: 1, skipped: 0 });

    // Cancel after storeContacts completes
    mockExternalContactDb.upsertFromiPhone.mockImplementation(() => {
      cancelSignal.cancelled = true;
      return 1;
    });

    mockDbService.deleteAttachmentsBySessionId.mockReturnValue({ deleted: 0, orphanedFiles: [] });
    mockDbService.deleteMessagesBySessionId.mockReturnValue(1);
    mockExternalContactDb.deleteBySessionId.mockReturnValue(1);

    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations, contacts }),
      undefined,
      undefined,
      "session-mid2",
      cancelSignal
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Sync cancelled by user");

    // Both messages and contacts should be rolled back
    expect(mockDbService.deleteMessagesBySessionId).toHaveBeenCalledWith("user-1", "session-mid2");
    expect(mockExternalContactDb.deleteBySessionId).toHaveBeenCalledWith("user-1", "session-mid2");
  });
});

// ============================================
// 3. Content-addressed file safety
// ============================================

describe("content-addressed file safety", () => {
  it("should only delete orphaned files, not files shared across sessions", async () => {
    const cancelSignal = { cancelled: false };
    const messages = [makeMessage(1, "guid-1")];
    const conversations = [makeConversation(1, messages)];

    // Cancel after messages
    mockDbService.batchInsertMessages.mockImplementation(() => {
      cancelSignal.cancelled = true;
      return { stored: 1, skipped: 0 };
    });

    // deleteAttachmentsBySessionId returns ONLY orphaned files
    // Files shared with other sessions are NOT in this list
    mockDbService.deleteAttachmentsBySessionId.mockReturnValue({
      deleted: 5,
      orphanedFiles: ["/mock/path/orphan1.jpg"], // Only 1 of 5 is orphaned
    });

    await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations }),
      undefined,
      undefined,
      "session-files",
      cancelSignal
    );

    // Only the orphaned file should be unlinked
    expect(mockFsPromises.unlink).toHaveBeenCalledTimes(1);
    expect(mockFsPromises.unlink).toHaveBeenCalledWith("/mock/path/orphan1.jpg");
  });

  it("should handle file deletion errors gracefully (file already deleted)", async () => {
    const cancelSignal = { cancelled: false };
    const messages = [makeMessage(1, "guid-1")];
    const conversations = [makeConversation(1, messages)];

    mockDbService.batchInsertMessages.mockImplementation(() => {
      cancelSignal.cancelled = true;
      return { stored: 1, skipped: 0 };
    });

    mockDbService.deleteAttachmentsBySessionId.mockReturnValue({
      deleted: 2,
      orphanedFiles: ["/mock/path/already-gone.jpg", "/mock/path/exists.jpg"],
    });

    // First file fails (already deleted), second succeeds
    (mockFsPromises.unlink as jest.Mock)
      .mockRejectedValueOnce(new Error("ENOENT: no such file"))
      .mockResolvedValueOnce(undefined);

    // Should NOT throw
    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations }),
      undefined,
      undefined,
      "session-enoent",
      cancelSignal
    );

    expect(result.success).toBe(false);
    // Both unlink calls should have been attempted
    expect(mockFsPromises.unlink).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// 4. cancelledResult()
// ============================================

describe("cancelledResult (via persistSyncResult)", () => {
  it("should return PersistResult with success=false and all counts 0", async () => {
    const cancelSignal = { cancelled: true };

    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult(),
      undefined,
      undefined,
      "session-cancel",
      cancelSignal
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        messagesStored: 0,
        messagesSkipped: 0,
        contactsStored: 0,
        contactsSkipped: 0,
        attachmentsStored: 0,
        attachmentsSkipped: 0,
        error: "Sync cancelled by user",
      })
    );
    expect(typeof result.duration).toBe("number");
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// 5. Successful persistence (no cancel)
// ============================================

describe("persistSyncResult without cancel", () => {
  it("should return success when no cancel signal is set", async () => {
    const messages = [makeMessage(1, "guid-1")];
    const conversations = [makeConversation(1, messages)];

    mockDbService.batchInsertMessages.mockReturnValue({ stored: 1, skipped: 0 });
    mockExternalContactDb.upsertFromiPhone.mockReturnValue(0);

    const result = await iPhoneSyncStorageService.persistSyncResult(
      "user-1",
      makeSyncResult({ messages, conversations }),
      undefined,
      undefined,
      "session-ok"
    );

    expect(result.success).toBe(true);
    expect(result.messagesStored).toBe(1);
    expect(result.error).toBeUndefined();

    // No rollback should have been called
    expect(mockDbService.deleteAttachmentsBySessionId).not.toHaveBeenCalled();
    expect(mockDbService.deleteMessagesBySessionId).not.toHaveBeenCalled();
  });
});
