import { google, gmail_v1, Auth } from "googleapis";
import * as Sentry from "@sentry/electron/main";
import databaseService from "./databaseService";
import logService from "./logService";
import { OAuthToken } from "../types/models";
import { computeEmailHash } from "../utils/emailHash";
import { EmailDeduplicationService } from "./emailDeduplicationService";
import {
  withRetry,
  apiThrottlers,
  RetryOptions,
} from "../utils/apiRateLimit";

/**
 * Email attachment metadata
 */
interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

/**
 * Parsed email message
 */
interface ParsedEmail {
  id: string;
  threadId: string;
  subject: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  bcc: string | null;
  date: Date;
  body: string;
  bodyPlain: string;
  snippet: string;
  hasAttachments: boolean;
  attachmentCount: number;
  attachments: EmailAttachment[];
  labels: string[];
  raw: gmail_v1.Schema$Message;
  /** RFC 5322 Message-ID header for deduplication */
  messageIdHeader: string | null;
  /** SHA-256 content hash for fallback deduplication (TASK-918) */
  contentHash: string;
  /** ID of the original message if this is a duplicate (TASK-919) */
  duplicateOf?: string;
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
 * Search options for email queries
 */
interface EmailSearchOptions {
  query?: string;
  after?: Date | null;
  before?: Date | null;
  maxResults?: number;
  skip?: number;
  contactEmails?: string[];
  onProgress?: (progress: FetchProgress) => void;
}

/**
 * Gmail Fetch Service
 * Fetches emails from Gmail for transaction extraction
 */
/**
 * Extract RFC 5322 Message-ID header from email headers
 * Uses case-insensitive matching and returns full value including angle brackets
 * @param headers - Array of header objects from Gmail API
 * @returns Message-ID header value or null if not found
 */
function extractMessageIdHeader(
  headers: Array<{ name?: string | null; value?: string | null }>,
): string | null {
  const messageIdHeader = headers.find(
    (h) => h.name?.toLowerCase() === "message-id",
  );
  return messageIdHeader?.value ?? null;
}

class GmailFetchService {
  private gmail: gmail_v1.Gmail | null = null;
  private oauth2Client: Auth.OAuth2Client | null = null;

  /**
   * Retry options for Gmail API calls (BACKLOG-497)
   */
  private readonly retryOptions: RetryOptions = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    context: "GmailFetch",
  };

  /**
   * Execute a Gmail API call with rate limiting (BACKLOG-497)
   *
   * Features:
   * - Request throttling (100ms minimum delay between requests)
   * - Exponential backoff on rate limit errors (429)
   * - Respects Retry-After headers
   * - Automatic retry on transient errors
   *
   * @private
   */
  private async _throttledCall<T>(fn: () => Promise<T>): Promise<T> {
    await apiThrottlers.gmail.throttle();
    return withRetry(fn, this.retryOptions);
  }

