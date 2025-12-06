import { google, gmail_v1, Auth } from "googleapis";
// NOTE: tokenEncryptionService removed - using session-only OAuth
// Tokens stored in encrypted database, no additional keychain encryption needed
import databaseService from "./databaseService";
import logService from "./logService";
import { OAuthToken } from "../types/models";

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
  onProgress?: (progress: FetchProgress) => void;
}

/**
 * Gmail Fetch Service
 * Fetches emails from Gmail for transaction extraction
 */
class GmailFetchService {
  private gmail: gmail_v1.Gmail | null = null;
  private oauth2Client: Auth.OAuth2Client | null = null;

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

      // Initialize OAuth2 client
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

      logService.info("Initialized successfully", "GmailFetch");
      return true;
    } catch (error) {
      logService.error("Initialization failed", "GmailFetch", { error });
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
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      // Build query string
      let searchQuery = query;

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

      // Paginate through all results
      do {
        pageCount++;
        logService.debug(`Fetching page ${pageCount}`, "GmailFetch");

        const response: { data: gmail_v1.Schema$ListMessagesResponse } =
          await this.gmail.users.messages.list({
            userId: "me",
            q: searchQuery.trim(),
            maxResults: Math.min(100, maxResults - allMessages.length), // Fetch up to 100 per page
            pageToken: nextPageToken,
          });

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
          const hasEstimate = estimatedTotal > 0;
          const targetTotal = hasEstimate
            ? Math.min(estimatedTotal, maxResults)
            : allMessages.length;
          const percentage = hasEstimate
            ? Math.min(
                100,
                Math.round((allMessages.length / targetTotal) * 100),
              )
            : 0;
          onProgress({
            fetched: allMessages.length,
            total: targetTotal,
            estimatedTotal,
            percentage,
            hasEstimate,
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
      throw error;
    }
  }

  /**
   * Get email by ID
   * @param messageId - Gmail message ID
   * @returns Parsed email object
   */
  async getEmailById(messageId: string): Promise<ParsedEmail> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const message = response.data;
      return this._parseMessage(message);
    } catch (error) {
      logService.error(`Failed to get message ${messageId}`, "GmailFetch", {
        error,
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

    return {
      id: message.id || "",
      threadId: message.threadId || "",
      subject: getHeader("Subject"),
      from: getHeader("From"),
      to: getHeader("To"),
      cc: getHeader("Cc"),
      bcc: getHeader("Bcc"),
      date: new Date(parseInt(message.internalDate || "0")),
      body: body,
      bodyPlain: bodyPlain || body,
      snippet: message.snippet || "",
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      attachments: attachments,
      labels: message.labelIds || [],
      raw: message,
    };
  }

  /**
   * Get email attachment
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

      const response = await this.gmail.users.messages.attachments.get({
        userId: "me",
        messageId: messageId,
        id: attachmentId,
      });

      return Buffer.from(response.data.data || "", "base64");
    } catch (error) {
      logService.error("Failed to get attachment", "GmailFetch", { error });
      throw error;
    }
  }

  /**
   * Get user's email address
   * @returns User's Gmail address
   */
  async getUserEmail(): Promise<string> {
    try {
      if (!this.gmail) {
        throw new Error("Gmail API not initialized. Call initialize() first.");
      }

      const response = await this.gmail.users.getProfile({
        userId: "me",
      });

      return response.data.emailAddress || "";
    } catch (error) {
      logService.error("Failed to get user email", "GmailFetch", { error });
      throw error;
    }
  }
}

export default new GmailFetchService();
