/**
 * Unit tests for Outlook Fetch Service
 * Tests email fetching from Microsoft Graph API
 *
 * NOTE: Session-only OAuth - tokens stored directly in encrypted database,
 * no separate tokenEncryptionService encryption needed
 */

import outlookFetchService from "../outlookFetchService";
import databaseService from "../databaseService";
import microsoftAuthService from "../microsoftAuthService";
import axios from "axios";

// Mock dependencies
jest.mock("../databaseService");
jest.mock("../microsoftAuthService");
jest.mock("axios");

const mockDatabaseService = databaseService as jest.Mocked<
  typeof databaseService
>;
const mockMicrosoftAuthService = microsoftAuthService as jest.Mocked<
  typeof microsoftAuthService
>;
const mockAxios = axios as jest.MockedFunction<typeof axios>;

describe("OutlookFetchService", () => {
  const mockUserId = "test-user-id";
  // Session-only OAuth: tokens stored directly, not encrypted
  const mockAccessToken = "test-access-token";

  const mockTokenRecord = {
    id: "token-id",
    user_id: mockUserId,
    provider: "microsoft" as const,
    purpose: "mailbox" as const,
    access_token: mockAccessToken,
    refresh_token: "test-refresh-token",
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
    connected_email_address: "test@outlook.com",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initialize", () => {
    it("should initialize successfully with valid tokens", async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);

      const result = await outlookFetchService.initialize(mockUserId);

      expect(result).toBe(true);
      expect(mockDatabaseService.getOAuthToken).toHaveBeenCalledWith(
        mockUserId,
        "microsoft",
        "mailbox",
      );
      // Session-only OAuth: tokens used directly, no decryption needed
    });

    it("should throw error when no token found", async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(null);

      await expect(outlookFetchService.initialize(mockUserId)).rejects.toThrow(
        "No Outlook OAuth token found",
      );
    });

    it("should handle database errors", async () => {
      mockDatabaseService.getOAuthToken.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(outlookFetchService.initialize(mockUserId)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("searchEmails", () => {
    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await outlookFetchService.initialize(mockUserId);
    });

    it("should search emails with basic query", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          conversationId: "conv-1",
          subject: "Test Email 1",
          from: {
            emailAddress: { address: "sender@example.com", name: "Sender" },
          },
          toRecipients: [
            { emailAddress: { address: "recipient@example.com" } },
          ],
          receivedDateTime: "2024-01-15T10:00:00Z",
          sentDateTime: "2024-01-15T09:59:00Z",
          hasAttachments: false,
          body: { content: "Email body", contentType: "text" },
          bodyPreview: "Email body preview",
        },
      ];

      mockAxios.mockResolvedValue({ data: { value: mockMessages } });

      const results = await outlookFetchService.searchEmails({ query: "test" });

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        }),
      );
      expect(results).toHaveLength(1);
      expect(results[0].subject).toBe("Test Email 1");
    });

    it("should search emails with date filters", async () => {
      mockAxios.mockResolvedValue({ data: { value: [] } });

      const after = new Date("2024-01-01");
      const before = new Date("2024-12-31");

      await outlookFetchService.searchEmails({ after, before });

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("receivedDateTime ge"),
        }),
      );
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("receivedDateTime le"),
        }),
      );
    });

    it("should respect maxResults parameter", async () => {
      // Create mock messages
      const mockMessages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        subject: `Test ${i}`,
        conversationId: `conv-${i}`,
        from: { emailAddress: { address: "test@example.com" } },
        toRecipients: [],
        receivedDateTime: "2024-01-01T00:00:00Z",
        sentDateTime: "2024-01-01T00:00:00Z",
        hasAttachments: false,
      }));
      mockAxios.mockResolvedValue({ data: { value: mockMessages } });

      // Request only 50 results
      const results = await outlookFetchService.searchEmails({
        maxResults: 50,
      });

      // Should return only 50 results even though 100 were fetched
      expect(results).toHaveLength(50);
    });

    it("should handle empty search results", async () => {
      mockAxios.mockResolvedValue({ data: { value: [] } });

      const results = await outlookFetchService.searchEmails({});

      expect(results).toHaveLength(0);
    });

    it("should handle missing value in response", async () => {
      mockAxios.mockResolvedValue({ data: {} });

      const results = await outlookFetchService.searchEmails({});

      expect(results).toHaveLength(0);
    });

    it("should throw error when not initialized", async () => {
      // Create uninitialized service state
      const uninitializedService = Object.create(
        Object.getPrototypeOf(outlookFetchService),
      );
      uninitializedService.accessToken = null;

      await expect(uninitializedService.searchEmails({})).rejects.toThrow(
        "Outlook API not initialized",
      );
    });

    it("should handle API errors", async () => {
      mockAxios.mockRejectedValue(new Error("API Error"));

      await expect(outlookFetchService.searchEmails({})).rejects.toThrow(
        "API Error",
      );
    });

    it("should handle 401 unauthorized errors with token refresh failure", async () => {
      const error = {
        response: { status: 401 },
        message: "Unauthorized",
      };
      mockAxios.mockRejectedValue(error);
      // Mock token refresh to fail
      mockMicrosoftAuthService.refreshToken.mockRejectedValue(
        new Error("Token refresh failed"),
      );

      await expect(outlookFetchService.searchEmails({})).rejects.toThrow(
        "Microsoft access token expired and refresh failed. Please reconnect Outlook.",
      );
    });

    it("should retry request after successful token refresh", async () => {
      const error401 = {
        response: { status: 401 },
        message: "Unauthorized",
      };
      // searchEmails makes multiple requests: first for count, then for data
      // All requests initially fail with 401, then succeed after refresh
      let callCount = 0;
      mockAxios.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // First two calls fail (count + data request)
          return Promise.reject(error401);
        }
        // After refresh, return empty results
        return Promise.resolve({ data: { value: [], "@odata.count": 0 } });
      });

      // Mock successful token refresh
      mockMicrosoftAuthService.refreshToken.mockResolvedValue({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        scope: "Mail.Read",
      });
      mockDatabaseService.saveOAuthToken.mockResolvedValue("token-id");

      const results = await outlookFetchService.searchEmails({});

      expect(results).toHaveLength(0);
      expect(mockMicrosoftAuthService.refreshToken).toHaveBeenCalled();
      expect(mockDatabaseService.saveOAuthToken).toHaveBeenCalled();
    });
  });

  describe("_parseMessage - email parsing", () => {
    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await outlookFetchService.initialize(mockUserId);
    });

    it("should parse email with all recipients", async () => {
      const mockMessage = {
        id: "msg-1",
        conversationId: "conv-1",
        subject: "Test Subject",
        from: { emailAddress: { address: "sender@example.com" } },
        toRecipients: [
          { emailAddress: { address: "to1@example.com" } },
          { emailAddress: { address: "to2@example.com" } },
        ],
        ccRecipients: [{ emailAddress: { address: "cc@example.com" } }],
        bccRecipients: [{ emailAddress: { address: "bcc@example.com" } }],
        receivedDateTime: "2024-01-15T10:00:00Z",
        sentDateTime: "2024-01-15T09:59:00Z",
        hasAttachments: true,
        body: { content: "<p>HTML body</p>", contentType: "html" },
        bodyPreview: "Preview text",
      };

      mockAxios.mockResolvedValue({ data: { value: [mockMessage] } });

      const results = await outlookFetchService.searchEmails({});

      expect(results[0].from).toBe("sender@example.com");
      expect(results[0].to).toBe("to1@example.com, to2@example.com");
      expect(results[0].cc).toBe("cc@example.com");
      expect(results[0].bcc).toBe("bcc@example.com");
    });

    it("should handle missing sender", async () => {
      const mockMessage = {
        id: "msg-1",
        conversationId: "conv-1",
        subject: "Test",
        from: null,
        receivedDateTime: "2024-01-15T10:00:00Z",
        sentDateTime: "2024-01-15T09:59:00Z",
        hasAttachments: false,
      };

      mockAxios.mockResolvedValue({ data: { value: [mockMessage] } });

      const results = await outlookFetchService.searchEmails({});

      expect(results[0].from).toBeNull();
    });

    it("should handle plain text body", async () => {
      const mockMessage = {
        id: "msg-1",
        conversationId: "conv-1",
        subject: "Test",
        receivedDateTime: "2024-01-15T10:00:00Z",
        sentDateTime: "2024-01-15T09:59:00Z",
        hasAttachments: false,
        body: { content: "Plain text content", contentType: "text" },
        bodyPreview: "Preview",
      };

      mockAxios.mockResolvedValue({ data: { value: [mockMessage] } });

      const results = await outlookFetchService.searchEmails({});

      expect(results[0].bodyPlain).toBe("Plain text content");
    });

    it("should use bodyPreview for HTML emails", async () => {
      const mockMessage = {
        id: "msg-1",
        conversationId: "conv-1",
        subject: "Test",
        receivedDateTime: "2024-01-15T10:00:00Z",
        sentDateTime: "2024-01-15T09:59:00Z",
        hasAttachments: false,
        body: { content: "<p>HTML</p>", contentType: "html" },
        bodyPreview: "Preview text for plain",
      };

      mockAxios.mockResolvedValue({ data: { value: [mockMessage] } });

      const results = await outlookFetchService.searchEmails({});

      expect(results[0].bodyPlain).toBe("Preview text for plain");
    });

    it("should handle missing body", async () => {
      const mockMessage = {
        id: "msg-1",
        conversationId: "conv-1",
        subject: "Test",
        receivedDateTime: "2024-01-15T10:00:00Z",
        sentDateTime: "2024-01-15T09:59:00Z",
        hasAttachments: false,
        body: null,
      };

      mockAxios.mockResolvedValue({ data: { value: [mockMessage] } });

      const results = await outlookFetchService.searchEmails({});

      expect(results[0].body).toBe("");
      expect(results[0].bodyPlain).toBe("");
    });
  });

  describe("getEmailById", () => {
    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await outlookFetchService.initialize(mockUserId);
    });

    it("should fetch single email by ID", async () => {
      const mockMessage = {
        id: "msg-123",
        conversationId: "conv-123",
        subject: "Specific Email",
        receivedDateTime: "2024-01-15T10:00:00Z",
        sentDateTime: "2024-01-15T09:59:00Z",
        hasAttachments: false,
      };

      mockAxios.mockResolvedValue({ data: mockMessage });

      const result = await outlookFetchService.getEmailById("msg-123");

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/me/messages/msg-123"),
        }),
      );
      expect(result.id).toBe("msg-123");
      expect(result.subject).toBe("Specific Email");
    });

    it("should handle fetch errors", async () => {
      mockAxios.mockRejectedValue(new Error("Message not found"));

      await expect(
        outlookFetchService.getEmailById("invalid-id"),
      ).rejects.toThrow("Message not found");
    });
  });

  describe("getAttachments", () => {
    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await outlookFetchService.initialize(mockUserId);
    });

    it("should fetch all attachments for a message", async () => {
      const mockAttachments = [
        {
          id: "att-1",
          name: "doc.pdf",
          contentType: "application/pdf",
          size: 1024,
        },
        {
          id: "att-2",
          name: "image.jpg",
          contentType: "image/jpeg",
          size: 2048,
        },
      ];

      mockAxios.mockResolvedValue({ data: { value: mockAttachments } });

      const result = await outlookFetchService.getAttachments("msg-123");

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/me/messages/msg-123/attachments"),
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("doc.pdf");
    });

    it("should handle empty attachments", async () => {
      mockAxios.mockResolvedValue({ data: { value: [] } });

      const result = await outlookFetchService.getAttachments("msg-123");

      expect(result).toHaveLength(0);
    });

    it("should handle missing value in response", async () => {
      mockAxios.mockResolvedValue({ data: {} });

      const result = await outlookFetchService.getAttachments("msg-123");

      expect(result).toHaveLength(0);
    });
  });

  describe("getAttachment", () => {
    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await outlookFetchService.initialize(mockUserId);
    });

    it("should fetch specific attachment data", async () => {
      const attachmentContent =
        Buffer.from("attachment data").toString("base64");
      mockAxios.mockResolvedValue({
        data: {
          id: "att-456",
          name: "file.pdf",
          contentBytes: attachmentContent,
        },
      });

      const result = await outlookFetchService.getAttachment(
        "msg-123",
        "att-456",
      );

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining(
            "/me/messages/msg-123/attachments/att-456",
          ),
        }),
      );
      expect(result.toString()).toBe("attachment data");
    });

    it("should throw error when no contentBytes", async () => {
      mockAxios.mockResolvedValue({
        data: { id: "att-456", name: "file.pdf" }, // No contentBytes
      });

      await expect(
        outlookFetchService.getAttachment("msg-123", "att-456"),
      ).rejects.toThrow("No attachment data found");
    });

    it("should handle fetch errors", async () => {
      mockAxios.mockRejectedValue(new Error("Attachment error"));

      await expect(
        outlookFetchService.getAttachment("msg-123", "invalid"),
      ).rejects.toThrow("Attachment error");
    });
  });

  describe("getUserEmail", () => {
    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await outlookFetchService.initialize(mockUserId);
    });

    it("should return mail property", async () => {
      mockAxios.mockResolvedValue({
        data: {
          mail: "user@outlook.com",
          userPrincipalName: "user@company.onmicrosoft.com",
        },
      });

      const email = await outlookFetchService.getUserEmail();

      expect(email).toBe("user@outlook.com");
    });

    it("should fall back to userPrincipalName", async () => {
      mockAxios.mockResolvedValue({
        data: { userPrincipalName: "user@company.onmicrosoft.com" },
      });

      const email = await outlookFetchService.getUserEmail();

      expect(email).toBe("user@company.onmicrosoft.com");
    });

    it("should return empty string if neither found", async () => {
      mockAxios.mockResolvedValue({ data: {} });

      const email = await outlookFetchService.getUserEmail();

      expect(email).toBe("");
    });

    it("should handle errors", async () => {
      mockAxios.mockRejectedValue(new Error("Profile error"));

      await expect(outlookFetchService.getUserEmail()).rejects.toThrow(
        "Profile error",
      );
    });
  });

  describe("getFolders", () => {
    beforeEach(async () => {
      mockDatabaseService.getOAuthToken.mockResolvedValue(mockTokenRecord);
      await outlookFetchService.initialize(mockUserId);
    });

    it("should fetch mail folders", async () => {
      const mockFolders = [
        { id: "folder-1", displayName: "Inbox" },
        { id: "folder-2", displayName: "Sent Items" },
      ];

      mockAxios.mockResolvedValue({ data: { value: mockFolders } });

      const result = await outlookFetchService.getFolders();

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/me/mailFolders"),
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe("Inbox");
    });

    it("should handle empty folders", async () => {
      mockAxios.mockResolvedValue({ data: { value: [] } });

      const result = await outlookFetchService.getFolders();

      expect(result).toHaveLength(0);
    });

    it("should handle errors", async () => {
      mockAxios.mockRejectedValue(new Error("Folders error"));

      await expect(outlookFetchService.getFolders()).rejects.toThrow(
        "Folders error",
      );
    });
  });
});
