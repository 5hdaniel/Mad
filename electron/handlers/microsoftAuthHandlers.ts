/**
 * Microsoft Authentication Handlers
 * Handles Microsoft OAuth login and Outlook mailbox connection flows
 */

import { ipcMain, BrowserWindow, Event as ElectronEvent } from "electron";
import os from "os";
import crypto from "crypto";
import type {
  OnHeadersReceivedListenerDetails,
  HeadersReceivedResponse,
} from "electron";
import { app } from "electron";

// Import services
import databaseService from "../services/databaseService";
import microsoftAuthService from "../services/microsoftAuthService";
import supabaseService from "../services/supabaseService";
import rateLimitService from "../services/rateLimitService";
import auditService from "../services/auditService";
import logService from "../services/logService";
import { setSyncUserId } from "../sync-handlers";

// Import validation utilities
import { ValidationError, validateUserId } from "../utils/validation";

// Import constants
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_POLICY_VERSION,
} from "../constants/legalVersions";

// Type definitions
interface AuthResponse {
  success: boolean;
  error?: string;
}

interface LoginStartResponse extends AuthResponse {
  authUrl?: string;
  scopes?: string[];
}

interface LoginCompleteResponse extends AuthResponse {
  user?: import("../types/models").User;
  sessionToken?: string;
  subscription?: import("../types/models").Subscription;
  isNewUser?: boolean;
}

/**
 * Check if user needs to accept or re-accept terms
 */
function needsToAcceptTerms(user: import("../types/models").User): boolean {
  if (!user.terms_accepted_at) {
    return true;
  }

  if (!user.terms_version_accepted && !user.privacy_policy_version_accepted) {
    return false;
  }

  if (
    user.terms_version_accepted &&
    user.terms_version_accepted !== CURRENT_TERMS_VERSION
  ) {
    return true;
  }

  if (
    user.privacy_policy_version_accepted &&
    user.privacy_policy_version_accepted !== CURRENT_PRIVACY_POLICY_VERSION
  ) {
    return true;
  }

  return false;
}

/**
 * Helper to safely log URLs (redact auth codes)
 */
