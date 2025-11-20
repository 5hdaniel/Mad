/**
 * Connection Status Service
 * Monitor OAuth connections to Google and Microsoft
 */

import databaseService from './databaseService';
import googleAuthService from './googleAuthService';

/**
 * Connection error type
 */
interface ConnectionError {
  type: 'NOT_CONNECTED' | 'TOKEN_REFRESH_FAILED' | 'TOKEN_EXPIRED' | 'CONNECTION_CHECK_FAILED';
  userMessage: string;
  action: string;
  actionHandler: string;
  details?: string;
}

/**
 * Connection status for a provider
 */
interface ProviderConnectionStatus {
  connected: boolean;
  lastCheck: number | null;
  email?: string;
  error: ConnectionError | null;
}

/**
 * All connections status
 */
interface AllConnectionsStatus {
  google: ProviderConnectionStatus;
  microsoft: ProviderConnectionStatus;
  allConnected: boolean;
  anyConnected: boolean;
}

/**
 * Formatted user error
 */
interface FormattedUserError {
  title: string;
  message: string;
  action: string;
  actionHandler: string;
  details?: string;
  severity: 'info' | 'warning';
}

/**
 * Connection status storage
 */
interface ConnectionStatusStorage {
  google: ProviderConnectionStatus;
  microsoft: ProviderConnectionStatus;
}

class ConnectionStatusService {
  private connectionStatus: ConnectionStatusStorage = {
    google: { connected: false, lastCheck: null, error: null },
    microsoft: { connected: false, lastCheck: null, error: null },
  };

  /**
   * Check Google OAuth connection status
   * @param userId - User ID
   * @returns Connection status
   */
  async checkGoogleConnection(userId: string): Promise<ProviderConnectionStatus> {
    try {
      // Get Google auth token from database
      const token = await databaseService.getOAuthToken(userId, 'google', 'mailbox');

      if (!token || !token.access_token) {
        this.connectionStatus.google = {
          connected: false,
          lastCheck: Date.now(),
          error: {
            type: 'NOT_CONNECTED',
            userMessage: 'Gmail is not connected',
            action: 'Connect your Gmail account to access emails',
            actionHandler: 'connect-google',
          },
        };
        return this.connectionStatus.google;
      }

      // Check if token is expired
      const tokenExpiry = new Date(token.token_expires_at!);
      const now = new Date();

      if (tokenExpiry < now) {
        // Token expired - try to refresh
        try {
          const refreshResult = await googleAuthService.refreshAccessToken(userId);
          if (refreshResult.success) {
            this.connectionStatus.google = {
              connected: true,
              lastCheck: Date.now(),
              email: token.connected_email_address,
              error: null,
            };
            return this.connectionStatus.google;
          }
        } catch (refreshError) {
          this.connectionStatus.google = {
            connected: false,
            lastCheck: Date.now(),
            error: {
              type: 'TOKEN_REFRESH_FAILED',
              userMessage: 'Gmail connection expired',
              action: 'Reconnect your Gmail account',
              actionHandler: 'reconnect-google',
              details: (refreshError as Error).message,
            },
          };
          return this.connectionStatus.google;
        }
      }

      // Token is valid
      this.connectionStatus.google = {
        connected: true,
        lastCheck: Date.now(),
        email: token.connected_email_address,
        error: null,
      };
      return this.connectionStatus.google;
    } catch (error) {
      console.error('[ConnectionStatus] Error checking Google connection:', error);

      this.connectionStatus.google = {
        connected: false,
        lastCheck: Date.now(),
        error: {
          type: 'CONNECTION_CHECK_FAILED',
          userMessage: 'Could not verify Gmail connection',
          action: 'Check your Gmail connection',
          actionHandler: 'reconnect-google',
          details: (error as Error).message,
        },
      };
      return this.connectionStatus.google;
    }
  }

