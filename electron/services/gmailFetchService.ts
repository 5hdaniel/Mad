import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import tokenEncryptionService from './tokenEncryptionService';
import databaseService from './databaseService';
import { OAuthToken } from '../types/models';

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
 * Search options for email queries
 */
interface EmailSearchOptions {
  query?: string;
  after?: Date | null;
  before?: Date | null;
  maxResults?: number;
}

/**
 * Gmail Fetch Service
 * Fetches emails from Gmail for transaction extraction
 */
class GmailFetchService {
  private gmail: gmail_v1.Gmail | null = null;
  private oauth2Client: OAuth2Client | null = null;

  /**
   * Initialize Gmail API with user's OAuth tokens
   * @param userId - User ID to fetch tokens for
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      // Get OAuth token from database
      const tokenRecord: OAuthToken | null = await databaseService.getOAuthToken(userId, 'google', 'mailbox');

      if (!tokenRecord) {
        throw new Error('No Gmail OAuth token found. User needs to connect Gmail first.');
      }

      // Decrypt tokens
      const accessToken = tokenEncryptionService.decrypt(tokenRecord.access_token || '');
      const refreshToken = tokenRecord.refresh_token
        ? tokenEncryptionService.decrypt(tokenRecord.refresh_token)
        : null;

      // Initialize OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Set credentials
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      // Handle token refresh
      this.oauth2Client.on('tokens', async (tokens) => {
        console.log('[GmailFetch] Tokens refreshed');
        if (tokens.refresh_token) {
          // Update refresh token in database
          const encryptedRefreshToken = tokenEncryptionService.encrypt(tokens.refresh_token);
          await databaseService.updateOAuthToken(tokenRecord.id, {
            refresh_token: encryptedRefreshToken,
          });
        }
        if (tokens.access_token) {
          // Update access token
          const encryptedAccessToken = tokenEncryptionService.encrypt(tokens.access_token);
          await databaseService.updateOAuthToken(tokenRecord.id, {
            access_token: encryptedAccessToken,
            token_expires_at: new Date(Date.now() + (tokens.expiry_date || 3600000)).toISOString(),
          });
        }
      });

      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      console.log('[GmailFetch] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[GmailFetch] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Search for emails matching query
   * @param options - Search options
   * @returns Array of email messages
   */
  async searchEmails({ query = '', after = null, before = null, maxResults = 100 }: EmailSearchOptions = {}): Promise<ParsedEmail[]> {
    try {
      if (!this.gmail) {
        throw new Error('Gmail API not initialized. Call initialize() first.');
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

      console.log('[GmailFetch] Searching emails with query:', searchQuery);

      // Search for messages
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: searchQuery.trim(),
        maxResults: maxResults,
      });

      const messages = response.data.messages || [];
      console.log(`[GmailFetch] Found ${messages.length} messages`);

      // Fetch full message details for each
      const fullMessages = await Promise.all(
        messages.map(msg => this.getEmailById(msg.id!))
      );

      return fullMessages;
    } catch (error) {
      console.error('[GmailFetch] Search emails failed:', error);
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
        throw new Error('Gmail API not initialized. Call initialize() first.');
      }

      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      return this._parseMessage(message);
    } catch (error) {
      console.error(`[GmailFetch] Failed to get message ${messageId}:`, error);
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
      const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
      return header ? header.value || null : null;
    };

    // Extract body
    let body = '';
    let bodyPlain = '';

    const extractBody = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyPlain = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };

    if (message.payload?.parts) {
      message.payload.parts.forEach(extractBody);
    } else if (message.payload?.body?.data) {
      // Single part message
      const content = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      if (message.payload.mimeType === 'text/plain') {
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
          mimeType: part.mimeType || 'application/octet-stream',
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
      id: message.id || '',
      threadId: message.threadId || '',
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      cc: getHeader('Cc'),
      bcc: getHeader('Bcc'),
      date: new Date(parseInt(message.internalDate || '0')),
      body: body,
      bodyPlain: bodyPlain || body,
      snippet: message.snippet || '',
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
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      if (!this.gmail) {
        throw new Error('Gmail API not initialized. Call initialize() first.');
      }

      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: messageId,
        id: attachmentId,
      });

      return Buffer.from(response.data.data || '', 'base64');
    } catch (error) {
      console.error(`[GmailFetch] Failed to get attachment:`, error);
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
        throw new Error('Gmail API not initialized. Call initialize() first.');
      }

      const response = await this.gmail.users.getProfile({
        userId: 'me',
      });

      return response.data.emailAddress || '';
    } catch (error) {
      console.error('[GmailFetch] Failed to get user email:', error);
      throw error;
    }
  }
}

export default new GmailFetchService();