function safeLogUrl(url: string): string {
  if (url.startsWith("http://localhost:3000/callback")) {
    return "http://localhost:3000/callback?code=[REDACTED]";
  }
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname.substring(0, 80)}...`;
  } catch {
    return url.substring(0, 50) + "...";
  }
}

/**
 * Microsoft Auth: Start login flow (uses popup window)
 */
export async function handleMicrosoftLogin(
  mainWindow: BrowserWindow | null
): Promise<LoginStartResponse> {
  try {
    await logService.info(
      "Starting Microsoft login flow with redirect",
      "AuthHandlers"
    );

    const { authUrl, codePromise, codeVerifier, scopes } =
      await microsoftAuthService.authenticateForLogin();

    await logService.info(
      "Opening Microsoft auth URL in popup window",
      "AuthHandlers"
    );

    // Create popup window for auth
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // webSecurity defaults to true - do not disable
      },
      autoHideMenuBar: true,
      title: "Sign in with Microsoft",
    });

    authWindow.show();
    authWindow.focus();

    // Strip CSP headers
    const filter = {
      urls: [
        "*://*.microsoftonline.com/*",
        "*://*.msauth.net/*",
        "*://*.msftauth.net/*",
      ],
    };
    authWindow.webContents.session.webRequest.onHeadersReceived(
      filter,
      (
        details: OnHeadersReceivedListenerDetails,
        callback: (response: HeadersReceivedResponse) => void
      ) => {
        const responseHeaders = details.responseHeaders || {};
        delete responseHeaders["content-security-policy"];
        delete responseHeaders["content-security-policy-report-only"];
        delete responseHeaders["x-content-security-policy"];
        callback({ responseHeaders });
      }
    );

    authWindow.loadURL(authUrl);

    let authCompleted = false;

    authWindow.on("closed", () => {
      if (!authCompleted) {
        microsoftAuthService.stopLocalServer();
        logService.info(
          "Microsoft login auth window closed by user",
          "AuthHandlers"
        );
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("microsoft:login-cancelled");
        }
      }
    });

    const handleCallbackUrl = (callbackUrl: string) => {
      const parsedUrl = new URL(callbackUrl);
      const code = parsedUrl.searchParams.get("code");
      const error = parsedUrl.searchParams.get("error");
      const errorDescription = parsedUrl.searchParams.get("error_description");

      if (error) {
        logService.error(
          `Microsoft auth error: ${error}`,
          "AuthHandlers",
          { errorDescription }
        );
        microsoftAuthService.rejectCodeDirectly(errorDescription || error);
        authCompleted = true;
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
        }
      } else if (code) {
        logService.info(
          "Extracted auth code from navigation",
          "AuthHandlers"
        );
        microsoftAuthService.resolveCodeDirectly(code);
        authCompleted = true;
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
        }
      }
    };

    authWindow.webContents.on(
      "will-navigate",
      (event: ElectronEvent, url: string) => {
        logService.info(
          `[MicrosoftLogin] will-navigate: ${safeLogUrl(url)}`,
          "AuthHandlers"
        );
        if (url.startsWith("http://localhost:3000/callback")) {
          event.preventDefault();
          handleCallbackUrl(url);
        }
      }
    );

    authWindow.webContents.on(
      "will-redirect",
      (event: ElectronEvent, url: string) => {
        logService.info(
          `[MicrosoftLogin] will-redirect: ${safeLogUrl(url)}`,
          "AuthHandlers"
        );
        if (url.startsWith("http://localhost:3000/callback")) {
          event.preventDefault();
          handleCallbackUrl(url);
        }
      }
    );

    // Process auth in background
    setTimeout(async () => {
      try {
        await logService.info(
          "Waiting for authorization code from local server...",
          "AuthHandlers"
        );

        const timeoutMs = 120000;
        const codeWithTimeout = Promise.race([
          codePromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    "Authentication timed out - no response from Microsoft. Please try again."
                  )
                ),
              timeoutMs
            )
          ),
        ]);

        const code = await codeWithTimeout;
        authCompleted = true;
        await logService.info(
          "Received authorization code from redirect",
          "AuthHandlers"
        );

        // Check rate limiting
        const email = "pending@microsoft.com";
        const rateLimitCheck = await rateLimitService.checkRateLimit(email);
        if (!rateLimitCheck.allowed) {
          await logService.warn(
            "Login rate limited",
            "AuthHandlers",
            { email }
          );
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("microsoft:login-complete", {
              success: false,
              error: "Too many login attempts. Please try again later.",
              rateLimited: true,
              lockedUntil: rateLimitCheck.lockedUntil,
            });
          }
          return;
        }

        // Exchange code for tokens
        const tokens = await microsoftAuthService.exchangeCodeForTokens(
          code,
          codeVerifier
        );

        // Get user info
        const userInfo = await microsoftAuthService.getUserInfo(
          tokens.access_token
        );

        // Session-only OAuth: no keychain encryption
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token || null;

        // Sync user to Supabase
        const cloudUser = await supabaseService.syncUser({
          email: userInfo.email,
          first_name: userInfo.given_name,
          last_name: userInfo.family_name,
          display_name: userInfo.name,
          avatar_url: undefined,
          oauth_provider: "microsoft",
          oauth_id: userInfo.id,
        });

        const subscription = await supabaseService.validateSubscription(cloudUser.id);

        // Check if database is initialized
        if (!databaseService.isInitialized()) {
          await logService.info(
            "Database not initialized - deferring user creation",
            "AuthHandlers"
          );
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("microsoft:login-pending", {
              success: true,
              pendingLogin: true,
              oauthData: {
                provider: "microsoft" as const,
                userInfo,
                tokens: {
                  access_token: accessToken,
                  refresh_token: refreshToken,
                  expires_at: tokens.expires_in
                    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                    : new Date(Date.now() + 3600 * 1000).toISOString(),
                  scopes: tokens.scope ? tokens.scope.split(" ") : [],
                },
                cloudUser,
                subscription: subscription ?? undefined,
              },
            });
          }
          return;
        }

        // Create or update local user
        await logService.info(
          "Looking up or creating local user...",
          "AuthHandlers"
        );
        let localUser = await databaseService.getUserByOAuthId(
          "microsoft",
          userInfo.id
        );

        if (!localUser) {
          localUser = await databaseService.createUser({
            email: userInfo.email,
            first_name: userInfo.given_name,
            last_name: userInfo.family_name,
            display_name: userInfo.name,
            avatar_url: undefined,
            oauth_provider: "microsoft",
            oauth_id: userInfo.id,
            subscription_tier: cloudUser.subscription_tier,
            subscription_status: cloudUser.subscription_status,
            trial_ends_at: cloudUser.trial_ends_at,
            is_active: true,
          });
        } else {
          await databaseService.updateUser(localUser.id, {
            email: userInfo.email,
            first_name: userInfo.given_name,
            last_name: userInfo.family_name,
            display_name: userInfo.name,
            ...(cloudUser.terms_accepted_at && {
              terms_accepted_at: cloudUser.terms_accepted_at,
              terms_version_accepted: cloudUser.terms_version_accepted,
            }),
            ...(cloudUser.privacy_policy_accepted_at && {
              privacy_policy_accepted_at: cloudUser.privacy_policy_accepted_at,
              privacy_policy_version_accepted:
                cloudUser.privacy_policy_version_accepted,
            }),
            ...(cloudUser.email_onboarding_completed_at && {
              email_onboarding_completed_at:
                cloudUser.email_onboarding_completed_at,
            }),
            subscription_tier: cloudUser.subscription_tier,
            subscription_status: cloudUser.subscription_status,
          });

          // Bidirectional sync for terms
          if (localUser.terms_accepted_at && !cloudUser.terms_accepted_at) {
            try {
              await supabaseService.syncTermsAcceptance(
                cloudUser.id,
                localUser.terms_version_accepted || CURRENT_TERMS_VERSION,
                localUser.privacy_policy_version_accepted ||
                  CURRENT_PRIVACY_POLICY_VERSION
              );
            } catch (syncError) {
              await logService.error(
                "Failed to sync local terms to cloud",
                "AuthHandlers",
                {
                  error:
                    syncError instanceof Error
                      ? syncError.message
                      : "Unknown error",
                }
              );
            }
          }
        }

        if (!localUser) {
          throw new Error("Local user is unexpectedly null");
        }

        // Update last login
        await databaseService.updateLastLogin(localUser.id);
        const refreshedUser = await databaseService.getUserById(localUser.id);
        if (!refreshedUser) {
          throw new Error("Failed to retrieve user after update");
        }
        localUser = refreshedUser;

        // Save auth token
        const expiresAt = new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString();

        await databaseService.saveOAuthToken(
          localUser.id,
          "microsoft",
          "authentication",
          {
            access_token: accessToken,
            refresh_token: refreshToken ?? undefined,
            token_expires_at: expiresAt,
            scopes_granted: tokens.scope,
          }
        );

        // Create session
        const sessionToken = await databaseService.createSession(localUser.id);

        // Register device
        const deviceInfo = {
          device_id: crypto.randomUUID(),
          device_name: os.hostname(),
          os: os.platform() + " " + os.release(),
          app_version: app.getVersion(),
        };
        await supabaseService.registerDevice(cloudUser.id, deviceInfo);

        // Track login event
        await supabaseService.trackEvent(
          cloudUser.id,
          "user_login",
          { provider: "microsoft" },
          deviceInfo.device_id,
          app.getVersion()
        );

        await logService.info(
          "Microsoft login completed successfully",
          "AuthHandlers",
          { userId: localUser.id }
        );

        const isNewUser = needsToAcceptTerms(localUser);

        await rateLimitService.recordAttempt(localUser.email, true);

        await auditService.log({
          userId: localUser.id,
          sessionId: sessionToken,
          action: "LOGIN",
          resourceType: "SESSION",
          resourceId: sessionToken,
          metadata: { provider: "microsoft", isNewUser },
          success: true,
        });

        setSyncUserId(localUser.id);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("microsoft:login-complete", {
            success: true,
            user: localUser,
            sessionToken,
            subscription,
            isNewUser,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        await logService.error(
          "Microsoft login background processing failed",
          "AuthHandlers",
          { error: errorMessage }
        );

        await auditService.log({
          userId: "unknown",
          action: "LOGIN_FAILED",
          resourceType: "SESSION",
          metadata: { provider: "microsoft", error: errorMessage },
          success: false,
          errorMessage: errorMessage,
        });

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("microsoft:login-complete", {
            success: false,
            error: errorMessage,
          });
        }
      }
    }, 0);

    return { success: true, authUrl, scopes };
  } catch (error) {
    await logService.error("Microsoft login failed", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Microsoft Auth: Connect mailbox (Outlook/Mail access)
 */
export async function handleMicrosoftConnectMailbox(
  mainWindow: BrowserWindow | null,
  userId: string
): Promise<LoginStartResponse> {
  try {
    await logService.info(
      "Starting Microsoft mailbox connection",
      "AuthHandlers"
    );

    const validatedUserId = validateUserId(userId)!;

    const user = await databaseService.getUserById(validatedUserId);
    const loginHint = user?.email ?? undefined;

    const { authUrl, codePromise, codeVerifier, scopes } =
      await microsoftAuthService.authenticateForMailbox(loginHint);

    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // webSecurity defaults to true - do not disable
      },
      autoHideMenuBar: true,
      title: "Connect Microsoft Mailbox",
    });

    authWindow.show();
    authWindow.focus();

    const filter = {
      urls: [
        "*://*.microsoftonline.com/*",
        "*://*.msauth.net/*",
        "*://*.msftauth.net/*",
      ],
    };
    authWindow.webContents.session.webRequest.onHeadersReceived(
      filter,
      (
        details: OnHeadersReceivedListenerDetails,
        callback: (response: HeadersReceivedResponse) => void
      ) => {
        const responseHeaders = details.responseHeaders || {};
        delete responseHeaders["content-security-policy"];
        delete responseHeaders["content-security-policy-report-only"];
        delete responseHeaders["x-content-security-policy"];
        callback({ responseHeaders });
      }
    );

    authWindow.loadURL(authUrl);

    let authCompleted = false;

    authWindow.on("closed", () => {
      if (!authCompleted) {
        microsoftAuthService.stopLocalServer();
        logService.info(
          "Microsoft mailbox auth window closed by user",
          "AuthHandlers"
        );
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("microsoft:mailbox-cancelled");
        }
      }
    });

    const handleCallbackUrl = (callbackUrl: string) => {
      const parsedUrl = new URL(callbackUrl);
      const code = parsedUrl.searchParams.get("code");
      const error = parsedUrl.searchParams.get("error");
      const errorDescription = parsedUrl.searchParams.get("error_description");

      if (error) {
        microsoftAuthService.rejectCodeDirectly(errorDescription || error);
        authCompleted = true;
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
        }
      } else if (code) {
        microsoftAuthService.resolveCodeDirectly(code);
        authCompleted = true;
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
        }
      }
    };

    authWindow.webContents.on(
      "will-navigate",
      (event: ElectronEvent, url: string) => {
        if (url.startsWith("http://localhost:3000/callback")) {
          event.preventDefault();
          handleCallbackUrl(url);
        }
      }
    );

    authWindow.webContents.on(
      "will-redirect",
      (event: ElectronEvent, url: string) => {
        if (url.startsWith("http://localhost:3000/callback")) {
          event.preventDefault();
          handleCallbackUrl(url);
        }
      }
    );

    setTimeout(async () => {
      try {
        const timeoutMs = 120000;
        const codeWithTimeout = Promise.race([
          codePromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Mailbox authentication timed out")),
              timeoutMs
            )
          ),
        ]);

        const code = await codeWithTimeout;
        authCompleted = true;

        const tokens = await microsoftAuthService.exchangeCodeForTokens(
          code,
          codeVerifier
        );

        const userInfo = await microsoftAuthService.getUserInfo(
          tokens.access_token
        );

        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token || null;

        const expiresAt = new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString();

        await databaseService.saveOAuthToken(userId, "microsoft", "mailbox", {
          access_token: accessToken,
          refresh_token: refreshToken ?? undefined,
          token_expires_at: expiresAt,
          scopes_granted: tokens.scope,
          connected_email_address: userInfo.email,
          mailbox_connected: true,
        });

        await logService.info(
          "Microsoft mailbox connection completed",
          "AuthHandlers",
          { userId, email: userInfo.email }
        );

        await auditService.log({
          userId,
          action: "MAILBOX_CONNECT",
          resourceType: "MAILBOX",
          metadata: { provider: "microsoft", email: userInfo.email },
          success: true,
        });

        if (mainWindow) {
          mainWindow.webContents.send("microsoft:mailbox-connected", {
            success: true,
            email: userInfo.email,
          });
        }
      } catch (error) {
        await logService.error(
          "Microsoft mailbox connection failed",
          "AuthHandlers",
          {
            userId,
            error: error instanceof Error ? error.message : "Unknown error",
          }
        );

        await auditService.log({
          userId,
          action: "MAILBOX_CONNECT",
          resourceType: "MAILBOX",
          metadata: { provider: "microsoft" },
          success: false,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        });

        if (mainWindow) {
          mainWindow.webContents.send("microsoft:mailbox-connected", {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }, 0);

    return { success: true, authUrl, scopes };
  } catch (error) {
    await logService.error(
      "Microsoft mailbox connection failed",
      "AuthHandlers",
      { error: error instanceof Error ? error.message : "Unknown error" }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Pre-DB Microsoft mailbox connection (returns tokens instead of saving to DB)
 */
export async function handleMicrosoftConnectMailboxPending(
  mainWindow: BrowserWindow | null,
  emailHint?: string
): Promise<LoginStartResponse> {
  try {
    await logService.info(
      "Starting Microsoft mailbox connection (pre-DB mode)",
      "AuthHandlers"
    );

    const { authUrl, codePromise, codeVerifier, scopes: _scopes } =
      await microsoftAuthService.authenticateForMailbox(emailHint);

    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // webSecurity defaults to true - do not disable
      },
      autoHideMenuBar: true,
      title: "Connect Microsoft Mailbox",
    });

    authWindow.show();
    authWindow.focus();

    const filter = {
      urls: [
        "*://*.microsoftonline.com/*",
        "*://*.msauth.net/*",
        "*://*.msftauth.net/*",
      ],
    };
    authWindow.webContents.session.webRequest.onHeadersReceived(
      filter,
      (
        details: OnHeadersReceivedListenerDetails,
        callback: (response: HeadersReceivedResponse) => void
      ) => {
        const responseHeaders = details.responseHeaders || {};
        delete responseHeaders["content-security-policy"];
        delete responseHeaders["content-security-policy-report-only"];
        delete responseHeaders["x-content-security-policy"];
        callback({ responseHeaders });
      }
    );

    authWindow.loadURL(authUrl);

    let authCompleted = false;

    authWindow.on("closed", () => {
      if (!authCompleted) {
        microsoftAuthService.stopLocalServer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("microsoft:mailbox-pending-cancelled");
        }
      }
    });

    const handleCallbackUrl = (callbackUrl: string) => {
      const parsedUrl = new URL(callbackUrl);
      const code = parsedUrl.searchParams.get("code");
      const error = parsedUrl.searchParams.get("error");
      const errorDescription = parsedUrl.searchParams.get("error_description");

      if (error) {
        microsoftAuthService.rejectCodeDirectly(errorDescription || error);
        authCompleted = true;
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
        }
      } else if (code) {
        microsoftAuthService.resolveCodeDirectly(code);
        authCompleted = true;
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close();
        }
      }
    };

    authWindow.webContents.on(
      "will-navigate",
      (event: ElectronEvent, url: string) => {
        if (url.startsWith("http://localhost:3000/callback")) {
          event.preventDefault();
          handleCallbackUrl(url);
        }
      }
    );

    authWindow.webContents.on(
      "will-redirect",
      (event: ElectronEvent, url: string) => {
        if (url.startsWith("http://localhost:3000/callback")) {
          event.preventDefault();
          handleCallbackUrl(url);
        }
      }
    );

    setTimeout(async () => {
      try {
        const timeoutMs = 120000;
        const codeWithTimeout = Promise.race([
          codePromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Authentication timed out")),
              timeoutMs
            )
          ),
        ]);

        const code = await codeWithTimeout;
        authCompleted = true;

        const tokens = await microsoftAuthService.exchangeCodeForTokens(
          code,
          codeVerifier
        );

        const userInfo = await microsoftAuthService.getUserInfo(
          tokens.access_token
        );

        const expiresAt = new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString();

        await logService.info(
          "Microsoft mailbox connection completed (pre-DB mode)",
          "AuthHandlers",
          { email: userInfo.email }
        );

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("microsoft:mailbox-pending-connected", {
            success: true,
            email: userInfo.email,
            tokens: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              expires_at: expiresAt,
              scopes: tokens.scope,
            },
          });
        }
      } catch (error) {
        await logService.error(
          "Microsoft mailbox connection failed (pre-DB mode)",
          "AuthHandlers",
          { error: error instanceof Error ? error.message : "Unknown error" }
        );

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("microsoft:mailbox-pending-connected", {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }, 0);

    return { success: true };
  } catch (error) {
    await logService.error(
      "Microsoft mailbox connection failed (pre-DB mode)",
      "AuthHandlers",
      { error: error instanceof Error ? error.message : "Unknown error" }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Register all Microsoft auth handlers
 */
export function registerMicrosoftAuthHandlers(
  mainWindow: BrowserWindow | null
): void {
  ipcMain.handle("auth:microsoft:login", () =>
    handleMicrosoftLogin(mainWindow)
  );

  ipcMain.handle("auth:microsoft:connect-mailbox", (event, userId: string) =>
    handleMicrosoftConnectMailbox(mainWindow, userId)
  );

  ipcMain.handle(
    "auth:microsoft:connect-mailbox-pending",
    (event, emailHint?: string) =>
      handleMicrosoftConnectMailboxPending(mainWindow, emailHint)
  );
}