  /**
   * Initialize Gmail API with user's OAuth tokens
   * @param userId - User ID to fetch tokens for
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Get OAuth token from database
      const tokenRecord: OAuthToken | null =
        await databaseService.getOAuthToken(userId, "google", "mailbox");

      if (!tokenRecord) {
        throw new Error(
          "No Gmail OAuth token found. User needs to connect Gmail first.",
        );
      }

      // Session-only OAuth: tokens stored unencrypted in encrypted database
      const accessToken = tokenRecord.access_token || "";
      const refreshToken = tokenRecord.refresh_token || null;

      // Initialize OAuth2 client for Gmail API calls
      // Token refresh is handled by googleAuthService; this client is for API calls only
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI,
      );

      // Set credentials
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      // Handle token refresh (session-only, no encryption needed)
      oauth2Client.on("tokens", async (tokens) => {
        logService.info("Tokens refreshed", "GmailFetch");
        if (tokens.refresh_token) {
          // Update refresh token in database (no encryption)
          await databaseService.updateOAuthToken(tokenRecord.id, {
            refresh_token: tokens.refresh_token,
          });
        }
        if (tokens.access_token) {
          // Update access token (no encryption)
          await databaseService.updateOAuthToken(tokenRecord.id, {
            access_token: tokens.access_token,
            token_expires_at: new Date(
              Date.now() + (tokens.expiry_date || 3600000),
            ).toISOString(),
          });
        }
      });

      // Store client and initialize Gmail API
      this.oauth2Client = oauth2Client;
      this.gmail = google.gmail({ version: "v1", auth: oauth2Client });

      logService.debug("Initialized successfully", "GmailFetch");
      return true;
    } catch (error) {
      logService.error("Initialization failed", "GmailFetch", { error });
      Sentry.captureException(error, {
        tags: { service: "gmail-fetch", operation: "initialize" },
      });
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
    contactEmails,
    onProgress,
  }: EmailSearchOptions = {}): Promise<ParsedEmail[]> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      // Build query string
      let searchQuery = query;

      // BACKLOG-712: Filter by contact email addresses (bidirectional: from + to)
      if (contactEmails && contactEmails.length > 0) {
        const emailClauses = contactEmails.map(e => `from:${e} OR to:${e}`).join(" OR ");
        const contactFilter = `{${emailClauses}}`;
        searchQuery = searchQuery ? `${contactFilter} ${searchQuery}` : contactFilter;
      }

      if (after) {
        const afterDate = Math.floor(after.getTime() / 1000);
        searchQuery += ` after:${afterDate}`;
      }

      if (before) {
        const beforeDate = Math.floor(before.getTime() / 1000);
        searchQuery += ` before:${beforeDate}`;
      }

      logService.info("Searching emails", "GmailFetch", { query: searchQuery });

      const allMessages: gmail_v1.Schema$Message[] = [];
      let nextPageToken: string | undefined = undefined;
      let pageCount = 0;
      let estimatedTotal = 0;

      // Paginate through all results with rate limiting (BACKLOG-497)
      do {
        pageCount++;
        logService.debug(`Fetching page ${pageCount}`, "GmailFetch");

        const response: { data: gmail_v1.Schema$ListMessagesResponse } =
          await this._throttledCall(() =>
            this.gmail!.users.messages.list({
              userId: "me",
              q: searchQuery.trim(),
              maxResults: Math.min(100, maxResults - allMessages.length), // Fetch up to 100 per page
              pageToken: nextPageToken,
            })
          );

        // Get estimated total from first response
        if (pageCount === 1 && response.data.resultSizeEstimate) {
          estimatedTotal = response.data.resultSizeEstimate;
          logService.info(
            `Estimated total emails: ${estimatedTotal}`,
            "GmailFetch",
          );
        }

        const messages = response.data.messages || [];
        logService.debug(
          `Page ${pageCount}: Found ${messages.length} messages`,
          "GmailFetch",
        );

        allMessages.push(...messages);

        // Report progress
        if (onProgress) {
          // Gmail's resultSizeEstimate is often very inaccurate, so during the
          // message list scan phase, never show "X of Y" format - just show count.
          // The real total will be known after scanning completes (Phase 2).
          onProgress({
            fetched: allMessages.length,
            total: allMessages.length,
            estimatedTotal,
            percentage: 0,
            hasEstimate: false, // Don't trust Gmail's estimate during scan
          });
        }

        nextPageToken = response.data.nextPageToken ?? undefined;

        // Stop if we've reached the requested maxResults or no more pages
        if (allMessages.length >= maxResults || !nextPageToken) {
          break;
        }
      } while (nextPageToken);

      logService.info(
        `Total messages found: ${allMessages.length}`,
        "GmailFetch",
      );

      // Fetch full message details for each (in batches to avoid overwhelming the API)
      const fullMessages: ParsedEmail[] = [];
      const batchSize = 10;
      for (let i = 0; i < allMessages.length; i += batchSize) {
        const batch = allMessages.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch
            .filter((msg) => msg.id)
            .map((msg) => this.getEmailById(msg.id as string)),
        );
        fullMessages.push(...batchResults);

        // Report progress for fetching details
        if (onProgress) {
          const percentage = Math.round(
            (fullMessages.length / allMessages.length) * 100,
          );
          onProgress({
            fetched: fullMessages.length,
            total: allMessages.length,
            estimatedTotal,
            percentage,
            hasEstimate: true, // At this point we have the actual count
          });
        }
      }

      return fullMessages;
    } catch (error) {
      logService.error("Search emails failed", "GmailFetch", { error });
      Sentry.captureException(error, {
        tags: { service: "gmail-fetch", operation: "searchEmails" },
      });
      throw error;
    }
  }

  /**
   * Get email by ID with rate limiting (BACKLOG-497)
   * @param messageId - Gmail message ID
   * @returns Parsed email object
   */
  async getEmailById(messageId: string): Promise<ParsedEmail> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      const response = await this._throttledCall(() =>
        this.gmail!.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        })
      );

      const message = response.data;
      return this._parseMessage(message);
    } catch (error) {
      logService.error(`Failed to get message ${messageId}`, "GmailFetch", {
        error,
      });
      Sentry.captureException(error, {
        tags: { service: "gmail-fetch", operation: "getEmailById" },
      });
      throw error;
    }
  }

  /**
   * Parse Gmail message into structured format
   * @private
   */
  private _parseMessage(message: gmail_v1.Schema$Message): ParsedEmail {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string): string | null => {
      const header = headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase(),
      );
      return header ? header.value || null : null;
    };

    // Extract body
    let body = "";
    let bodyPlain = "";

    const extractBody = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.mimeType === "text/plain" && part.body?.data) {
        bodyPlain = Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.mimeType === "text/html" && part.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      }

      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    if (message.payload?.parts) {
      message.payload.parts.forEach(extractBody);
    } else if (message.payload?.body?.data) {
      // Single part message
      const content = Buffer.from(message.payload.body.data, "base64").toString(
        "utf-8",
      );
      if (message.payload.mimeType === "text/plain") {
        bodyPlain = content;
      } else {
        body = content;
      }
    }

    // Extract attachments
    const attachments: EmailAttachment[] = [];
    const extractAttachments = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }
      if (part.parts) {
        part.parts.forEach(extractAttachments);
      }
    };

    if (message.payload?.parts) {
      message.payload.parts.forEach(extractAttachments);
    }

    // Extract fields for hash computation
    const subject = getHeader("Subject");
    const from = getHeader("From");
    const sentDate = new Date(parseInt(message.internalDate || "0"));
    const bodyPlainForHash = bodyPlain || body;

    // Compute content hash for deduplication fallback (TASK-918)
    const contentHash = computeEmailHash({
      subject,
      from,
      sentDate,
      bodyPlain: bodyPlainForHash,
    });

    return {
      id: message.id || "",
      threadId: message.threadId || "",
      subject: subject,
      from: from,
      to: getHeader("To"),
      cc: getHeader("Cc"),
      bcc: getHeader("Bcc"),
      date: sentDate,
      body: body,
      bodyPlain: bodyPlainForHash,
      snippet: message.snippet || "",
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      attachments: attachments,
      labels: message.labelIds || [],
      raw: message,
      messageIdHeader: extractMessageIdHeader(headers),
      contentHash,
    };
  }

  /**
   * Get email attachment with rate limiting (BACKLOG-497)
   * @param messageId - Gmail message ID
   * @param attachmentId - Attachment ID
   * @returns Attachment data
   */
  async getAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<Buffer> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      const response = await this._throttledCall(() =>
        this.gmail!.users.messages.attachments.get({
          userId: "me",
          messageId: messageId,
          id: attachmentId,
        })
      );

      return Buffer.from(response.data.data || "", "base64");
    } catch (error) {
      logService.error("Failed to get attachment", "GmailFetch", { error });
      Sentry.captureException(error, {
        tags: { service: "gmail-fetch", operation: "getAttachment" },
      });
      throw error;
    }
  }

  /**
   * Get user's email address with rate limiting (BACKLOG-497)
   * @returns User's Gmail address
   */
  async getUserEmail(): Promise<string> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      const response = await this._throttledCall(() =>
        this.gmail!.users.getProfile({
          userId: "me",
        })
      );

      return response.data.emailAddress || "";
    } catch (error) {
      logService.error("Failed to get user email", "GmailFetch", { error });
      Sentry.captureException(error, {
        tags: { service: "gmail-fetch", operation: "getUserEmail" },
      });
      throw error;
    }
  }

  /**
   * System labels to exclude from folder discovery (TASK-2046)
   * These are internal Gmail labels that should not be synced.
   */
  private static readonly EXCLUDED_LABEL_IDS = [
    "SPAM",
    "TRASH",
    "DRAFT",
    "UNREAD",
    "STARRED",
    "IMPORTANT",
  ];

  /**
   * Prefixes to exclude from folder discovery (TASK-2046)
   * Category labels are Gmail's automatic sorting tabs.
   */
  private static readonly EXCLUDED_LABEL_PREFIXES = ["CATEGORY_"];

  /**
   * Discover all syncable Gmail labels (TASK-2046)
   *
   * Uses the Gmail Labels API to list all labels, then filters out
   * system labels (SPAM, TRASH, DRAFT, etc.) and category labels.
   *
   * @returns Array of syncable labels with id and name
   */
  async discoverLabels(): Promise<Array<{ id: string; name: string }>> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      const response = await this._throttledCall(() =>
        this.gmail!.users.labels.list({ userId: "me" })
      );

      const allLabels = response.data.labels || [];

      const syncableLabels = allLabels.filter((label) => {
        if (!label.id) return false;
        if (
          GmailFetchService.EXCLUDED_LABEL_IDS.includes(label.id)
        )
          return false;
        if (
          GmailFetchService.EXCLUDED_LABEL_PREFIXES.some((p) =>
            label.id!.startsWith(p)
          )
        )
          return false;
        return true;
      });

      logService.info(
        `Discovered ${syncableLabels.length} syncable labels (from ${allLabels.length} total)`,
        "GmailFetch"
      );

      return syncableLabels.map((label) => ({
        id: label.id!,
        name: label.name || label.id!,
      }));
    } catch (error) {
      logService.error("Failed to discover labels", "GmailFetch", { error });
      Sentry.captureException(error, {
        tags: { service: "gmail-fetch", operation: "discoverLabels" },
      });
      throw error;
    }
  }

  /**
   * Search emails from a specific label (TASK-2046)
   *
   * Fetches messages from a single label using the labelIds filter.
   * Uses existing message list/fetch logic with rate limiting.
   *
   * @param labelId - The Gmail label ID to fetch from
   * @param options - Search options (after, maxResults, onProgress)
   * @returns Array of parsed emails from the label
   */
  async searchEmailsByLabel(
    labelId: string,
    options: {
      after?: Date | null;
      maxResults?: number;
      onProgress?: (progress: FetchProgress & { label?: string }) => void;
    } = {}
  ): Promise<ParsedEmail[]> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      const { after = null, maxResults = 500, onProgress } = options;

      // Build query string for date filter only
      let searchQuery = "";
      if (after) {
        const afterDate = Math.floor(after.getTime() / 1000);
        searchQuery = `after:${afterDate}`;
      }

      logService.debug(
        `Fetching messages for label ${labelId}`,
        "GmailFetch",
        { query: searchQuery }
      );

      const allMessages: gmail_v1.Schema$Message[] = [];
      let nextPageToken: string | undefined = undefined;
      let pageCount = 0;

      do {
        pageCount++;
        const response: { data: gmail_v1.Schema$ListMessagesResponse } =
          await this._throttledCall(() =>
            this.gmail!.users.messages.list({
              userId: "me",
              labelIds: [labelId],
              q: searchQuery.trim() || undefined,
              maxResults: Math.min(100, maxResults - allMessages.length),
              pageToken: nextPageToken,
            })
          );

        const messages = response.data.messages || [];
        allMessages.push(...messages);
        nextPageToken = response.data.nextPageToken ?? undefined;

        if (allMessages.length >= maxResults || !nextPageToken) {
          break;
        }
      } while (nextPageToken);

      logService.debug(
        `Label ${labelId}: found ${allMessages.length} message IDs`,
        "GmailFetch"
      );

      // Fetch full message details in batches
      const fullMessages: ParsedEmail[] = [];
      const batchSize = 10;
      for (let i = 0; i < allMessages.length; i += batchSize) {
        const batch = allMessages.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch
            .filter((msg) => msg.id)
            .map((msg) => this.getEmailById(msg.id as string))
        );
        fullMessages.push(...batchResults);

        if (onProgress) {
          const percentage = Math.round(
            (fullMessages.length / allMessages.length) * 100
          );
          onProgress({
            fetched: fullMessages.length,
            total: allMessages.length,
            percentage,
            hasEstimate: true,
            label: labelId,
          });
        }
      }

      return fullMessages;
    } catch (error) {
      logService.error(
        `Failed to fetch emails for label ${labelId}`,
        "GmailFetch",
        { error }
      );
      Sentry.captureException(error, {
        tags: { service: "gmail-fetch", operation: "searchEmailsByLabel" },
      });
      throw error;
    }
  }

  /**
   * Discover all labels and fetch emails from each (TASK-2046)
   *
   * Orchestrates label discovery and multi-label fetch. Deduplicates
   * emails that appear under multiple labels (same email can have
   * multiple Gmail labels). Handles per-label errors gracefully.
   *
   * @param options - Search options applied to each label
   * @returns Deduplicated array of parsed emails from all labels
   */
  async searchAllLabels(
    options: {
      after?: Date | null;
      maxResults?: number;
      onProgress?: (progress: FetchProgress & { label?: string; currentLabel?: string }) => void;
    } = {}
  ): Promise<ParsedEmail[]> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      const labels = await this.discoverLabels();
      logService.info(
        `Starting multi-label fetch across ${labels.length} labels`,
        "GmailFetch"
      );

      const seenMessageIds = new Set<string>();
      const allEmails: ParsedEmail[] = [];

      for (const label of labels) {
        try {
          const emails = await this.searchEmailsByLabel(label.id, {
            after: options.after,
            maxResults: options.maxResults,
            onProgress: options.onProgress
              ? (progress) => {
                  options.onProgress!({
                    ...progress,
                    currentLabel: label.name,
                  });
                }
              : undefined,
          });

          // Deduplicate by message ID (same email can appear in multiple labels)
          let newCount = 0;
          for (const email of emails) {
            if (!seenMessageIds.has(email.id)) {
              seenMessageIds.add(email.id);
              allEmails.push(email);
              newCount++;
            }
          }

          logService.debug(
            `Label "${label.name}": ${emails.length} messages, ${newCount} new`,
            "GmailFetch"
          );
        } catch (labelError) {
          // Per-label error isolation: skip this label, continue with others
          logService.warn(
            `Failed to fetch emails for label "${label.name}" (${label.id}), skipping`,
            "GmailFetch",
            {
              error:
                labelError instanceof Error
                  ? labelError.message
                  : "Unknown error",
            }
          );
        }
      }

      logService.info(
        `Multi-label fetch complete: ${allEmails.length} unique emails from ${labels.length} labels`,
        "GmailFetch"
      );

      return allEmails;
    } catch (error) {
      logService.error(
        "Failed to search all labels",
        "GmailFetch",
        { error }
      );
      Sentry.captureException(error, {
        tags: { service: "gmail-fetch", operation: "searchAllLabels" },
      });
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
    return EmailDeduplicationService.checkDuplicates(userId, emails, {
      logLabel: "GmailFetch",
      sentryTag: "gmail-fetch",
    });
  }
}

export default new GmailFetchService();
