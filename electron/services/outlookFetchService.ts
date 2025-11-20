import axios, { AxiosRequestConfig } from 'axios';
import tokenEncryptionService from './tokenEncryptionService';
import databaseService from './databaseService';

/**
 * Search options for emails
 */
interface SearchEmailsOptions {
  query?: string;
  after?: Date | null;
  before?: Date | null;
  maxResults?: number;
}

/**
 * Outlook email address
 */
interface OutlookEmailAddress {
  emailAddress: {
    address: string;
    name?: string;
  };
}

/**
 * Outlook message body
 */
interface OutlookMessageBody {
  contentType: string;
  content: string;
}

/**
 * Outlook message from Graph API
 */
interface OutlookMessage {
  id: string;
  conversationId: string;
  subject: string;
  from?: OutlookEmailAddress;
  toRecipients?: OutlookEmailAddress[];
  ccRecipients?: OutlookEmailAddress[];
  bccRecipients?: OutlookEmailAddress[];
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments?: boolean;
  body?: OutlookMessageBody;
  bodyPreview?: string;
}

/**
 * Parsed email structure
 */
export interface ParsedOutlookEmail {
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
  raw: OutlookMessage;
}

/**
 * Outlook attachment
 */
export interface OutlookAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  contentBytes?: string;
}

/**
 * Outlook folder
 */
export interface OutlookFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

/**
 * Outlook user info
 */
interface OutlookUser {
  mail?: string;
  userPrincipalName: string;
}

/**
 * Graph API response with value array
 */
interface GraphApiListResponse<T> {
  value: T[];
}

/**
 * Outlook Fetch Service
 * Fetches emails from Outlook/Office 365 using Microsoft Graph API
 */
class OutlookFetchService {
  private graphApiUrl = 'https://graph.microsoft.com/v1.0';
  private accessToken: string | null = null;
  private userId: string | null = null;

