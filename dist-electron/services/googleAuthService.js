"use strict";
/**
 * Google Auth Service
 * Handles Google OAuth authentication using Authorization Code Flow with local redirect
 * Supports two-step consent: login (minimal scopes) + mailbox access (Gmail scopes)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const googleapis_1 = require("googleapis");
const http_1 = __importDefault(require("http"));
const url_1 = __importDefault(require("url"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.development' });
// ============================================
// SERVICE CLASS
// ============================================
class GoogleAuthService {
    constructor() {
        this.oauth2Client = null;
        this.initialized = false;
        this.redirectUri = 'http://localhost:3001/callback'; // Different port than Microsoft
        this.server = null;
    }
    /**
     * Initialize Google OAuth2 client
     */
    initialize() {
        if (this.initialized) {
            return;
        }
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            console.error('[GoogleAuth] Missing credentials. Check .env.development file.');
            throw new Error('Google OAuth credentials not configured');
        }
        console.log('[GoogleAuth] Initializing with client ID:', clientId.substring(0, 20) + '...');
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(clientId, clientSecret, this.redirectUri // Use local redirect URI
        );
        this.initialized = true;
        console.log('[GoogleAuth] Initialized successfully');
    }
    /**
     * Ensure client is initialized and return it
     * @private
     * @throws {Error} If client cannot be initialized
     */
    _ensureClient() {
        if (!this.initialized || !this.oauth2Client) {
            this.initialize();
        }
        if (!this.oauth2Client) {
            throw new Error('Google OAuth2 client is not initialized');
        }
        return this.oauth2Client;
    }
    /**
     * Start a temporary local HTTP server to catch OAuth redirect
     * @returns {Promise<string>} Authorization code from redirect
     */
    startLocalServer() {
        return new Promise((resolve, reject) => {
            this.server = http_1.default.createServer((req, res) => {
                const parsedUrl = url_1.default.parse(req.url || '', true);
                if (parsedUrl.pathname === '/callback') {
                    const code = parsedUrl.query.code;
                    const error = parsedUrl.query.error;
                    if (error) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Authentication Failed</title>
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                  <div style="text-align: center; background: white; padding: 3rem 4rem; border-radius: 1rem; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                      <svg style="width: 48px; height: 48px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </div>
                    <h1 style="color: #1a202c; font-size: 1.875rem; font-weight: 700; margin: 0 0 1rem 0;">Authentication Failed</h1>
                    <p style="color: #4a5568; font-size: 1rem; margin: 0 0 1.5rem 0; line-height: 1.5;">${parsedUrl.query.error_description || error}</p>
                    <p style="color: #718096; font-size: 0.875rem; margin: 0;">You can close this window and try again.</p>
                  </div>
                </body>
              </html>
            `);
                        this.stopLocalServer();
                        reject(new Error(parsedUrl.query.error_description || error));
                    }
                    else if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Authentication Successful</title>
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                  <div style="text-align: center; background: white; padding: 3rem 4rem; border-radius: 1rem; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                      <svg style="width: 48px; height: 48px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                    <h1 style="color: #1a202c; font-size: 1.875rem; font-weight: 700; margin: 0 0 1rem 0;">Authentication Successful!</h1>
                    <p id="status-message" style="color: #4a5568; font-size: 1rem; margin: 0 0 1.5rem 0; line-height: 1.5;">You've been successfully authenticated with Google.</p>
                    <p id="close-message" style="color: #718096; font-size: 0.875rem; margin: 0 0 1rem 0;">Attempting to close this window...</p>
                    <button id="return-button" style="display: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 0.75rem 2rem; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Return to Application</button>
                  </div>
                  <script>
                    // Try to close the window
                    setTimeout(() => {
                      window.close();

                      // If window didn't close (we're still here after 500ms), show fallback
                      setTimeout(() => {
                        const closeMsg = document.getElementById('close-message');
                        const returnBtn = document.getElementById('return-button');

                        closeMsg.innerHTML = 'Please return to the application to continue.';
                        closeMsg.style.color = '#4a5568';
                        closeMsg.style.fontSize = '1rem';
                        closeMsg.style.marginBottom = '1.5rem';
                        returnBtn.style.display = 'inline-block';

                        // Try to focus the app if possible (won't work in all browsers)
                        returnBtn.onclick = () => {
                          // Attempt to close again
                          window.close();
                          // If still here, user needs to manually return
                          if (!window.closed) {
                            closeMsg.innerHTML = 'You can close this tab and return to the Mad Accountant application.';
                          }
                        };
                      }, 500);
                    }, 2000);
                  </script>
                </body>
              </html>
            `);
                        this.stopLocalServer();
                        resolve(code);
                    }
                    else {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
              <html>
                <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                  <div style="text-align: center;">
                    <h1 style="color: #c33;">Invalid Request</h1>
                    <p style="color: #666;">No authorization code received.</p>
                  </div>
                </body>
              </html>
            `);
                    }
                }
            });
            this.server.listen(3001, 'localhost', () => {
                console.log('[GoogleAuth] Local callback server listening on http://localhost:3001');
            });
            this.server.on('error', (err) => {
                reject(err);
            });
        });
    }
    /**
     * Stop the local HTTP server
     */
    stopLocalServer() {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('[GoogleAuth] Local callback server stopped');
        }
    }
    /**
     * Authenticate for login (minimal scopes)
     * Step 1: Get user into the app
     * Opens browser, user logs in, redirects back to local server
     */
    async authenticateForLogin() {
        const client = this._ensureClient();
        const scopes = [
            'openid',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        ];
        try {
            console.log('[GoogleAuth] Starting login flow with minimal scopes');
            // Start local server to catch redirect
            const codePromise = this.startLocalServer();
            // Generate auth URL
            const authUrl = client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'select_account', // Show account picker, only consent if needed
            });
            console.log('[GoogleAuth] Auth URL generated, local server started');
            return {
                authUrl,
                codePromise,
                scopes,
            };
        }
        catch (error) {
            console.error('[GoogleAuth] Login flow failed:', error);
            this.stopLocalServer();
            throw error;
        }
    }
    /**
     * Exchange authorization code for tokens
     * @param code - Authorization code from OAuth callback
     * @returns Tokens and user info
     */
    async exchangeCodeForTokens(code) {
        const client = this._ensureClient();
        try {
            console.log('[GoogleAuth] Exchanging code for tokens');
            const { tokens } = await client.getToken(code);
            client.setCredentials(tokens);
            console.log('[GoogleAuth] Tokens obtained successfully');
            // Get user info
            const userInfo = await this.getUserInfo(tokens.access_token);
            return {
                tokens: {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token ?? undefined,
                    expires_at: tokens.expiry_date
                        ? new Date(tokens.expiry_date).toISOString()
                        : null,
                    scopes: tokens.scope ? tokens.scope.split(' ') : [],
                },
                userInfo,
            };
        }
        catch (error) {
            console.error('[GoogleAuth] Code exchange failed:', error);
            throw error;
        }
    }
    /**
     * Authenticate for mailbox access (Gmail scopes)
     * Step 2: Connect to Gmail (incremental consent)
     * Opens browser, user grants Gmail access, redirects back to local server
     * @param loginHint - Optional email to pre-fill
     */
    async authenticateForMailbox(loginHint) {
        const client = this._ensureClient();
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
        ];
        try {
            console.log('[GoogleAuth] Starting mailbox connection flow');
            // Start local server to catch redirect
            const codePromise = this.startLocalServer();
            // Generate auth URL with optional login hint
            const authUrlOptions = {
                access_type: 'offline',
                scope: scopes,
                prompt: 'select_account', // Show account picker, only consent if needed
            };
            if (loginHint) {
                authUrlOptions.login_hint = loginHint;
            }
            const authUrl = client.generateAuthUrl(authUrlOptions);
            console.log('[GoogleAuth] Mailbox auth URL generated, local server started');
            return {
                authUrl,
                codePromise,
                scopes,
            };
        }
        catch (error) {
            console.error('[GoogleAuth] Mailbox flow failed:', error);
            this.stopLocalServer();
            throw error;
        }
    }
    /**
     * Get user profile information
     * @param accessToken - Access token
     * @returns User info
     */
    async getUserInfo(accessToken) {
        const client = this._ensureClient();
        try {
            const oauth2 = googleapis_1.google.oauth2({ version: 'v2', auth: client });
            // Set credentials if provided
            if (accessToken) {
                client.setCredentials({ access_token: accessToken });
            }
            const { data } = await oauth2.userinfo.get();
            console.log('[GoogleAuth] User info retrieved:', data.email);
            return {
                id: data.id,
                email: data.email,
                verified_email: data.verified_email ?? undefined,
                name: data.name || undefined,
                given_name: data.given_name || undefined,
                family_name: data.family_name || undefined,
                picture: data.picture || undefined,
                locale: data.locale || undefined,
            };
        }
        catch (error) {
            console.error('[GoogleAuth] Failed to get user info:', error);
            throw error;
        }
    }
    /**
     * Refresh access token using refresh token
     * @param refreshToken - Refresh token
     * @returns New tokens
     */
    async refreshToken(refreshToken) {
        const client = this._ensureClient();
        try {
            console.log('[GoogleAuth] Refreshing access token');
            client.setCredentials({
                refresh_token: refreshToken,
            });
            const { credentials } = await client.refreshAccessToken();
            console.log('[GoogleAuth] Token refreshed successfully');
            return {
                access_token: credentials.access_token,
                expires_at: credentials.expiry_date
                    ? new Date(credentials.expiry_date).toISOString()
                    : null,
            };
        }
        catch (error) {
            console.error('[GoogleAuth] Token refresh failed:', error);
            throw error;
        }
    }
    /**
     * Revoke tokens (sign out)
     * @param accessToken - Access token to revoke
     */
    async revokeToken(accessToken) {
        const client = this._ensureClient();
        try {
            console.log('[GoogleAuth] Revoking token');
            await client.revokeToken(accessToken);
            console.log('[GoogleAuth] Token revoked successfully');
        }
        catch (error) {
            console.error('[GoogleAuth] Token revocation failed:', error);
            throw error;
        }
    }
    /**
     * Check if user is authenticated
     * @param accessToken - Access token to check
     * @returns True if authenticated
     */
    async isAuthenticated(accessToken) {
        if (!accessToken) {
            return false;
        }
        try {
            // Try to get user info - if it works, token is valid
            await this.getUserInfo(accessToken);
            return true;
        }
        catch {
            return false;
        }
    }
}
// Export singleton instance
exports.default = new GoogleAuthService();
