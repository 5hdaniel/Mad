import axios, { AxiosRequestConfig } from "axios";
import databaseService from "./databaseService";
import logService from "./logService";
import microsoftAuthService from "./microsoftAuthService";
import { OAuthToken } from "../types/models";
import { computeEmailHash } from "../utils/emailHash";
import {
  EmailDeduplicationService,
  DuplicateCheckResult,
} from "./emailDeduplicationService";

/**
 * Microsoft Graph API email recipient
 */
interface GraphEmailRecipient {
  emailAddress?: {
    address: string;
    name?: string;
  };
}

/**
 * Microsoft Graph API email body
 */
interface GraphEmailBody {
  content: string;
  contentType: "text" | "html";
}

/**
 * Microsoft Graph internet message header
 */
interface GraphInternetMessageHeader {
  name: string;
  value: string;
}

/**
 * Microsoft Graph API message
 */
interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  from?: GraphEmailRecipient;
  toRecipients?: GraphEmailRecipient[];
  ccRecipients?: GraphEmailRecipient[];
  bccRecipients?: GraphEmailRecipient[];
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  body?: GraphEmailBody;
  bodyPreview?: string;
  // TASK-502: Added for junk detection
  inferenceClassification?: 'focused' | 'other';
  parentFolderId?: string;
  // TASK-917: Added for Message-ID extraction (deduplication)
  internetMessageId?: string;
  internetMessageHeaders?: GraphInternetMessageHeader[];
}

/**
 * Microsoft Graph API response wrapper
 */
interface GraphApiResponse<T> {
  value: T[];
  "@odata.count"?: number;
}

/**
 * Progress callback for email fetching
 */
interface FetchProgress {
  fetched: number;
  total: number;
  estimatedTotal?: number;
  percentage: number;
  hasEstimate: boolean;
}

/**
 * Microsoft Graph attachment
 */
interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
}

/**
 * Parsed email message
 */
interface ParsedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string | null;
  to: string | null;
  cc: string | null;
  bcc: string | null;
  date: Date;
  sentDate: Date;
  body: string;
  bodyPlain: string;
  snippet: string;
  hasAttachments: boolean;
  attachmentCount: number;
  raw: GraphMessage;
  // TASK-502: Added for junk detection
  inferenceClassification?: string;
  parentFolderId?: string;
  /** RFC 5322 Message-ID header for deduplication (TASK-917) */
  messageIdHeader: string | null;
  /** SHA-256 content hash for fallback deduplication (TASK-918) */
  contentHash: string;
  /** ID of the original message if this is a duplicate (TASK-919) */
  duplicateOf?: string;
}

/**
 * Search options for email queries
 */
interface EmailSearchOptions {
  query?: string;
  after?: Date | null;
  before?: Date | null;
  maxResults?: number;
  onProgress?: (progress: FetchProgress) => void;
}

/**
 * Extract RFC 5322 Message-ID header from Outlook message
 * Uses internetMessageId property first (preferred), falls back to internetMessageHeaders
 * @param message - Graph API message object
 * @returns Message-ID header value or null if not found
 */
function extractMessageIdHeader(message: GraphMessage): string | null {
  // Option 1: Use internetMessageId property (preferred, simpler)
  if (message.internetMessageId) {
    return message.internetMessageId;
  }

  // Option 2: Fall back to internetMessageHeaders array
  if (message.internetMessageHeaders && message.internetMessageHeaders.length > 0) {
    const messageIdHeader = message.internetMessageHeaders.find(
      (h) => h.name?.toLowerCase() === "message-id",
    );
    if (messageIdHeader?.value) {
      return messageIdHeader.value;
    }
  }

  return null;
}

/**
 * Outlook Fetch Service
 * Fetches emails from Outlook/Office 365 using Microsoft Graph API
 */
class OutlookFetchService {
  private graphApiUrl = "https://graph.microsoft.com/v1.0";
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private userId: string | null = null;

