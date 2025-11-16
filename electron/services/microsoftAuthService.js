const axios = require('axios');

/**
 * Microsoft OAuth Service
 * Handles Microsoft authentication with device code flow
 * Two-step process: Login authentication vs Mailbox access
 */
class MicrosoftAuthService {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

    // Microsoft OAuth2 endpoints
    this.authorizeUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`;
    this.tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    this.deviceCodeUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/devicecode`;

    // Redirect URI for desktop applications
    // Using http://localhost which is commonly pre-configured for mobile/desktop apps
    this.redirectUri = 'http://localhost';
  }

  /**
   * Step 1: Authenticate for Login (minimal scopes)
   * Only requests basic profile information
   * @returns {Promise<{authUrl: string, scopes: string[]}>}
   */
  async authenticateForLogin(onDeviceCode) {
    const scopes = [
      'openid',
      'profile',
      'email',
      'User.Read', // Basic Microsoft Graph profile access
      'offline_access' // For refresh tokens
    ];

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      response_mode: 'query',
      prompt: 'consent' // Force consent to get refresh token
    });

    const authUrl = `${this.authorizeUrl}?${params.toString()}`;

    return {
      authUrl,
      scopes
    };
  }

  /**
   * Step 2: Authenticate for Mailbox Access
   * Requests full mailbox permissions
   * @param {string} userId - User ID to associate mailbox with
   * @returns {Promise<{authUrl: string, scopes: string[]}>}
   */
  async authenticateForMailbox(userId) {
    const scopes = [
      'openid',
      'profile',
      'email',
      'User.Read',
      'Mail.Read',
      'Mail.ReadWrite',
      'offline_access'
    ];

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes.join(' '),
      response_mode: 'query',
      prompt: 'consent',
      login_hint: userId // Pre-fill the email
    });

    const authUrl = `${this.authorizeUrl}?${params.toString()}`;

    return {
      authUrl,
      scopes
    };
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth flow
   * @returns {Promise<{access_token: string, refresh_token: string, expires_in: number, scope: string}>}
   */
  async exchangeCodeForTokens(code) {
    try {
      const params = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code'
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
        client_secret: this.clientSecret,
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
   * Note: Microsoft doesn't have a token revocation endpoint
   * Tokens will expire naturally or can be invalidated by changing password
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
   * @returns {Promise<{emailAddress: string, displayName: string}>}
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
