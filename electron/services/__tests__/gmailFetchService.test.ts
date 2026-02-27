/**
 * Unit tests for Gmail Fetch Service
 * Tests email fetching, parsing, and token handling
 *
 * NOTE: Session-only OAuth - tokens stored directly in encrypted database,
 * no separate tokenEncryptionService encryption needed
 */

import gmailFetchService from "../gmailFetchService";
import databaseService from "../databaseService";
import { google } from "googleapis";

// Mock dependencies
jest.mock("../databaseService");
jest.mock("googleapis");
jest.mock("google-auth-library");

const mockDatabaseService = databaseService as jest.Mocked<
  typeof databaseService
>;

describe("GmailFetchService", () => {
  const mockUserId = "test-user-id";
  // Session-only OAuth: tokens stored directly, not encrypted
  const mockAccessToken = "test-access-token";
  const mockRefreshToken = "test-refresh-token";

  // Mock Gmail API methods
  const mockMessagesList = jest.fn();
  const mockMessagesGet = jest.fn();
  const mockAttachmentsGet = jest.fn();
  const mockGetProfile = jest.fn();
  const mockSetCredentials = jest.fn();
  const mockOn = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup googleapis mock
    (google.auth.OAuth2 as unknown as jest.Mock).mockImplementation(() => ({
      setCredentials: mockSetCredentials,
      on: mockOn,
    }));

    (google.gmail as jest.Mock).mockReturnValue({
      users: {
        messages: {
          list: mockMessagesList,
          get: mockMessagesGet,
          attachments: {
            get: mockAttachmentsGet,
          },
        },
        getProfile: mockGetProfile,
      },
    });
  });

  describe("initialize", () => {
    // Session-only OAuth: tokens stored directly in encrypted database
    const mockTokenRecord = {
      id: "token-id",
      user_id: mockUserId,
      provider: "google" as const,
      purpose: "mailbox" as const,
      access_token: mockAccessToken,
      refresh_token: mockRefreshToken,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      connected_email_address: "test@gmail.com",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("should initialize successfully with valid tokens", async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);

      const result = await gmailFetchService.initialize(mockUserId);

      expect(result).toBe(true);
      expect(mockDatabaseService.getOAuthToken).toHaveBeenCalledWith(
        mockUserId,
        "google",
        "mailbox",
      );
      // Session-only OAuth: tokens used directly, no decryption needed
      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: mockAccessToken,
        refresh_token: mockRefreshToken,
      });
    });

    it("should throw error when no token found", async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(null);

      await expect(gmailFetchService.initialize(mockUserId)).rejects.toThrow(
        "No Gmail OAuth token found",
      );
    });

    it("should handle token without refresh token", async () => {
      const tokenWithoutRefresh = { ...mockTokenRecord, refresh_token: null };
      mockDatabaseService.getOAuthToken.mockResolvedValue(tokenWithoutRefresh);

      const result = await gmailFetchService.initialize(mockUserId);

      expect(result).toBe(true);
      // Session-only OAuth: tokens used directly
      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: mockAccessToken,
        refresh_token: null,
      });
    });

    it("should register token refresh handler", async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);

      await gmailFetchService.initialize(mockUserId);

      expect(mockOn).toHaveBeenCalledWith("tokens", expect.any(Function));
    });

    it("should handle initialization errors", async () => {
      mockDatabaseService.getOAuthToken.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(gmailFetchService.initialize(mockUserId)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("searchEmails", () => {
    // Session-only OAuth: tokens stored directly
    const mockTokenRecord = {
      id: "token-id",
      user_id: mockUserId,
      provider: "google" as const,
      purpose: "mailbox" as const,
      access_token: mockAccessToken,
      refresh_token: mockRefreshToken,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      connected_email_address: "test@gmail.com",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockMessageResponse = {
      data: {
        messages: [{ id: "msg-1" }, { id: "msg-2" }],
      },
    };

    const mockFullMessage = {
      data: {
        id: "msg-1",
        threadId: "thread-1",
        internalDate: "1700000000000",
        snippet: "Email snippet",
        labelIds: ["INBOX"],
        payload: {
          headers: [
            { name: "Subject", value: "Test Subject" },
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "recipient@example.com" },
            { name: "Cc", value: "cc@example.com" },
          ],
          mimeType: "text/plain",
          body: {
            data: Buffer.from("Email body text").toString("base64"),
          },
        },
      },
    };

    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockMessagesList.mockResolvedValue(mockMessageResponse);
      mockMessagesGet.mockResolvedValue(mockFullMessage);
      await gmailFetchService.initialize(mockUserId);
    });

    it("should search emails with basic query", async () => {
      const results = await gmailFetchService.searchEmails({ query: "test" });

      expect(mockMessagesList).toHaveBeenCalledWith({
        userId: "me",
        q: "test",
        maxResults: 100,
      });
      expect(results).toHaveLength(2);
    });

    it("should search emails with date filters", async () => {
      const after = new Date("2024-01-01");
      const before = new Date("2024-12-31");

      await gmailFetchService.searchEmails({ query: "test", after, before });

      const expectedAfter = Math.floor(after.getTime() / 1000);

      expect(mockMessagesList).toHaveBeenCalledWith({
        userId: "me",
        q: expect.stringContaining(`after:${expectedAfter}`),
        maxResults: 100,
      });
    });

    it("should respect maxResults parameter", async () => {
      await gmailFetchService.searchEmails({ maxResults: 50 });

      expect(mockMessagesList).toHaveBeenCalledWith({
        userId: "me",
        q: "",
        maxResults: 50,
      });
    });

    it("should handle empty search results", async () => {
      mockMessagesList.mockResolvedValue({ data: { messages: [] } });

      const results = await gmailFetchService.searchEmails({});

      expect(results).toHaveLength(0);
    });

    it("should handle no messages in response", async () => {
      mockMessagesList.mockResolvedValue({ data: {} });

      const results = await gmailFetchService.searchEmails({});

      expect(results).toHaveLength(0);
    });

    it("should throw error when not initialized", async () => {
      // Reset the service (create new instance behavior)
      const uninitializedService = Object.create(
        Object.getPrototypeOf(gmailFetchService),
      );
      uninitializedService.gmail = null;

      await expect(uninitializedService.searchEmails({})).rejects.toThrow(
        "Gmail API not initialized",
      );
    });

    it("should parse email headers correctly", async () => {
      const results = await gmailFetchService.searchEmails({});

      expect(results[0]).toMatchObject({
        id: "msg-1",
        threadId: "thread-1",
        subject: "Test Subject",
        from: "sender@example.com",
        to: "recipient@example.com",
        cc: "cc@example.com",
        snippet: "Email snippet",
      });
    });
  });

  describe("getEmailById", () => {
    const mockTokenRecord = {
      id: "token-id",
      user_id: mockUserId,
      provider: "google" as const,
      purpose: "mailbox" as const,
      access_token: mockAccessToken,
      refresh_token: mockRefreshToken,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      connected_email_address: "test@gmail.com",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await gmailFetchService.initialize(mockUserId);
    });

    it("should fetch single email by ID", async () => {
      const mockMessage = {
        data: {
          id: "msg-123",
          threadId: "thread-123",
          internalDate: "1700000000000",
          snippet: "Test snippet",
          labelIds: ["INBOX"],
          payload: {
            headers: [{ name: "Subject", value: "Test Email" }],
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      };
      mockMessagesGet.mockResolvedValue(mockMessage);

      const result = await gmailFetchService.getEmailById("msg-123");

      expect(mockMessagesGet).toHaveBeenCalledWith({
        userId: "me",
        id: "msg-123",
        format: "full",
      });
      expect(result.id).toBe("msg-123");
      expect(result.subject).toBe("Test Email");
    });

    it("should handle API errors", async () => {
      mockMessagesGet.mockRejectedValue(new Error("API Error"));

      await expect(
        gmailFetchService.getEmailById("invalid-id"),
      ).rejects.toThrow("API Error");
    });
  });

  describe("_parseMessage - email body extraction", () => {
    const mockTokenRecord = {
      id: "token-id",
      user_id: mockUserId,
      provider: "google" as const,
      purpose: "mailbox" as const,
      access_token: mockAccessToken,
      refresh_token: mockRefreshToken,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      connected_email_address: "test@gmail.com",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockMessagesList.mockResolvedValue({
        data: { messages: [{ id: "msg-1" }] },
      });
      await gmailFetchService.initialize(mockUserId);
    });

    it("should extract plain text body", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            mimeType: "text/plain",
            body: { data: Buffer.from("Plain text body").toString("base64") },
            headers: [],
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].bodyPlain).toBe("Plain text body");
    });

    it("should extract HTML body from multipart message", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            mimeType: "multipart/alternative",
            headers: [],
            parts: [
              {
                mimeType: "text/plain",
                body: { data: Buffer.from("Plain version").toString("base64") },
              },
              {
                mimeType: "text/html",
                body: {
                  data: Buffer.from("<p>HTML version</p>").toString("base64"),
                },
              },
            ],
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].body).toBe("<p>HTML version</p>");
      expect(results[0].bodyPlain).toBe("Plain version");
    });

    it("should extract attachments from message", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            mimeType: "multipart/mixed",
            headers: [],
            parts: [
              {
                mimeType: "text/plain",
                body: { data: Buffer.from("Email text").toString("base64") },
              },
              {
                filename: "document.pdf",
                mimeType: "application/pdf",
                body: {
                  attachmentId: "att-123",
                  size: 1024,
                },
              },
            ],
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].hasAttachments).toBe(true);
      expect(results[0].attachmentCount).toBe(1);
      expect(results[0].attachments[0]).toMatchObject({
        filename: "document.pdf",
        mimeType: "application/pdf",
        attachmentId: "att-123",
        size: 1024,
      });
    });

    it("should handle missing headers gracefully", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            headers: [], // No headers
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].subject).toBeNull();
      expect(results[0].from).toBeNull();
      expect(results[0].to).toBeNull();
    });
  });

  describe("getAttachment", () => {
    const mockTokenRecord = {
      id: "token-id",
      user_id: mockUserId,
      provider: "google" as const,
      purpose: "mailbox" as const,
      access_token: mockAccessToken,
      refresh_token: mockRefreshToken,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      connected_email_address: "test@gmail.com",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await gmailFetchService.initialize(mockUserId);
    });

    it("should fetch attachment data", async () => {
      const attachmentData =
        Buffer.from("attachment content").toString("base64");
      mockAttachmentsGet.mockResolvedValue({
        data: { data: attachmentData },
      });

      const result = await gmailFetchService.getAttachment(
        "msg-123",
        "att-456",
      );

      expect(mockAttachmentsGet).toHaveBeenCalledWith({
        userId: "me",
        messageId: "msg-123",
        id: "att-456",
      });
      expect(result.toString()).toBe("attachment content");
    });

    it("should handle attachment fetch errors", async () => {
      mockAttachmentsGet.mockRejectedValue(new Error("Attachment not found"));

      await expect(
        gmailFetchService.getAttachment("msg-123", "invalid"),
      ).rejects.toThrow("Attachment not found");
    });
  });

  describe("getUserEmail", () => {
    const mockTokenRecord = {
      id: "token-id",
      user_id: mockUserId,
      provider: "google" as const,
      purpose: "mailbox" as const,
      access_token: mockAccessToken,
      refresh_token: mockRefreshToken,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      connected_email_address: "test@gmail.com",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await gmailFetchService.initialize(mockUserId);
    });

    it("should return user email address", async () => {
      mockGetProfile.mockResolvedValue({
        data: { emailAddress: "user@gmail.com" },
      });

      const email = await gmailFetchService.getUserEmail();

      expect(email).toBe("user@gmail.com");
      expect(mockGetProfile).toHaveBeenCalledWith({ userId: "me" });
    });

    it("should return empty string if email not found", async () => {
      mockGetProfile.mockResolvedValue({ data: {} });

      const email = await gmailFetchService.getUserEmail();

      expect(email).toBe("");
    });

    it("should handle profile fetch errors", async () => {
      mockGetProfile.mockRejectedValue(new Error("Profile error"));

      await expect(gmailFetchService.getUserEmail()).rejects.toThrow(
        "Profile error",
      );
    });
  });

  describe("Message-ID header extraction", () => {
    const mockTokenRecord = {
      id: "token-id",
      user_id: mockUserId,
      provider: "google" as const,
      purpose: "mailbox" as const,
      access_token: mockAccessToken,
      refresh_token: mockRefreshToken,
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      connected_email_address: "test@gmail.com",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      mockMessagesList.mockResolvedValue({
        data: { messages: [{ id: "msg-1" }] },
      });
      await gmailFetchService.initialize(mockUserId);
    });

    it("should extract Message-ID header with angle brackets", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            headers: [
              { name: "Subject", value: "Test Subject" },
              { name: "Message-ID", value: "<unique-id-123@mail.gmail.com>" },
            ],
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].messageIdHeader).toBe("<unique-id-123@mail.gmail.com>");
    });

    it("should handle case-insensitive Message-ID header name", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            headers: [
              { name: "message-id", value: "<lowercase@example.com>" },
            ],
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].messageIdHeader).toBe("<lowercase@example.com>");
    });

    it("should handle Message-Id mixed case header name", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            headers: [
              { name: "Message-Id", value: "<mixed-case@example.com>" },
            ],
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].messageIdHeader).toBe("<mixed-case@example.com>");
    });

    it("should return null when Message-ID header is missing", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            headers: [
              { name: "Subject", value: "No Message-ID" },
              { name: "From", value: "sender@example.com" },
            ],
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].messageIdHeader).toBeNull();
    });

    it("should return null when headers array is empty", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            headers: [],
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].messageIdHeader).toBeNull();
    });

    it("should use first Message-ID when duplicates exist", async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            headers: [
              { name: "Message-ID", value: "<first@example.com>" },
              { name: "Message-ID", value: "<second@example.com>" },
            ],
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].messageIdHeader).toBe("<first@example.com>");
    });

    it("should preserve Message-ID with special characters", async () => {
      const specialMessageId =
        "<CAD+XH4s=BKDQRKRm+_dK3sEq@mail.gmail.com>";
      mockMessagesGet.mockResolvedValue({
        data: {
          id: "msg-1",
          threadId: "thread-1",
          internalDate: "1700000000000",
          payload: {
            headers: [{ name: "Message-ID", value: specialMessageId }],
            mimeType: "text/plain",
            body: { data: Buffer.from("Body").toString("base64") },
          },
        },
      });

      const results = await gmailFetchService.searchEmails({});

      expect(results[0].messageIdHeader).toBe(specialMessageId);
    });
  });
});
