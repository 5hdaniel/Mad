"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
// NOTE: tokenEncryptionService removed - using session-only OAuth
// Tokens stored in encrypted database, no additional keychain encryption needed
const databaseService_1 = __importDefault(require("./databaseService"));
/**
 * Gmail Fetch Service
 * Fetches emails from Gmail for transaction extraction
 */
class GmailFetchService {
    constructor() {
        this.gmail = null;
        this.oauth2Client = null;
    }
    /**
     * Initialize Gmail API with user's OAuth tokens
     * @param userId - User ID to fetch tokens for
     */
    async initialize(userId) {
        try {
            // Get OAuth token from database
            const tokenRecord = await databaseService_1.default.getOAuthToken(userId, 'google', 'mailbox');
            if (!tokenRecord) {
                throw new Error('No Gmail OAuth token found. User needs to connect Gmail first.');
            }
            // Session-only OAuth: tokens stored unencrypted in encrypted database
            const accessToken = tokenRecord.access_token || '';
            const refreshToken = tokenRecord.refresh_token || null;
            // Initialize OAuth2 client
            const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
            // Set credentials
            oauth2Client.setCredentials({
                access_token: accessToken,
                refresh_token: refreshToken,
            });
            // Handle token refresh (session-only, no encryption needed)
            oauth2Client.on('tokens', async (tokens) => {
                console.log('[GmailFetch] Tokens refreshed');
                if (tokens.refresh_token) {
                    // Update refresh token in database (no encryption)
                    await databaseService_1.default.updateOAuthToken(tokenRecord.id, {
                        refresh_token: tokens.refresh_token,
                    });
                }
                if (tokens.access_token) {
                    // Update access token (no encryption)
                    await databaseService_1.default.updateOAuthToken(tokenRecord.id, {
                        access_token: tokens.access_token,
                        token_expires_at: new Date(Date.now() + (tokens.expiry_date || 3600000)).toISOString(),
                    });
                }
            });
            // Store client and initialize Gmail API
            this.oauth2Client = oauth2Client;
            this.gmail = googleapis_1.google.gmail({ version: 'v1', auth: oauth2Client });
            console.log('[GmailFetch] Initialized successfully');
            return true;
        }
        catch (error) {
            console.error('[GmailFetch] Initialization failed:', error);
            throw error;
        }
    }
    /**
     * Search for emails matching query
     * @param options - Search options
     * @returns Array of email messages
     */
    async searchEmails({ query = '', after = null, before = null, maxResults = 100 } = {}) {
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
            const fullMessages = await Promise.all(messages.map(msg => this.getEmailById(msg.id)));
            return fullMessages;
        }
        catch (error) {
            console.error('[GmailFetch] Search emails failed:', error);
            throw error;
        }
    }
    /**
     * Get email by ID
     * @param messageId - Gmail message ID
     * @returns Parsed email object
     */
    async getEmailById(messageId) {
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
        }
        catch (error) {
            console.error(`[GmailFetch] Failed to get message ${messageId}:`, error);
            throw error;
        }
    }
    /**
     * Parse Gmail message into structured format
     * @private
     */
    _parseMessage(message) {
        const headers = message.payload?.headers || [];
        const getHeader = (name) => {
            const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
            return header ? header.value || null : null;
        };
        // Extract body
        let body = '';
        let bodyPlain = '';
        const extractBody = (part) => {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                bodyPlain = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
            else if (part.mimeType === 'text/html' && part.body?.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
            if (part.parts) {
                part.parts.forEach(extractBody);
            }
        };
        if (message.payload?.parts) {
            message.payload.parts.forEach(extractBody);
        }
        else if (message.payload?.body?.data) {
            // Single part message
            const content = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
            if (message.payload.mimeType === 'text/plain') {
                bodyPlain = content;
            }
            else {
                body = content;
            }
        }
        // Extract attachments
        const attachments = [];
        const extractAttachments = (part) => {
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
    async getAttachment(messageId, attachmentId) {
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
        }
        catch (error) {
            console.error(`[GmailFetch] Failed to get attachment:`, error);
            throw error;
        }
    }
    /**
     * Get user's email address
     * @returns User's Gmail address
     */
    async getUserEmail() {
        try {
            if (!this.gmail) {
                throw new Error('Gmail API not initialized. Call initialize() first.');
            }
            const response = await this.gmail.users.getProfile({
                userId: 'me',
            });
            return response.data.emailAddress || '';
        }
        catch (error) {
            console.error('[GmailFetch] Failed to get user email:', error);
            throw error;
        }
    }
}
exports.default = new GmailFetchService();
