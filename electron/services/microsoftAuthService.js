const axios = require('axios');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

/**
 * Microsoft OAuth Service with Authorization Code Flow
 * Uses temporary local HTTP server to catch redirect
 * Better UX than device code flow - browser redirects back to app
 */
class MicrosoftAuthService {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    // Note: client_secret not needed for public clients (desktop apps)
    // We use PKCE (Proof Key for Code Exchange) for security instead
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    this.redirectUri = 'http://localhost:3000/callback';

    // Microsoft OAuth2 endpoints
    this.authorizeUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`;
    this.tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;

    this.server = null;
  }

  /**
   * Start a temporary local HTTP server to catch OAuth redirect
   * @returns {Promise<string>} Authorization code from redirect
   */
  startLocalServer() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);

        if (parsedUrl.pathname === '/callback') {
          const code = parsedUrl.query.code;
          const error = parsedUrl.query.error;

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fee;">
                  <div style="text-align: center;">
                    <h1 style="color: #c33;">❌ Authentication Failed</h1>
                    <p style="color: #666;">${parsedUrl.query.error_description || error}</p>
                    <p style="color: #999; font-size: 14px;">You can close this window.</p>
                  </div>
                </body>
              </html>
            `);
            this.stopLocalServer();
            reject(new Error(parsedUrl.query.error_description || error));
          } else if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; display: flex; align-items: center; justify-center; height: 100vh; margin: 0; background: #efe;">
                  <div style="text-align: center;">
                    <h1 style="color: #383;">✓ Authentication Successful</h1>
                    <p style="color: #666;">You can close this window and return to the app.</p>
                  </div>
                  <script>setTimeout(() => window.close(), 2000);</script>
                </body>
              </html>
            `);
            this.stopLocalServer();
            resolve(code);
          } else {
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

      this.server.listen(3000, 'localhost', () => {
        console.log('[MicrosoftAuth] Local callback server listening on http://localhost:3000');
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
      console.log('[MicrosoftAuth] Local callback server stopped');
    }
  }

  /**
   * Step 1: Authenticate for Login (minimal scopes)
   * Opens browser, user logs in, redirects back to local server
   * @returns {Promise<{authUrl: string, code: Promise<string>, scopes: string[]}>}
   */
  async authenticateForLogin() {
    const scopes = [
      'openid',
      'profile',
      'email',
      'User.Read',
      'offline_access'
    ];

    // Generate PKCE challenge (optional but recommended)
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      response_mode: 'query',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `${this.authorizeUrl}?${params.toString()}`;

    // Start local server to catch redirect
    const codePromise = this.startLocalServer();

    return {
      authUrl,
      codePromise,
      codeVerifier,
      scopes
    };
  }

  /**
   * Step 2: Authenticate for Mailbox Access
   * Requests full mailbox permissions
   * @param {string} loginHint - User email to pre-fill
   * @returns {Promise<{authUrl: string, code: Promise<string>, scopes: string[]}>}
   */
  async authenticateForMailbox(loginHint) {
    const scopes = [
      'openid',
      'profile',
      'email',
      'User.Read',
      'Mail.Read',
      'Mail.ReadWrite',
      'offline_access'
    ];

    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      response_mode: 'query',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    if (loginHint) {
      params.append('login_hint', loginHint);
    }

    const authUrl = `${this.authorizeUrl}?${params.toString()}`;
    const codePromise = this.startLocalServer();

    return {
      authUrl,
      codePromise,
      codeVerifier,
      scopes
    };
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth flow
   * @param {string} codeVerifier - PKCE code verifier
   * @returns {Promise<{access_token: string, refresh_token: string, expires_in: number, scope: string}>}
   */
  async exchangeCodeForTokens(code, codeVerifier) {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        code: code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      });

      const response = await axios.post(this.tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error_description || 'Failed to exchange authorization code');
    }
  }

  /**
   * Get user information from Microsoft Graph API
   * @param {string} accessToken - Access token
   * @returns {Promise<{id: string, email: string, name: string, given_name: string, family_name: string}>}
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const user = response.data;

      return {
        id: user.id,
        email: user.mail || user.userPrincipalName,
        name: user.displayName,
        given_name: user.givenName,
        family_name: user.surname
      };
    } catch (error) {
      console.error('Error getting user info:', error.response?.data || error.message);
      throw new Error('Failed to get user information');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{access_token: string, refresh_token: string, expires_in: number}>}
   */
  async refreshToken(refreshToken) {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const response = await axios.post(this.tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Revoke access token (logout)
   * @param {string} accessToken - Access token to revoke
   */
  async revokeToken(accessToken) {
    // Microsoft OAuth2 doesn't provide a revocation endpoint
    // For proper logout, direct user to: https://login.microsoftonline.com/common/oauth2/v2.0/logout
    console.log('Microsoft tokens cannot be revoked programmatically. User should sign out from Microsoft account.');
    return { success: true, message: 'Token will expire naturally' };
  }

  /**
   * Get mailbox metadata (for testing connection)
   * @param {string} accessToken - Access token with Mail.Read scope
   * @returns {Promise<{displayName: string, totalItemCount: number, unreadItemCount: number}>}
   */
  async getMailboxInfo(accessToken) {
    try {
      const response = await axios.get('https://graph.microsoft.com/v1.0/me/mailFolders/inbox', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return {
        displayName: response.data.displayName,
        totalItemCount: response.data.totalItemCount,
        unreadItemCount: response.data.unreadItemCount
      };
    } catch (error) {
      console.error('Error getting mailbox info:', error.response?.data || error.message);
      throw new Error('Failed to get mailbox information');
    }
  }
}

// Export singleton instance
module.exports = new MicrosoftAuthService();
