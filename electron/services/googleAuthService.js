/**
 * Google Auth Service
 * Handles Google OAuth authentication using Device Code Flow
 * Supports two-step consent: login (minimal scopes) + mailbox access (Gmail scopes)
 */

const { google } = require('googleapis');
require('dotenv').config({ path: '.env.development' });

class GoogleAuthService {
  constructor() {
    this.oauth2Client = null;
    this.initialized = false;
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

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'urn:ietf:wg:oauth:2.0:oob' // For device code flow
    );

    this.initialized = true;
    console.log('[GoogleAuth] Initialized successfully');
  }

  /**
   * Ensure client is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      this.initialize();
    }
  }

  /**
   * Authenticate for login (minimal scopes)
   * Step 1: Get user into the app
   * @param {Function} onDeviceCode - Callback with device code info
   * @returns {Object} Authentication result with user info and tokens
   */
  async authenticateForLogin(onDeviceCode) {
    this._ensureInitialized();

    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    try {
      console.log('[GoogleAuth] Starting login flow with minimal scopes');

      // Get device code
      const deviceCodeResponse = await this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'select_account', // Show account picker, only consent if needed
      });

      // For device code flow, we need to use a different approach
      // Google doesn't have native device code flow in googleapis library
      // We'll use the authorization code flow with manual user input

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'select_account', // Show account picker, only consent if needed
      });

      // Return auth URL for user to open in browser
      if (onDeviceCode) {
        onDeviceCode({
          authUrl,
          message: 'Please sign in using your browser',
        });
      }

      return {
        authUrl,
        scopes,
      };
    } catch (error) {
      console.error('[GoogleAuth] Login flow failed:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Object} Tokens and user info
   */
  async exchangeCodeForTokens(code) {
    this._ensureInitialized();

    try {
      console.log('[GoogleAuth] Exchanging code for tokens');

      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      console.log('[GoogleAuth] Tokens obtained successfully');

      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token);

      return {
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          scopes: tokens.scope ? tokens.scope.split(' ') : [],
        },
        userInfo,
      };
    } catch (error) {
      console.error('[GoogleAuth] Code exchange failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate for mailbox access (Gmail scopes)
   * Step 2: Connect to Gmail (incremental consent)
   * @param {Function} onDeviceCode - Callback with device code info
   * @returns {Object} Authentication result with tokens
   */
  async authenticateForMailbox(onDeviceCode) {
    this._ensureInitialized();

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
    ];

    try {
      console.log('[GoogleAuth] Starting mailbox connection flow');

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'select_account', // Show account picker, only consent if needed
      });

      if (onDeviceCode) {
        onDeviceCode({
          authUrl,
          message: 'Please grant Gmail access in your browser',
        });
      }

      return {
        authUrl,
        scopes,
      };
    } catch (error) {
      console.error('[GoogleAuth] Mailbox flow failed:', error);
      throw error;
    }
  }

  /**
   * Get user profile information
   * @param {string} accessToken - Access token
   * @returns {Object} User info
   */
  async getUserInfo(accessToken) {
    this._ensureInitialized();

    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });

      // Set credentials if provided
      if (accessToken) {
        this.oauth2Client.setCredentials({ access_token: accessToken });
      }

      const { data } = await oauth2.userinfo.get();

      console.log('[GoogleAuth] User info retrieved:', data.email);

      return {
        id: data.id,
        email: data.email,
        verified_email: data.verified_email,
        name: data.name,
        given_name: data.given_name,
        family_name: data.family_name,
        picture: data.picture,
        locale: data.locale,
      };
    } catch (error) {
      console.error('[GoogleAuth] Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New tokens
   */
  async refreshToken(refreshToken) {
    this._ensureInitialized();

    try {
      console.log('[GoogleAuth] Refreshing access token');

      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      console.log('[GoogleAuth] Token refreshed successfully');

      return {
        access_token: credentials.access_token,
        expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
      };
    } catch (error) {
      console.error('[GoogleAuth] Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Revoke tokens (sign out)
   * @param {string} accessToken - Access token to revoke
   */
  async revokeToken(accessToken) {
    this._ensureInitialized();

    try {
      console.log('[GoogleAuth] Revoking token');

      await this.oauth2Client.revokeToken(accessToken);

      console.log('[GoogleAuth] Token revoked successfully');
    } catch (error) {
      console.error('[GoogleAuth] Token revocation failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   * @param {string} accessToken - Access token to check
   * @returns {boolean} True if authenticated
   */
  async isAuthenticated(accessToken) {
    if (!accessToken) {
      return false;
    }

    try {
      // Try to get user info - if it works, token is valid
      await this.getUserInfo(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new GoogleAuthService();
