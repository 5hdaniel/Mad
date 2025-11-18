const axios = require('axios');
const tokenEncryptionService = require('./tokenEncryptionService');
const databaseService = require('./databaseService');
const microsoftAuthService = require('./microsoftAuthService');

/**
 * Outlook Fetch Service
 * Fetches emails from Outlook/Office 365 using Microsoft Graph API
 */
class OutlookFetchService {
  constructor() {
    this.graphApiUrl = 'https://graph.microsoft.com/v1.0';
    this.accessToken = null;
    this.userId = null;
    this.tokenRecord = null;
  }

  /**
   * Initialize Outlook API with user's OAuth tokens
   * @param {string} userId - User ID to fetch tokens for
   */
  async initialize(userId) {
    try {
      this.userId = userId;

      // Get OAuth token from database
      this.tokenRecord = await databaseService.getOAuthToken(userId, 'microsoft', 'mailbox');

      if (!this.tokenRecord) {
        throw new Error('No Outlook OAuth token found. User needs to connect Outlook first.');
      }

      // Decrypt access token
      this.accessToken = tokenEncryptionService.decrypt(this.tokenRecord.access_token);

      console.log('[OutlookFetch] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[OutlookFetch] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Refresh the access token using refresh token
   * @private
   */
  async _refreshAccessToken() {
    try {
      console.log('[OutlookFetch] Refreshing access token');

      if (!this.tokenRecord || !this.tokenRecord.refresh_token) {
        throw new Error('No refresh token available');
      }

      // Decrypt refresh token
      const refreshToken = tokenEncryptionService.decrypt(this.tokenRecord.refresh_token);

      // Refresh the token using Microsoft Auth Service
      const newTokens = await microsoftAuthService.refreshToken(refreshToken);

      // Encrypt new tokens
      const encryptedAccessToken = tokenEncryptionService.encrypt(newTokens.access_token);
      const encryptedRefreshToken = newTokens.refresh_token
        ? tokenEncryptionService.encrypt(newTokens.refresh_token)
        : this.tokenRecord.refresh_token; // Keep old refresh token if new one not provided

      // Update token in database
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
      await databaseService.updateOAuthToken(this.tokenRecord.id, {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: expiresAt,
      });

      // Update in-memory access token
      this.accessToken = newTokens.access_token;

      // Update tokenRecord with new values
      this.tokenRecord.access_token = encryptedAccessToken;
      this.tokenRecord.refresh_token = encryptedRefreshToken;
      this.tokenRecord.token_expires_at = expiresAt;

      console.log('[OutlookFetch] Access token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[OutlookFetch] Token refresh failed:', error);
      throw new Error('Failed to refresh access token. Please reconnect your Outlook account.');
    }
  }

  /**
   * Make authenticated request to Microsoft Graph API
   * @private
   */
  async _graphRequest(endpoint, method = 'GET', data = null, retryCount = 0) {
    try {
      const config = {
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
      return response.data;
    } catch (error) {
      // Handle token expiration - automatically refresh and retry once
      if (error.response && error.response.status === 401 && retryCount === 0) {
        console.log('[OutlookFetch] Access token expired, attempting refresh');
        try {
          await this._refreshAccessToken();
          // Retry the request with the new token
          return await this._graphRequest(endpoint, method, data, retryCount + 1);
        } catch (refreshError) {
          console.error('[OutlookFetch] Token refresh failed:', refreshError);
          throw new Error('Outlook connection expired. Please reconnect your Outlook account.');
        }
      }
      throw error;
    }
  }

  /**
   * Search for emails matching query
   * @param {Object} options - Search options
   * @param {string} options.query - Search query
   * @param {Date} options.after - Only emails after this date
   * @param {Date} options.before - Only emails before this date
   * @param {number} options.maxResults - Max number of results (default 100)
   * @returns {Promise<Array>} Array of email messages
   */
  async searchEmails({ query = '', after = null, before = null, maxResults = 100 } = {}) {
    try {
      if (!this.accessToken) {
        throw new Error('Outlook API not initialized. Call initialize() first.');
      }

      // Build filter string
      const filters = [];

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
      const data = await this._graphRequest(`/me/messages?${queryParams}`);
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
   * @param {string} messageId - Outlook message ID
   * @returns {Promise<Object>} Parsed email object
   */
  async getEmailById(messageId) {
    try {
      const data = await this._graphRequest(`/me/messages/${messageId}`);
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
  _parseMessage(message) {
    // Extract email addresses
    const getEmailAddress = (recipient) => {
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
      snippet: message.bodyPreview,
      hasAttachments: message.hasAttachments || false,
      attachmentCount: 0, // Would need separate call to get attachment count
      raw: message,
    };
  }

  /**
   * Get email attachments
   * @param {string} messageId - Outlook message ID
   * @returns {Promise<Array>} Array of attachments
   */
  async getAttachments(messageId) {
    try {
      const data = await this._graphRequest(`/me/messages/${messageId}/attachments`);
      return data.value || [];
    } catch (error) {
      console.error(`[OutlookFetch] Failed to get attachments:`, error);
      throw error;
    }
  }

  /**
   * Get specific attachment
   * @param {string} messageId - Outlook message ID
   * @param {string} attachmentId - Attachment ID
   * @returns {Promise<Buffer>} Attachment data
   */
  async getAttachment(messageId, attachmentId) {
    try {
      const data = await this._graphRequest(`/me/messages/${messageId}/attachments/${attachmentId}`);

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
   * @returns {Promise<string>} User's Outlook email address
   */
  async getUserEmail() {
    try {
      const data = await this._graphRequest('/me');
      return data.mail || data.userPrincipalName;
    } catch (error) {
      console.error('[OutlookFetch] Failed to get user email:', error);
      throw error;
    }
  }

  /**
   * Get folders/mailboxes
   * @returns {Promise<Array>} Array of mail folders
   */
  async getFolders() {
    try {
      const data = await this._graphRequest('/me/mailFolders');
      return data.value || [];
    } catch (error) {
      console.error('[OutlookFetch] Failed to get folders:', error);
      throw error;
    }
  }
}

module.exports = new OutlookFetchService();
