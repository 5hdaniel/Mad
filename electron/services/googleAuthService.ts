/**
 * Google Auth Service
 * Handles Google OAuth authentication using Authorization Code Flow with local redirect
 * Supports two-step consent: login (minimal scopes) + mailbox access (Gmail scopes)
 *
 * Note: Environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are loaded
 * centrally in electron/main.ts via dotenv. Do not import dotenv here.
 */

import { google, Auth } from "googleapis";
import http from "http";
import url from "url";
import databaseService from "./databaseService";
import logService from "./logService";

// ============================================
// TYPES & INTERFACES
// ============================================

interface AuthFlowResult {
  authUrl: string;
  codePromise: Promise<string>;
  scopes: string[];
}

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: string | null;
  scopes: string[];
}

interface UserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

interface TokenExchangeResult {
  tokens: TokenData;
  userInfo: UserInfo;
}

interface RefreshTokenResult {
  access_token: string;
  expires_at: string | null;
}

// ============================================
// SERVICE CLASS
// ============================================

class GoogleAuthService {
  private oauth2Client: Auth.OAuth2Client | null = null;
  private initialized: boolean = false;
  private redirectUri: string = "http://localhost:3001/callback"; // Different port than Microsoft
  private server: http.Server | null = null;
  // Store resolve/reject functions to allow direct code resolution from navigation interception
  private codeResolver: ((code: string) => void) | null = null;
  private codeRejecter: ((error: Error) => void) | null = null;

  /**
   * Initialize Google OAuth2 client
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logService.error(
        "[GoogleAuth] Missing credentials. Check .env.development file.",
        "GoogleAuth",
      );
      throw new Error("Google OAuth credentials not configured");
    }

    logService.info(
      "[GoogleAuth] Initializing with client ID:",
      "GoogleAuth",
      { clientIdPrefix: clientId.substring(0, 20) + "..." },
    );

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      this.redirectUri, // Use local redirect URI
    );

    this.initialized = true;
    logService.debug("[GoogleAuth] Initialized successfully", "GoogleAuth");
  }

  /**
   * Ensure client is initialized and return it
   * @private
   * @throws {Error} If client cannot be initialized
   */
  private _ensureClient(): Auth.OAuth2Client {
    if (!this.initialized || !this.oauth2Client) {
      this.initialize();
    }
    if (!this.oauth2Client) {
      throw new Error("Google OAuth2 client is not initialized");
    }
    return this.oauth2Client;
  }

  /**
   * Resolve the authorization code directly from navigation interception
   * This bypasses the HTTP server round-trip for faster auth
   * @param code - The authorization code from the callback URL
   */
  resolveCodeDirectly(code: string): void {
    if (this.codeResolver) {
      logService.info(
        "[GoogleAuth] Resolving code directly from navigation interception",
        "GoogleAuth",
      );
      this.codeResolver(code);
      this.codeResolver = null;
      this.codeRejecter = null;
      this.stopLocalServer();
    }
  }

  /**
   * Reject the authorization code directly (for errors from navigation)
   * @param error - The error message
   */
  rejectCodeDirectly(error: string): void {
    if (this.codeRejecter) {
      logService.info(
        "[GoogleAuth] Rejecting code directly from navigation interception",
        "GoogleAuth",
      );
      this.codeRejecter(new Error(error));
      this.codeResolver = null;
      this.codeRejecter = null;
      this.stopLocalServer();
    }
  }

  /**
   * Start a temporary local HTTP server to catch OAuth redirect
   * @returns {Promise<string>} Authorization code from redirect
   */
  startLocalServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Store resolve/reject for direct resolution from navigation interception
      this.codeResolver = resolve;
      this.codeRejecter = reject;