  /**
   * Initialize Outlook API with user's OAuth tokens
   * @param userId - User ID to fetch tokens for
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      this.userId = userId;

      // Get OAuth token from database
      const tokenRecord: OAuthToken | null =
        await databaseService.getOAuthToken(userId, "microsoft", "mailbox");

      if (!tokenRecord) {
        throw new Error(
          "No Outlook OAuth token found. User needs to connect Outlook first.",
        );
      }

      // Session-only OAuth: tokens stored unencrypted in encrypted database
      this.accessToken = tokenRecord.access_token || "";
      this.refreshToken = tokenRecord.refresh_token || null;

      logService.info("Initialized successfully", "OutlookFetch");
      return true;
    } catch (error) {
      logService.error("Initialization failed", "OutlookFetch", { error });
      throw error;
    }
  }

  /**
   * Make authenticated request to Microsoft Graph API
   * @private
   */
  private async _graphRequest<T = any>(
    endpoint: string,
    method: string = "GET",
    data: any = null,
    isRetry: boolean = false,
  ): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        method,
        url: `${this.graphApiUrl}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      // Handle token expiration with refresh
      if (error.response && error.response.status === 401 && !isRetry) {
        if (this.refreshToken && this.userId) {
          logService.info(
            "Access token expired, attempting refresh",
            "OutlookFetch",
          );
          try {
            const tokenResponse = await microsoftAuthService.refreshToken(
              this.refreshToken,
            );
            this.accessToken = tokenResponse.access_token;
            this.refreshToken = tokenResponse.refresh_token;

            // Update token in database
            await databaseService.saveOAuthToken(
              this.userId,
              "microsoft",
              "mailbox",
              {
                access_token: tokenResponse.access_token,
                refresh_token: tokenResponse.refresh_token,
                token_expires_at: new Date(
                  Date.now() + tokenResponse.expires_in * 1000,
                ),
              },
            );

            logService.info("Token refreshed successfully", "OutlookFetch");
            // Retry the request with new token
            return this._graphRequest<T>(endpoint, method, data, true);
          } catch (refreshError) {
            logService.error("Token refresh failed", "OutlookFetch", {
              error: refreshError,
            });
            throw new Error(
              "Microsoft access token expired and refresh failed. Please reconnect Outlook.",
            );
          }
        } else {
          logService.error(
            "Access token expired but no refresh token available",
            "OutlookFetch",
          );
          throw new Error(
            "Microsoft access token expired. Please reconnect Outlook.",
          );
        }
      }
      throw error;
    }
  }

  /**
   * Search for emails matching query
   * @param options - Search options
   * @returns Array of email messages
   */
  async searchEmails({
    query = "",
    after = null,
    before = null,
    maxResults = 100,
    onProgress,
  }: EmailSearchOptions = {}): Promise<ParsedEmail[]> {
    try {
      if (!this.accessToken) {
        throw new Error(
          "Outlook API not initialized. Call initialize() first.",
        );
      }

      // Build filter string
      const filters: string[] = [];

      if (query) {
        // Escape single quotes in OData filters to prevent injection
        const escapedQuery = query.replace(/'/g, "''");
        // Search in subject and body
        filters.push(
          `(contains(subject,'${escapedQuery}') or contains(body/content,'${escapedQuery}'))`,
        );
      }

      if (after) {
        filters.push(`receivedDateTime ge ${after.toISOString()}`);
      }

      if (before) {
        filters.push(`receivedDateTime le ${before.toISOString()}`);
      }

      const filterString =
        filters.length > 0 ? `$filter=${filters.join(" and ")}` : "";
      const selectFields =
        "$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,body,bodyPreview,conversationId,inferenceClassification,parentFolderId,internetMessageId,internetMessageHeaders";

      logService.info("Searching emails", "OutlookFetch");

      // First, get the total count of matching emails
      let estimatedTotal = 0;
      try {
        const countParams = ["$count=true", "$top=1", filterString]
          .filter(Boolean)
          .join("&");
        const countData = await this._graphRequest<
          GraphApiResponse<GraphMessage>
        >(`/me/messages?${countParams}`);
        estimatedTotal = countData["@odata.count"] || 0;
        logService.info(
          `Estimated total emails: ${estimatedTotal}`,
          "OutlookFetch",
        );
      } catch {
        logService.debug(
          "Could not get email count, progress will be estimated",
          "OutlookFetch",
        );
      }

      const hasEstimate = estimatedTotal > 0;
      const targetTotal = hasEstimate
        ? Math.min(estimatedTotal, maxResults)
        : maxResults;

      const allMessages: GraphMessage[] = [];
      let skip = 0;
      let pageCount = 0;
      const pageSize = 100; // Fetch 100 per page

      // Paginate through all results
      do {
        pageCount++;
        const top = `$top=${pageSize}`;
        const skipParam = skip > 0 ? `$skip=${skip}` : "";

        const queryParams = [selectFields, top, skipParam, filterString]
          .filter(Boolean)
          .join("&");

        logService.debug(
          `Fetching page ${pageCount} (skip=${skip})`,
          "OutlookFetch",
        );

        const data = await this._graphRequest<GraphApiResponse<GraphMessage>>(
          `/me/messages?${queryParams}`,
        );
        const messages = data.value || [];

        logService.debug(
          `Page ${pageCount}: Found ${messages.length} messages`,
          "OutlookFetch",
        );

        allMessages.push(...messages);
        skip += pageSize;

        // Report progress
        if (onProgress) {
          const fetched = allMessages.length;
          const currentTotal = hasEstimate ? targetTotal : fetched;
          const percentage = hasEstimate
            ? Math.min(100, Math.round((fetched / targetTotal) * 100))
            : 0;
          onProgress({
            fetched,
            total: currentTotal,
            estimatedTotal,
            percentage,
            hasEstimate,
          });
        }

        // Stop if we got fewer results than a full page or reached maxResults
        if (messages.length < pageSize || allMessages.length >= maxResults) {
          break;
        }
      } while (allMessages.length < maxResults);

      logService.info(
        `Total messages found: ${allMessages.length}`,
        "OutlookFetch",
      );

      // Parse messages
      return allMessages
        .slice(0, maxResults)
        .map((msg) => this._parseMessage(msg));
    } catch (error) {
      logService.error("Search emails failed", "OutlookFetch", { error });
      throw error;
    }
  }

  /**
   * Get email by ID
   * @param messageId - Outlook message ID
   * @returns Parsed email object
   */
  async getEmailById(messageId: string): Promise<ParsedEmail> {
    try {
      const data = await this._graphRequest<GraphMessage>(
        `/me/messages/${messageId}`,
      );
      return this._parseMessage(data);
    } catch (error) {
      logService.error(`Failed to get message ${messageId}`, "OutlookFetch", {
        error,
      });
      throw error;
    }
  }

  /**
   * Parse Outlook message into structured format
   * @private
   */
  private _parseMessage(message: GraphMessage): ParsedEmail {
    // Extract email addresses
    const getEmailAddress = (
      recipient: GraphEmailRecipient | undefined | null,
    ): string | null => {
      if (!recipient) return null;
      return recipient.emailAddress ? recipient.emailAddress.address : null;
    };

    const from = message.from ? getEmailAddress(message.from) : null;
    const to = message.toRecipients
      ? message.toRecipients.map(getEmailAddress).join(", ")
      : null;
    const cc = message.ccRecipients
      ? message.ccRecipients.map(getEmailAddress).join(", ")
      : null;
    const bcc = message.bccRecipients
      ? message.bccRecipients.map(getEmailAddress).join(", ")
      : null;

    // Extract body
    const body = message.body ? message.body.content : "";
    const bodyPlain =
      message.body && message.body.contentType === "text"
        ? message.body.content
        : message.bodyPreview || "";

    // Use sentDateTime for hash (consistent with Gmail using internalDate)
    const sentDate = new Date(message.sentDateTime);

    // Compute content hash for deduplication fallback (TASK-918)
    const contentHash = computeEmailHash({
      subject: message.subject,
      from,
      sentDate,
      bodyPlain,
    });

    return {
      id: message.id,
      threadId: message.conversationId,
      subject: message.subject,
      from: from,
      to: to,
      cc: cc,
      bcc: bcc,
      date: new Date(message.receivedDateTime),
      sentDate: sentDate,
      body: body,
      bodyPlain: bodyPlain,
      snippet: message.bodyPreview || "",
      hasAttachments: message.hasAttachments || false,
      attachmentCount: 0, // Would need separate call to get attachment count
      raw: message,
      // TASK-502: Added for junk detection
      inferenceClassification: message.inferenceClassification,
      parentFolderId: message.parentFolderId,
      // TASK-917: Message-ID for deduplication
      messageIdHeader: extractMessageIdHeader(message),
      // TASK-918: Content hash for fallback deduplication
      contentHash,
    };
  }

  /**
   * Get email attachments
   * @param messageId - Outlook message ID
   * @returns Array of attachments
   */
  async getAttachments(messageId: string): Promise<GraphAttachment[]> {
    try {
      const data = await this._graphRequest<GraphApiResponse<GraphAttachment>>(
        `/me/messages/${messageId}/attachments`,
      );
      return data.value || [];
    } catch (error) {
      logService.error("Failed to get attachments", "OutlookFetch", { error });
      throw error;
    }
  }

  /**
   * Get specific attachment
   * @param messageId - Outlook message ID
   * @param attachmentId - Attachment ID
   * @returns Attachment data
   */
  async getAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<Buffer> {
    try {
      const data = await this._graphRequest<GraphAttachment>(
        `/me/messages/${messageId}/attachments/${attachmentId}`,
      );

      if (data.contentBytes) {
        return Buffer.from(data.contentBytes, "base64");
      }

      throw new Error("No attachment data found");
    } catch (error) {
      logService.error("Failed to get attachment", "OutlookFetch", { error });
      throw error;
    }
  }

  /**
   * Get user's email address
   * @returns User's Outlook email address
   */
  async getUserEmail(): Promise<string> {
    try {
      const data = await this._graphRequest<{
        mail?: string;
        userPrincipalName?: string;
      }>("/me");
      return data.mail || data.userPrincipalName || "";
    } catch (error) {
      logService.error("Failed to get user email", "OutlookFetch", { error });
      throw error;
    }
  }

  /**
   * Get folders/mailboxes
   * @returns Array of mail folders
   */
  async getFolders(): Promise<any[]> {
    try {
      const data =
        await this._graphRequest<GraphApiResponse<any>>("/me/mailFolders");
      return data.value || [];
    } catch (error) {
      logService.error("Failed to get folders", "OutlookFetch", { error });
      throw error;
    }
  }

  /**
   * Check emails for duplicates and populate duplicateOf field (TASK-919)
   *
   * Uses EmailDeduplicationService to detect duplicates by:
   * 1. Message-ID header (most reliable)
   * 2. Content hash (fallback)
   *
   * @param userId - User ID to scope the duplicate check
   * @param emails - Array of parsed emails to check
   * @returns Same emails with duplicateOf field populated where applicable
   */
  async checkDuplicates(
    userId: string,
    emails: ParsedEmail[]
  ): Promise<ParsedEmail[]> {
    if (emails.length === 0) {
      return emails;
    }

    try {
      const db = databaseService.getRawDatabase();
      const dedupService = new EmailDeduplicationService(db);

      // Use batch check for efficiency
      const dedupInputs = emails.map((e) => ({
        messageIdHeader: e.messageIdHeader,
        contentHash: e.contentHash,
      }));

      const results = dedupService.checkForDuplicatesBatch(userId, dedupInputs);

      // Populate duplicateOf field for each email
      const enrichedEmails = emails.map((email, index) => {
        const result = results.get(index);
        if (result?.isDuplicate && result.originalId) {
          return {
            ...email,
            duplicateOf: result.originalId,
          };
        }
        return email;
      });

      const duplicateCount = enrichedEmails.filter((e) => e.duplicateOf).length;
      if (duplicateCount > 0) {
        logService.info(
          `Duplicate check: ${duplicateCount}/${emails.length} duplicates found`,
          "OutlookFetch"
        );
      }

      return enrichedEmails;
    } catch (error) {
      logService.error("Failed to check duplicates", "OutlookFetch", { error });
      // Return original emails without duplicate info on error
      return emails;
    }
  }
}

export default new OutlookFetchService();