  /**
   * Check Microsoft OAuth connection status
   * @param userId - User ID
   * @returns Connection status
   */
  async checkMicrosoftConnection(userId: string): Promise<ProviderConnectionStatus> {
    try {
      // Get Microsoft auth token from database
      const token = await databaseService.getOAuthToken(userId, 'microsoft', 'mailbox');

      if (!token || !token.access_token) {
        this.connectionStatus.microsoft = {
          connected: false,
          lastCheck: Date.now(),
          error: {
            type: 'NOT_CONNECTED',
            userMessage: 'Outlook is not connected',
            action: 'Connect your Outlook account to access emails',
            actionHandler: 'connect-microsoft',
          },
        };
        return this.connectionStatus.microsoft;
      }

      // Check if token is expired
      const tokenExpiry = new Date(token.token_expires_at!);
      const now = new Date();

      if (tokenExpiry < now) {
        this.connectionStatus.microsoft = {
          connected: false,
          lastCheck: Date.now(),
          error: {
            type: 'TOKEN_EXPIRED',
            userMessage: 'Outlook connection expired',
            action: 'Reconnect your Outlook account',
            actionHandler: 'reconnect-microsoft',
            details: 'Authentication token has expired',
          },
        };
        return this.connectionStatus.microsoft;
      }

      // Token is valid
      this.connectionStatus.microsoft = {
        connected: true,
        lastCheck: Date.now(),
        email: token.connected_email_address,
        error: null,
      };
      return this.connectionStatus.microsoft;
    } catch (error) {
      console.error('[ConnectionStatus] Error checking Microsoft connection:', error);

      this.connectionStatus.microsoft = {
        connected: false,
        lastCheck: Date.now(),
        error: {
          type: 'CONNECTION_CHECK_FAILED',
          userMessage: 'Could not verify Outlook connection',
          action: 'Check your Outlook connection',
          actionHandler: 'reconnect-microsoft',
          details: (error as Error).message,
        },
      };
      return this.connectionStatus.microsoft;
    }
  }

  /**
   * Check all connections
   * @param userId - User ID
   * @returns All connections status
   */
  async checkAllConnections(userId: string): Promise<AllConnectionsStatus> {
    const [google, microsoft] = await Promise.all([
      this.checkGoogleConnection(userId),
      this.checkMicrosoftConnection(userId),
    ]);

    return {
      google,
      microsoft,
      allConnected: google.connected && microsoft.connected,
      anyConnected: google.connected || microsoft.connected,
    };
  }

  /**
   * Get cached connection status (avoid repeated database queries)
   * @param maxAge - Maximum cache age in milliseconds (default: 60 seconds)
   * @returns Cached status or null if expired
   */
  getCachedStatus(maxAge: number = 60000): AllConnectionsStatus | null {
    const googleAge = this.connectionStatus.google.lastCheck
      ? Date.now() - this.connectionStatus.google.lastCheck
      : Infinity;
    const microsoftAge = this.connectionStatus.microsoft.lastCheck
      ? Date.now() - this.connectionStatus.microsoft.lastCheck
      : Infinity;

    if (googleAge > maxAge || microsoftAge > maxAge) {
      return null;
    }

    return {
      google: this.connectionStatus.google,
      microsoft: this.connectionStatus.microsoft,
      allConnected:
        this.connectionStatus.google.connected && this.connectionStatus.microsoft.connected,
      anyConnected:
        this.connectionStatus.google.connected || this.connectionStatus.microsoft.connected,
    };
  }

  /**
   * Clear connection cache
   */
  clearCache(): void {
    this.connectionStatus = {
      google: { connected: false, lastCheck: null, error: null },
      microsoft: { connected: false, lastCheck: null, error: null },
    };
  }

  /**
   * Format error message for user display
   * @param error - Connection error
   * @returns Formatted error for user
   */
  formatUserError(error: ConnectionError): FormattedUserError {
    return {
      title: error.type === 'NOT_CONNECTED' ? 'Not Connected' : 'Connection Lost',
      message: error.userMessage,
      action: error.action,
      actionHandler: error.actionHandler,
      details: error.details,
      severity: error.type === 'NOT_CONNECTED' ? 'info' : 'warning',
    };
  }
}

export default new ConnectionStatusService();
