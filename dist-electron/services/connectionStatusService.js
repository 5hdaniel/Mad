"use strict";
/**
 * Connection Status Service
 * Monitor OAuth connections to Google and Microsoft
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const databaseService_1 = __importDefault(require("./databaseService"));
const googleAuthService_1 = __importDefault(require("./googleAuthService"));
const microsoftAuthService_1 = __importDefault(require("./microsoftAuthService"));
class ConnectionStatusService {
    constructor() {
        this.connectionStatus = {
            google: { connected: false, lastCheck: null, error: null },
            microsoft: { connected: false, lastCheck: null, error: null },
        };
    }
    /**
     * Check Google OAuth connection status
     * @param userId
     * @returns Connection status
     */
    async checkGoogleConnection(userId) {
        try {
            // Get Google auth token from database
            const token = await databaseService_1.default.getOAuthToken(userId, 'google', 'mailbox');
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
            const tokenExpiry = new Date(token.token_expires_at || 0);
            const now = new Date();
            if (tokenExpiry < now) {
                // Token expired - try to refresh
                console.log('[ConnectionStatus] Google token expired, attempting refresh...');
                try {
                    const refreshResult = await googleAuthService_1.default.refreshAccessToken(userId);
                    if (refreshResult.success) {
                        console.log('[ConnectionStatus] Google token refreshed successfully');
                        this.connectionStatus.google = {
                            connected: true,
                            lastCheck: Date.now(),
                            email: token.connected_email_address,
                            error: null,
                        };
                        return this.connectionStatus.google;
                    }
                    else {
                        console.error('[ConnectionStatus] Google token refresh failed:', refreshResult.error);
                    }
                }
                catch (refreshError) {
                    console.error('[ConnectionStatus] Google token refresh error:', refreshError);
                }
                // Refresh failed, mark as expired
                this.connectionStatus.google = {
                    connected: false,
                    lastCheck: Date.now(),
                    error: {
                        type: 'TOKEN_REFRESH_FAILED',
                        userMessage: 'Gmail connection expired',
                        action: 'Reconnect your Gmail account',
                        actionHandler: 'reconnect-google',
                        details: 'Failed to refresh authentication token',
                    },
                };
                return this.connectionStatus.google;
            }
            // Token is valid
            this.connectionStatus.google = {
                connected: true,
                lastCheck: Date.now(),
                email: token.connected_email_address,
                error: null,
            };
            return this.connectionStatus.google;
        }
        catch (error) {
            console.error('[ConnectionStatus] Error checking Google connection:', error);
            this.connectionStatus.google = {
                connected: false,
                lastCheck: Date.now(),
                error: {
                    type: 'CONNECTION_CHECK_FAILED',
                    userMessage: 'Could not verify Gmail connection',
                    action: 'Check your Gmail connection',
                    actionHandler: 'reconnect-google',
                    details: error.message,
                },
            };
            return this.connectionStatus.google;
        }
    }
    /**
     * Check Microsoft OAuth connection status
     * @param userId
     * @returns Connection status
     */
    async checkMicrosoftConnection(userId) {
        try {
            // Get Microsoft auth token from database
            const token = await databaseService_1.default.getOAuthToken(userId, 'microsoft', 'mailbox');
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
            const tokenExpiry = new Date(token.token_expires_at || 0);
            const now = new Date();
            if (tokenExpiry < now) {
                // Token expired - try to refresh
                console.log('[ConnectionStatus] Microsoft token expired, attempting refresh...');
                try {
                    const refreshResult = await microsoftAuthService_1.default.refreshAccessToken(userId);
                    if (refreshResult.success) {
                        console.log('[ConnectionStatus] Microsoft token refreshed successfully');
                        this.connectionStatus.microsoft = {
                            connected: true,
                            lastCheck: Date.now(),
                            email: token.connected_email_address,
                            error: null,
                        };
                        return this.connectionStatus.microsoft;
                    }
                    else {
                        console.error('[ConnectionStatus] Microsoft token refresh failed:', refreshResult.error);
                    }
                }
                catch (refreshError) {
                    console.error('[ConnectionStatus] Microsoft token refresh error:', refreshError);
                }
                // Refresh failed, mark as expired
                this.connectionStatus.microsoft = {
                    connected: false,
                    lastCheck: Date.now(),
                    error: {
                        type: 'TOKEN_REFRESH_FAILED',
                        userMessage: 'Outlook connection expired',
                        action: 'Reconnect your Outlook account',
                        actionHandler: 'reconnect-microsoft',
                        details: 'Failed to refresh authentication token',
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
        }
        catch (error) {
            console.error('[ConnectionStatus] Error checking Microsoft connection:', error);
            this.connectionStatus.microsoft = {
                connected: false,
                lastCheck: Date.now(),
                error: {
                    type: 'CONNECTION_CHECK_FAILED',
                    userMessage: 'Could not verify Outlook connection',
                    action: 'Check your Outlook connection',
                    actionHandler: 'reconnect-microsoft',
                    details: error.message,
                },
            };
            return this.connectionStatus.microsoft;
        }
    }
    /**
     * Check all connections
     * @param userId
     * @returns All connection statuses
     */
    async checkAllConnections(userId) {
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
    getCachedStatus(maxAge = 60000) {
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
            allConnected: this.connectionStatus.google.connected && this.connectionStatus.microsoft.connected,
            anyConnected: this.connectionStatus.google.connected || this.connectionStatus.microsoft.connected,
        };
    }
    /**
     * Clear connection cache
     */
    clearCache() {
        this.connectionStatus = {
            google: { connected: false, lastCheck: null, error: null },
            microsoft: { connected: false, lastCheck: null, error: null },
        };
    }
    /**
     * Format error message for user display
     * @param error
     * @returns Formatted error
     */
    formatUserError(error) {
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
exports.default = new ConnectionStatusService();