  /**
   * Initialize Outlook API with user's OAuth tokens
   * @param userId - User ID to fetch tokens for
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      this.userId = userId;

      // Get OAuth token from database
      const tokenRecord = await databaseService.getOAuthToken(userId, 'microsoft', 'mailbox');

      if (!tokenRecord) {
        throw new Error('No Outlook OAuth token found. User needs to connect Outlook first.');
      }

      // Decrypt access token
      this.accessToken = tokenEncryptionService.decrypt(tokenRecord.access_token!);

      console.log('[OutlookFetch] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[OutlookFetch] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Make authenticated request to Microsoft Graph API
   * @private
   */
  private async _graphRequest<T = any>(endpoint: string, method: string = 'GET', data: any = null): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        method,
        url: `${this.graphApiUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data as T;
    } catch (error: any) {
      // Handle token expiration
      if (error.response && error.response.status === 401) {
        console.error('[OutlookFetch] Access token expired, need to refresh');
        // TODO: Implement token refresh logic
      }
      throw error;
    }
  }

  /**
   * Search for emails matching query
   * @param options - Search options
   * @returns Array of email messages
   */
  async searchEmails(options: SearchEmailsOptions = {}): Promise<ParsedOutlookEmail[]> {
    const { query = '', after = null, before = null, maxResults = 100 } = options;

    try {
      if (!this.accessToken) {
        throw new Error('Outlook API not initialized. Call initialize() first.');
      }

      // Build filter string
      const filters: string[] = [];

      if (query) {
        // Search in subject and body
        filters.push(`(contains(subject,'${query}') or contains(body/content,'${query}'))`);
      }

      if (after) {
        filters.push(`receivedDateTime ge ${after.toISOString()}`);
      }

      if (before) {
        filters.push(`receivedDateTime le ${before.toISOString()}`);
      }

      const filterString = filters.length > 0 ? `$filter=${filters.join(' and ')}` : '';
      const selectFields = '$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,body,bodyPreview,conversationId';
      const top = `$top=${maxResults}`;

      const queryParams = [selectFields, top, filterString].filter(Boolean).join('&');

      console.log('[OutlookFetch] Searching emails');

      // Fetch messages
      const data = await this._graphRequest<GraphApiListResponse<OutlookMessage>>(`/me/messages?${queryParams}`);
      const messages = data.value || [];

      console.log(`[OutlookFetch] Found ${messages.length} messages`);

      // Parse messages
      return messages.map(msg => this._parseMessage(msg));
    } catch (error) {
      console.error('[OutlookFetch] Search emails failed:', error);
      throw error;
    }
  }

  /**
   * Get email by ID
   * @param messageId - Outlook message ID
   * @returns Parsed email object
   */
  async getEmailById(messageId: string): Promise<ParsedOutlookEmail> {
    try {
      const data = await this._graphRequest<OutlookMessage>(`/me/messages/${messageId}`);
      return this._parseMessage(data);
    } catch (error) {
      console.error(`[OutlookFetch] Failed to get message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Parse Outlook message into structured format
   * @private
   */
  private _parseMessage(message: OutlookMessage): ParsedOutlookEmail {
    // Extract email addresses
    const getEmailAddress = (recipient: OutlookEmailAddress | null | undefined): string | null => {
      if (!recipient) return null;
      return recipient.emailAddress ? recipient.emailAddress.address : null;
    };

    const from = message.from ? getEmailAddress(message.from) : null;
    const to = message.toRecipients ? message.toRecipients.map(getEmailAddress).join(', ') : null;
    const cc = message.ccRecipients ? message.ccRecipients.map(getEmailAddress).join(', ') : null;
    const bcc = message.bccRecipients ? message.bccRecipients.map(getEmailAddress).join(', ') : null;

    // Extract body
    const body = message.body ? message.body.content : '';
    const bodyPlain = message.body && message.body.contentType === 'text'
      ? message.body.content
      : message.bodyPreview || '';

    return {
      id: message.id,
      threadId: message.conversationId,
      subject: message.subject,
      from: from,
      to: to,
      cc: cc,
      bcc: bcc,
      date: new Date(message.receivedDateTime),
      sentDate: new Date(message.sentDateTime),
      body: body,
      bodyPlain: bodyPlain,
      snippet: message.bodyPreview || '',
      hasAttachments: message.hasAttachments || false,
      attachmentCount: 0, // Would need separate call to get attachment count
      raw: message,
    };
  }

  /**
   * Get email attachments
   * @param messageId - Outlook message ID
   * @returns Array of attachments
   */
  async getAttachments(messageId: string): Promise<OutlookAttachment[]> {
    try {
      const data = await this._graphRequest<GraphApiListResponse<OutlookAttachment>>(`/me/messages/${messageId}/attachments`);
      return data.value || [];
    } catch (error) {
      console.error(`[OutlookFetch] Failed to get attachments:`, error);
      throw error;
    }
  }

  /**
   * Get specific attachment
   * @param messageId - Outlook message ID
   * @param attachmentId - Attachment ID
   * @returns Attachment data
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      const data = await this._graphRequest<OutlookAttachment>(`/me/messages/${messageId}/attachments/${attachmentId}`);

      if (data.contentBytes) {
        return Buffer.from(data.contentBytes, 'base64');
      }

      throw new Error('No attachment data found');
    } catch (error) {
      console.error(`[OutlookFetch] Failed to get attachment:`, error);
      throw error;
    }
  }

  /**
   * Get user's email address
   * @returns User's Outlook email address
   */
  async getUserEmail(): Promise<string> {
    try {
      const data = await this._graphRequest<OutlookUser>('/me');
      return data.mail || data.userPrincipalName;
    } catch (error) {
      console.error('[OutlookFetch] Failed to get user email:', error);
      throw error;
    }
  }

  /**
   * Get folders/mailboxes
   * @returns Array of mail folders
   */
  async getFolders(): Promise<OutlookFolder[]> {
    try {
      const data = await this._graphRequest<GraphApiListResponse<OutlookFolder>>('/me/mailFolders');
      return data.value || [];
    } catch (error) {
      console.error('[OutlookFetch] Failed to get folders:', error);
      throw error;
    }
  }
}

export default new OutlookFetchService();
