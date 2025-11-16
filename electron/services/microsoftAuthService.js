const { PublicClientApplication } = require('@azure/msal-node');
const axios = require('axios');

/**
 * Microsoft OAuth Service using MSAL Device Code Flow
 * Consistent with existing OutlookService implementation
 * No redirect URI configuration needed
 */
class MicrosoftAuthService {
  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID;
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    this.msalInstance = null;
  }

  /**
   * Initialize MSAL instance
   */
  initialize() {
    if (!this.msalInstance) {
      const msalConfig = {
        auth: {
          clientId: this.clientId,
          authority: `https://login.microsoftonline.com/${this.tenantId}`,
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

      this.msalInstance = new PublicClientApplication(msalConfig);
    }
  }

  /**
   * Step 1: Authenticate for Login (minimal scopes)
   * Uses device code flow - no redirect URI needed
   * @param {Function} onDeviceCode - Callback to send device code info to renderer
   * @returns {Promise<{authUrl: string, scopes: string[]}>}
   */
  async authenticateForLogin(onDeviceCode) {
    this.initialize();

    const scopes = [
      'openid',
      'profile',
      'email',
      'User.Read',
      'offline_access'
    ];

    // Device code flow - returns URL and user code for manual entry
    const deviceCodeRequest = {
      scopes: scopes,
      deviceCodeCallback: (response) => {
        // Send device code info to renderer
        if (onDeviceCode) {
          onDeviceCode({
            verificationUri: response.verificationUri,
            userCode: response.userCode,
            message: response.message,
            expiresIn: response.expiresIn
          });
        }
      },
    };

    // This will wait for user to complete authentication in browser
    const authResponse = await this.msalInstance.acquireTokenByDeviceCode(deviceCodeRequest);

    return {
      authResponse,
      scopes
    };
  }

  /**
   * Step 2: Authenticate for Mailbox Access
   * Requests full mailbox permissions
   * @param {string} loginHint - User email to pre-fill
   * @param {Function} onDeviceCode - Callback to send device code info to renderer
   * @returns {Promise<{authResponse: object, scopes: string[]}>}
   */
  async authenticateForMailbox(loginHint, onDeviceCode) {
    this.initialize();

    const scopes = [
      'openid',
      'profile',
      'email',
      'User.Read',
      'Mail.Read',
      'Mail.ReadWrite',
      'offline_access'
    ];

    const deviceCodeRequest = {
      scopes: scopes,
      deviceCodeCallback: (response) => {
        if (onDeviceCode) {
          onDeviceCode({
            verificationUri: response.verificationUri,
            userCode: response.userCode,
            message: response.message,
            expiresIn: response.expiresIn
          });
        }
      },
    };

    if (loginHint) {
      deviceCodeRequest.loginHint = loginHint;
    }

    const authResponse = await this.msalInstance.acquireTokenByDeviceCode(deviceCodeRequest);

    return {
      authResponse,
      scopes
    };
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
    this.initialize();

    // MSAL handles refresh tokens internally
    // Get account from cache and use silent token acquisition
    const accounts = await this.msalInstance.getTokenCache().getAllAccounts();

    if (accounts.length === 0) {
      throw new Error('No accounts found in cache');
    }

    const silentRequest = {
      account: accounts[0],
      scopes: ['User.Read', 'openid', 'profile', 'email', 'offline_access'],
      forceRefresh: true
    };

    const response = await this.msalInstance.acquireTokenSilent(silentRequest);

    return {
      access_token: response.accessToken,
      refresh_token: response.refreshToken || refreshToken,
      expires_in: response.expiresOn ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000) : 3600
    };
  }

  /**
   * Revoke access token (logout)
   * @param {string} accessToken - Access token to revoke
   */
  async revokeToken(accessToken) {
    this.initialize();

    // Remove all accounts from cache
    const accounts = await this.msalInstance.getTokenCache().getAllAccounts();
    for (const account of accounts) {
      await this.msalInstance.getTokenCache().removeAccount(account);
    }

    return { success: true, message: 'Token revoked and cache cleared' };
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