      this.server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url || "", true);
        logService.info(
          `[GoogleAuth] HTTP server received request: ${parsedUrl.pathname}`,
          "GoogleAuth",
        );

        if (parsedUrl.pathname === "/callback") {
          const code = parsedUrl.query.code as string | undefined;
          const error = parsedUrl.query.error as string | undefined;
          logService.info(
            `[GoogleAuth] Callback received via HTTP server - code: ${code ? "present" : "missing"}, error: ${error || "none"}`,
            "GoogleAuth",
          );

          if (error) {
            res.writeHead(200, { "Content-Type": "text/html" });
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
            reject(
              new Error((parsedUrl.query.error_description as string) || error),
            );
          } else if (code) {
            res.writeHead(200, { "Content-Type": "text/html" });
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
          } else {
            res.writeHead(400, { "Content-Type": "text/html" });
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

      this.server.listen(3001, "localhost", () => {
        logService.info(
          "[GoogleAuth] Local callback server listening on http://localhost:3001",
          "GoogleAuth",
        );
      });

      this.server.on("error", (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Stop the local HTTP server
   */
  stopLocalServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      logService.debug("[GoogleAuth] Local callback server stopped", "GoogleAuth");
    }
  }

  /**
   * Authenticate for login (minimal scopes)
   * Step 1: Get user into the app
   * Opens browser, user logs in, redirects back to local server
   */
  async authenticateForLogin(): Promise<AuthFlowResult> {
    const client = this._ensureClient();

    const scopes = [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    try {
      logService.debug("[GoogleAuth] Starting login flow with minimal scopes", "GoogleAuth");

      // Start local server to catch redirect
      const codePromise = this.startLocalServer();

      // Generate auth URL
      const authUrl = client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "select_account", // Show account picker, only consent if needed
      });

      logService.debug("[GoogleAuth] Auth URL generated, local server started", "GoogleAuth");

      return {
        authUrl,
        codePromise,
        scopes,
      };
    } catch (error) {
      logService.error("[GoogleAuth] Login flow failed:", "GoogleAuth", { error });
      this.stopLocalServer();
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   * @param code - Authorization code from OAuth callback
   * @returns Tokens and user info
   */
  async exchangeCodeForTokens(code: string): Promise<TokenExchangeResult> {
    const client = this._ensureClient();

    try {
      logService.debug("[GoogleAuth] Exchanging code for tokens", "GoogleAuth");

      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      logService.debug("[GoogleAuth] Tokens obtained successfully", "GoogleAuth");

      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token!);

      return {
        tokens: {
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token ?? undefined,
          expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          scopes: tokens.scope ? tokens.scope.split(" ") : [],
        },
        userInfo,
      };
    } catch (error) {
      logService.error("[GoogleAuth] Code exchange failed:", "GoogleAuth", { error });
      throw error;
    }
  }

  /**
   * Authenticate for mailbox access (Gmail scopes)
   * Step 2: Connect to Gmail (incremental consent)
   * Opens browser, user grants Gmail access, redirects back to local server
   * @param loginHint - Optional email to pre-fill
   */
  async authenticateForMailbox(loginHint?: string): Promise<AuthFlowResult> {
    const client = this._ensureClient();

    const scopes = [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/gmail.readonly",
    ];

    try {
      logService.debug("[GoogleAuth] Starting mailbox connection flow", "GoogleAuth");

      // Start local server to catch redirect
      const codePromise = this.startLocalServer();

      // Generate auth URL with optional login hint
      const authUrlOptions: Auth.GenerateAuthUrlOpts = {
        access_type: "offline",
        scope: scopes,
        prompt: "select_account", // Show account picker, only consent if needed
      };

      if (loginHint) {
        authUrlOptions.login_hint = loginHint;
      }

      const authUrl = client.generateAuthUrl(authUrlOptions);

      logService.info(
        "[GoogleAuth] Mailbox auth URL generated, local server started",
        "GoogleAuth",
      );

      return {
        authUrl,
        codePromise,
        scopes,
      };
    } catch (error) {
      logService.error("[GoogleAuth] Mailbox flow failed:", "GoogleAuth", { error });
      this.stopLocalServer();
      throw error;
    }
  }

  /**
   * Get user profile information
   * @param accessToken - Access token
   * @returns User info
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const client = this._ensureClient();

    try {
      const oauth2 = google.oauth2({ version: "v2", auth: client });

      // Set credentials if provided
      if (accessToken) {
        client.setCredentials({ access_token: accessToken });
      }

      const { data } = await oauth2.userinfo.get();

      logService.debug("[GoogleAuth] User info retrieved:", "GoogleAuth", { email: data.email });

      return {
        id: data.id!,
        email: data.email!,
        verified_email: data.verified_email ?? undefined,
        name: data.name || undefined,
        given_name: data.given_name || undefined,
        family_name: data.family_name || undefined,
        picture: data.picture || undefined,
        locale: data.locale || undefined,
      };
    } catch (error) {
      logService.error("[GoogleAuth] Failed to get user info:", "GoogleAuth", { error });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Refresh token
   * @returns New tokens
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResult> {
    const client = this._ensureClient();

    try {
      logService.info("[GoogleAuth] Refreshing access token", "GoogleAuth");

      client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await client.refreshAccessToken();

      logService.info("[GoogleAuth] Token refreshed successfully", "GoogleAuth");

      return {
        access_token: credentials.access_token!,
        expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : null,
      };
    } catch (error) {
      logService.error("[GoogleAuth] Token refresh failed:", "GoogleAuth", { error });
      throw error;
    }
  }

  /**
   * Refresh access token for a user (high-level method with database integration)
   * @param userId - User ID to refresh token for
   * @returns Success status with new token data
   */
  async refreshAccessToken(
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logService.info("[GoogleAuth] Refreshing access token for user:", "GoogleAuth", { userId });

      // Get current token from database
      const tokenRecord = await databaseService.getOAuthToken(
        userId,
        "google",
        "mailbox",
      );

      if (!tokenRecord || !tokenRecord.refresh_token) {
        logService.error("[GoogleAuth] No refresh token found for user", "GoogleAuth");
        return { success: false, error: "No refresh token available" };
      }

      // Session-only OAuth: tokens stored unencrypted in encrypted database
      const refreshToken = tokenRecord.refresh_token;

      // Call Google to refresh the token
      const newTokens = await this.refreshToken(refreshToken);

      // Update database with new tokens (no encryption needed)
      // Note: Google typically doesn't return a new refresh token, so we keep the old one
      await databaseService.saveOAuthToken(userId, "google", "mailbox", {
        access_token: newTokens.access_token,
        refresh_token: tokenRecord.refresh_token, // Keep existing refresh token
        token_expires_at: newTokens.expires_at ?? undefined,
        scopes_granted: tokenRecord.scopes_granted, // Keep existing scopes
        connected_email_address: tokenRecord.connected_email_address,
        mailbox_connected: true,
      });

      logService.info(
        "[GoogleAuth] Token refreshed successfully. New expiry:",
        "GoogleAuth",
        { expiresAt: newTokens.expires_at },
      );

      return { success: true };
    } catch (error) {
      logService.error("[GoogleAuth] Failed to refresh access token:", "GoogleAuth", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Revoke tokens (sign out)
   * @param accessToken - Access token to revoke
   */
  async revokeToken(accessToken: string): Promise<void> {
    const client = this._ensureClient();

    try {
      logService.info("[GoogleAuth] Revoking token", "GoogleAuth");

      await client.revokeToken(accessToken);

      logService.info("[GoogleAuth] Token revoked successfully", "GoogleAuth");
    } catch (error) {
      logService.error("[GoogleAuth] Token revocation failed:", "GoogleAuth", { error });
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   * @param accessToken - Access token to check
   * @returns True if authenticated
   */
  async isAuthenticated(accessToken: string): Promise<boolean> {
    if (!accessToken) {
      return false;
    }

    try {
      // Try to get user info - if it works, token is valid
      await this.getUserInfo(accessToken);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export default new GoogleAuthService();
