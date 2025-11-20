"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const msal_node_1 = require("@azure/msal-node");
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
class OutlookService {
    constructor() {
        this.msalInstance = null;
        this.graphClient = null;
        this.authWindow = null;
        this.accessToken = null;
        this.cacheLocation = null;
    }
    /**
     * Initialize MSAL with configuration from environment variables
     * Includes persistent token caching so users don't have to re-authenticate every time
     */
    async initialize(clientId, tenantId = 'common') {
        // Set up cache location in app's user data directory
        const userDataPath = electron_1.app.getPath('userData');
        this.cacheLocation = path_1.default.join(userDataPath, 'msal-cache.json');
        const msalConfig = {
            auth: {
                clientId: clientId,
                authority: `https://login.microsoftonline.com/${tenantId}`,
            },
            cache: {
                cachePlugin: {
                    beforeCacheAccess: async (cacheContext) => {
                        // Read cache from disk
                        if (fs_1.default.existsSync(this.cacheLocation)) {
                            const cacheData = fs_1.default.readFileSync(this.cacheLocation, 'utf8');
                            cacheContext.tokenCache.deserialize(cacheData);
                        }
                    },
                    afterCacheAccess: async (cacheContext) => {
                        // Write cache to disk if it changed
                        if (cacheContext.cacheHasChanged) {
                            fs_1.default.writeFileSync(this.cacheLocation, cacheContext.tokenCache.serialize());
                        }
                    },
                },
            },
            system: {
                loggerOptions: {
                    loggerCallback(loglevel, message) {
                        // Logging disabled for production
                    },
                    piiLoggingEnabled: false,
                    logLevel: 3,
                },
            },
        };
        this.msalInstance = new msal_node_1.PublicClientApplication(msalConfig);
    }
    /**
     * Authenticate user using device code flow (best for desktop apps)
     * Returns user account info on success
     */
    async authenticate(parentWindow) {
        if (!this.msalInstance) {
            throw new Error('OutlookService not initialized. Call initialize() first.');
        }
        const scopes = ['User.Read', 'Mail.Read'];
        try {
            // Try to get token silently from cache first
            const accounts = await this.msalInstance.getTokenCache().getAllAccounts();
            if (accounts.length > 0) {
                const silentRequest = {
                    account: accounts[0],
                    scopes: scopes,
                };
                try {
                    const response = await this.msalInstance.acquireTokenSilent(silentRequest);
                    this.accessToken = response.accessToken;
                    this.initializeGraphClient();
                    return { success: true, account: response.account ?? undefined };
                }
                catch (error) {
                    if (error instanceof msal_node_1.InteractionRequiredAuthError) {
                        // Need interactive auth
                    }
                    else {
                        throw error;
                    }
                }
            }
            // Interactive authentication using device code flow
            const deviceCodeRequest = {
                scopes: scopes,
                deviceCodeCallback: (response) => {
                    // Automatically open the browser for the user
                    // Open browser automatically
                    electron_1.shell.openExternal(response.verificationUri).catch(err => {
                        console.error('Failed to open browser:', err);
                    });
                    // Send to renderer if parentWindow is available
                    if (parentWindow && !parentWindow.isDestroyed()) {
                        parentWindow.webContents.send('device-code-received', {
                            verificationUri: response.verificationUri,
                            userCode: response.userCode,
                            message: response.message
                        });
                    }
                    return response;
                },
            };
            const response = await this.msalInstance.acquireTokenByDeviceCode(deviceCodeRequest);
            this.accessToken = response?.accessToken ?? null;
            this.initializeGraphClient();
            return {
                success: true,
                account: response?.account ?? undefined,
                userInfo: {
                    username: response?.account?.username ?? '',
                    name: response?.account?.name ?? undefined,
                }
            };
        }
        catch (error) {
            console.error('Authentication error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Initialize Microsoft Graph client with access token
     */
    initializeGraphClient() {
        this.graphClient = microsoft_graph_client_1.Client.init({
            authProvider: (done) => {
                done(null, this.accessToken);
            },
        });
    }
    /**
     * Get user's email address
     */
    async getUserEmail() {
        if (!this.graphClient) {
            throw new Error('Not authenticated. Call authenticate() first.');
        }
        try {
            const user = await this.graphClient.api('/me').get();
            return user.mail || user.userPrincipalName;
        }
        catch (error) {
            console.error('Error getting user email:', error);
            throw error;
        }
    }
    /**
     * Search for emails with a specific contact
     * @param {string} contactEmail - Email address to search for
     * @param {number} maxResults - Maximum number of emails to retrieve (default: 100)
     */
    async getEmailsWithContact(contactEmail, maxResults = 100) {
        if (!this.graphClient) {
            throw new Error('Not authenticated. Call authenticate() first.');
        }
        try {
            // Use Microsoft Graph API $search to filter on server-side
            // $search uses KQL (Keyword Query Language) and searches across from/to/cc/bcc
            const emailLower = contactEmail.toLowerCase();
            let matchingEmails = [];
            // Helper function to add timeout to promises
            const withTimeout = (promise, timeoutMs = 60000) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs))
                ]);
            };
            // Try $search first (server-side filtering)
            // $search requires the query to be quoted and uses KQL syntax
            let emailsToFetch = [];
            try {
                let response = await withTimeout(this.graphClient
                    .api('/me/messages')
                    .search(`"participants:${emailLower}"`)
                    .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,importance')
                    // Note: Cannot use .orderby() with $search - results are relevance-ranked
                    .top(maxResults)
                    .get(), 60000 // 60 second timeout
                );
                emailsToFetch = response.value || [];
            }
            catch (searchError) {
                // Fallback: Fetch and filter in memory with early stopping
                let nextLink = null;
                let pageCount = 0;
                const maxPages = 20;
                let response = await withTimeout(this.graphClient
                    .api('/me/messages')
                    .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,importance')
                    .orderby('receivedDateTime DESC')
                    .top(50)
                    .get(), 60000);
                const matchingEmailIds = [];
                let consecutivePagesWithNoMatches = 0;
                const maxConsecutivePagesWithNoMatches = 5;
                do {
                    const emails = response.value || [];
                    const matching = emails.filter(email => {
                        const fromEmail = email.from?.emailAddress?.address?.toLowerCase();
                        const toEmails = (email.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());
                        const ccEmails = (email.ccRecipients || []).map(r => r.emailAddress?.address?.toLowerCase());
                        return fromEmail === emailLower ||
                            toEmails.includes(emailLower) ||
                            ccEmails.includes(emailLower);
                    });
                    matchingEmailIds.push(...matching);
                    if (matching.length === 0) {
                        consecutivePagesWithNoMatches++;
                        if (consecutivePagesWithNoMatches >= maxConsecutivePagesWithNoMatches) {
                            break;
                        }
                    }
                    else {
                        consecutivePagesWithNoMatches = 0;
                    }
                    if (matchingEmailIds.length >= maxResults) {
                        break;
                    }
                    nextLink = response['@odata.nextLink'];
                    pageCount++;
                    if (nextLink && pageCount < maxPages) {
                        response = await withTimeout(this.graphClient.api(nextLink).get(), 60000);
                    }
                    else {
                        break;
                    }
                } while (nextLink && pageCount < maxPages);
                emailsToFetch = matchingEmailIds.slice(0, maxResults);
            }
            // PHASE 2: Fetch full body content for matching emails only
            for (let i = 0; i < emailsToFetch.length; i++) {
                const email = emailsToFetch[i];
                try {
                    // Fetch full email details including body
                    const fullEmail = await withTimeout(this.graphClient
                        .api(`/me/messages/${email.id}`)
                        .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,hasAttachments,importance')
                        .get(), 30000 // 30 second timeout per email
                    );
                    // Merge the body into the email object
                    matchingEmails.push(fullEmail);
                }
                catch (error) {
                    console.error(`[Email Fetch] Error fetching body for email ${email.id}:`, error.message);
                    // Still include the email but without body
                    matchingEmails.push(email);
                }
            }
            return matchingEmails;
        }
        catch (error) {
            console.error('[Email Fetch] Error fetching emails:', error);
            console.error('[Email Fetch] Error details:', {
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
                stack: error.stack
            });
            throw error;
        }
    }
    /**
     * Export emails to audit folder
     * @param {string} contactName - Name of the contact
     * @param {string} contactEmail - Email address of the contact
     * @param {string} exportPath - Path to export folder
     * @param {Function} onProgress - Optional callback for progress updates
     */
    async exportEmailsToAudit(contactName, contactEmail, exportPath, onProgress = null) {
        try {
            if (onProgress)
                onProgress({ stage: 'fetching', message: `Fetching emails for ${contactName}...` });
            const emails = await this.getEmailsWithContact(contactEmail);
            if (emails.length === 0) {
                if (onProgress)
                    onProgress({ stage: 'complete', message: 'No emails found' });
                return {
                    success: true,
                    message: 'No emails found for this contact',
                    emailCount: 0,
                };
            }
            if (onProgress)
                onProgress({
                    stage: 'processing',
                    message: `Processing ${emails.length} emails for ${contactName}...`,
                    current: 0,
                    total: emails.length
                });
            // Create contact folder inside the export path
            const sanitizedName = contactName.replace(/[^a-z0-9 ]/gi, '_');
            const contactFolder = path_1.default.join(exportPath, sanitizedName);
            if (!fs_1.default.existsSync(contactFolder)) {
                fs_1.default.mkdirSync(contactFolder, { recursive: true });
            }
            // Export as text file
            const fileName = `emails.txt`;
            const filePath = path_1.default.join(contactFolder, fileName);
            let content = `EMAIL AUDIT REPORT\n`;
            content += `===================\n\n`;
            content += `Contact: ${contactName}\n`;
            content += `Email: ${contactEmail}\n`;
            content += `Export Date: ${new Date().toLocaleString()}\n`;
            content += `Total Emails: ${emails.length}\n`;
            content += `\n${'='.repeat(80)}\n\n`;
            // Sort emails by date (oldest first)
            emails.sort((a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());
            emails.forEach((email, index) => {
                content += `EMAIL ${index + 1}\n`;
                content += `${'-'.repeat(80)}\n`;
                content += `Date: ${new Date(email.receivedDateTime).toLocaleString()}\n`;
                // Handle from field safely
                if (email.from && email.from.emailAddress) {
                    const fromName = email.from.emailAddress.name || 'Unknown';
                    const fromAddress = email.from.emailAddress.address || 'unknown@unknown.com';
                    content += `From: ${fromName} <${fromAddress}>\n`;
                }
                else {
                    content += `From: Unknown\n`;
                }
                if (email.toRecipients && email.toRecipients.length > 0) {
                    const recipients = email.toRecipients
                        .filter(r => r.emailAddress)
                        .map(r => `${r.emailAddress.name || 'Unknown'} <${r.emailAddress.address || 'unknown@unknown.com'}>`)
                        .join(', ');
                    if (recipients) {
                        content += `To: ${recipients}\n`;
                    }
                }
                if (email.ccRecipients && email.ccRecipients.length > 0) {
                    const cc = email.ccRecipients
                        .filter(r => r.emailAddress)
                        .map(r => `${r.emailAddress.name || 'Unknown'} <${r.emailAddress.address || 'unknown@unknown.com'}>`)
                        .join(', ');
                    if (cc) {
                        content += `CC: ${cc}\n`;
                    }
                }
                content += `Subject: ${email.subject || '(No Subject)'}\n`;
                content += `Importance: ${email.importance || 'normal'}\n`;
                if (email.hasAttachments) {
                    content += `Attachments: Yes\n`;
                }
                content += `\n`;
                // Add email body (plain text or HTML stripped)
                if (email.body) {
                    let bodyText = email.body.content;
                    // If HTML, strip basic tags for readability
                    if (email.body.contentType === 'html') {
                        bodyText = bodyText
                            .replace(/<style[^>]*>.*?<\/style>/gs, '')
                            .replace(/<script[^>]*>.*?<\/script>/gs, '')
                            .replace(/<[^>]+>/g, '')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .trim();
                    }
                    content += bodyText.trim();
                }
                content += `\n\n${'='.repeat(80)}\n\n`;
            });
            // Write to file
            fs_1.default.writeFileSync(filePath, content, 'utf8');
            // Also export as JSON for potential future use
            const jsonFileName = `emails.json`;
            const jsonFilePath = path_1.default.join(contactFolder, jsonFileName);
            fs_1.default.writeFileSync(jsonFilePath, JSON.stringify(emails, null, 2), 'utf8');
            return {
                success: true,
                emailCount: emails.length,
                exportPath: contactFolder,
                files: [fileName, jsonFileName],
            };
        }
        catch (error) {
            console.error('Error exporting emails:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.accessToken !== null && this.graphClient !== null;
    }
    /**
     * Sign out and clear cached tokens
     */
    async signOut() {
        if (this.msalInstance) {
            const accounts = await this.msalInstance.getTokenCache().getAllAccounts();
            for (const account of accounts) {
                await this.msalInstance.getTokenCache().removeAccount(account);
            }
        }
        // Delete cache file from disk
        if (this.cacheLocation && fs_1.default.existsSync(this.cacheLocation)) {
            fs_1.default.unlinkSync(this.cacheLocation);
        }
        this.accessToken = null;
        this.graphClient = null;
    }
}
exports.default = OutlookService;
