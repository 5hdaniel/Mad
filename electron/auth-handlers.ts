// ============================================
// AUTHENTICATION IPC HANDLERS
// This file contains auth handlers to be added to main.js
// ============================================

import { ipcMain, app, shell, BrowserWindow } from 'electron';
import os from 'os';
import crypto from 'crypto';
import type { IpcMainInvokeEvent } from 'electron';

// Import services
import { databaseService } from './services/databaseService';
import { googleAuthService } from './services/googleAuthService';
import { microsoftAuthService } from './services/microsoftAuthService';
import { supabaseService } from './services/supabaseService';
import { tokenEncryptionService } from './services/tokenEncryptionService';
import { sessionService } from './services/sessionService';

// Import types
import type { User, Subscription } from './types/models';

// Import validation utilities
import {
  ValidationError,
  validateUserId,
  validateAuthCode,
  validateSessionToken,
  validateUrl,
} from './utils/validation';

// Import constants
const { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_POLICY_VERSION } = require('./constants/legalVersions');

// Type definitions for handler responses
interface AuthResponse {
  success: boolean;
  error?: string;
}

interface LoginStartResponse extends AuthResponse {
  authUrl?: string;
  scopes?: string[];
}

interface LoginCompleteResponse extends AuthResponse {
  user?: User;
  sessionToken?: string;
  subscription?: Subscription;
  isNewUser?: boolean;
}

interface SessionValidationResponse extends AuthResponse {
  valid?: boolean;
  user?: User;
}

interface CurrentUserResponse extends AuthResponse {
  user?: User;
  sessionToken?: string;
  subscription?: Subscription;
  provider?: string;
  isNewUser?: boolean;
}

interface MailboxConnectionResponse extends AuthResponse {
  email?: string;
}

interface TermsAcceptanceResponse extends AuthResponse {
  user?: User;
}

/**
 * Check if user needs to accept or re-accept terms
 * Returns true if user hasn't accepted OR if the accepted versions are outdated
 */
function needsToAcceptTerms(user: User): boolean {
  // User hasn't accepted terms at all (truly new user)
  if (!user.terms_accepted_at) {
    return true;
  }

  // Backward compatibility: If user accepted before we added version tracking,
  // don't force them to re-accept (version fields will be null/undefined)
  if (!user.terms_version_accepted && !user.privacy_policy_version_accepted) {
    // User accepted in old system, consider them accepted
    return false;
  }

  // Check if versions have been updated since user last accepted
  if (user.terms_version_accepted && user.terms_version_accepted !== CURRENT_TERMS_VERSION) {
    console.log('[Auth] User needs to re-accept terms: Terms version updated');
    return true;
  }

  if (user.privacy_policy_version_accepted && user.privacy_policy_version_accepted !== CURRENT_PRIVACY_POLICY_VERSION) {
    console.log('[Auth] User needs to re-accept terms: Privacy Policy version updated');
    return true;
  }

  return false;
}

// Initialize database when app is ready
export const initializeDatabase = async (): Promise<void> => {
  try {
    await databaseService.initialize();
    console.log('[Main] Database initialized');
  } catch (error) {
    console.error('[Main] Failed to initialize database:', error);
  }
};

// Google Auth: Start login flow
const handleGoogleLogin = async (mainWindow: BrowserWindow | null): Promise<LoginStartResponse> => {
  try {
    console.log('[Main] Starting Google login flow');

    const result = await googleAuthService.authenticateForLogin((deviceCodeInfo: unknown) => {
      // Device code callback - send to renderer
      if (mainWindow) {
        mainWindow.webContents.send('auth:device-code', deviceCodeInfo);
      }
    });

    return {
      success: true,
      authUrl: result.authUrl,
      scopes: result.scopes,
    };
  } catch (error) {
    console.error('[Main] Google login failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Google Auth: Complete login with authorization code
const handleGoogleCompleteLogin = async (event: IpcMainInvokeEvent, authCode: string): Promise<LoginCompleteResponse> => {
  try {
    console.log('[Main] Completing Google login');

    // Validate input
    const validatedAuthCode = validateAuthCode(authCode);

    // Exchange code for tokens
    const { tokens, userInfo } = await googleAuthService.exchangeCodeForTokens(validatedAuthCode);

    // Encrypt tokens
    const encryptedAccessToken = tokenEncryptionService.encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? tokenEncryptionService.encrypt(tokens.refresh_token)
      : null;

    // Sync user to Supabase
    const cloudUser = await supabaseService.syncUser({
      email: userInfo.email,
      first_name: userInfo.given_name,
      last_name: userInfo.family_name,
      display_name: userInfo.name,
      avatar_url: userInfo.picture,
      oauth_provider: 'google',
      oauth_id: userInfo.id,
    });

    // Create user in local database
    let localUser = await databaseService.getUserByOAuthId('google', userInfo.id);

    if (!localUser) {
      const userId = await databaseService.createUser({
        email: userInfo.email,
        first_name: userInfo.given_name,
        last_name: userInfo.family_name,
        display_name: userInfo.name,
        avatar_url: userInfo.picture,
        oauth_provider: 'google',
        oauth_id: userInfo.id,
        subscription_tier: cloudUser.subscription_tier,
        subscription_status: cloudUser.subscription_status,
        trial_ends_at: cloudUser.trial_ends_at,
      });

      localUser = await databaseService.getUserById(userId);
    } else {
      // Update existing user
      localUser = await databaseService.updateUser(localUser.id, {
        email: userInfo.email,
        first_name: userInfo.given_name,
        last_name: userInfo.family_name,
        display_name: userInfo.name,
        avatar_url: userInfo.picture,
      });
    }

    // Update last login
    await databaseService.updateLastLogin(localUser!.id);
    // Re-fetch user to get updated last_login_at timestamp
    localUser = await databaseService.getUserById(localUser!.id);

    // Save auth token
    await databaseService.saveOAuthToken(localUser!.id, 'google', 'authentication', {
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: tokens.expires_at,
      scopes_granted: tokens.scopes,
    });

    // Create session
    const sessionToken = await databaseService.createSession(localUser!.id);

    // Validate subscription
    const subscription = await supabaseService.validateSubscription(cloudUser.id);

    // Register device
    const deviceInfo = {
      device_id: crypto.randomUUID(),
      device_name: os.hostname(),
      os: os.platform() + ' ' + os.release(),
      app_version: app.getVersion(),
    };
    await supabaseService.registerDevice(cloudUser.id, deviceInfo);

    // Track login event
    await supabaseService.trackEvent(
      cloudUser.id,
      'user_login',
      { provider: 'google' },
      deviceInfo.device_id,
      app.getVersion()
    );

    console.log('[Main] Google login completed successfully');

    // Check if user needs to accept terms (new user or outdated versions)
    const isNewUser = needsToAcceptTerms(localUser!);

    // Save session for persistence (30 days expiration)
    const sessionExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    await sessionService.saveSession({
      user: localUser!,
      sessionToken,
      provider: 'google',
      subscription,
      expiresAt: sessionExpiresAt,
    });

    return {
      success: true,
      user: localUser!,
      sessionToken,
      subscription,
      isNewUser,
    };
  } catch (error) {
    console.error('[Main] Google login completion failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Google Auth: Connect mailbox (Gmail access)
const handleGoogleConnectMailbox = async (mainWindow: BrowserWindow | null, userId: string): Promise<LoginStartResponse> => {
  try {
    console.log('[Main] Starting Google mailbox connection with redirect');

    // Validate input
    const validatedUserId = validateUserId(userId);

    // Get user info to use as login hint
    const user = await databaseService.getUserById(validatedUserId);
    const loginHint = user?.email;

    // Start auth flow - returns authUrl and a promise for the code
    const { authUrl, codePromise, scopes } = await googleAuthService.authenticateForMailbox(loginHint);

    console.log('[Main] Opening Google mailbox auth URL in popup window');

    // Create a popup window for auth with webSecurity disabled to allow Google's scripts
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Disable to allow Google's CDN scripts to load
        allowRunningInsecureContent: true
      },
      autoHideMenuBar: true,
      title: 'Connect to Gmail'
    });

    // Strip CSP headers to allow Google's scripts to load
    const filter = { urls: ['*://*.google.com/*', '*://*.googleapis.com/*', '*://*.gstatic.com/*', '*://*.googleusercontent.com/*'] };
    authWindow.webContents.session.webRequest.onHeadersReceived(filter, (details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      delete responseHeaders['content-security-policy'];
      delete responseHeaders['content-security-policy-report-only'];
      delete responseHeaders['x-content-security-policy'];
      callback({ responseHeaders });
    });

    // Load the auth URL
    authWindow.loadURL(authUrl);

    // Close the window when redirected to callback
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith('http://localhost:3001/callback')) {
        // Let the success page load, then close after 3 seconds
        setTimeout(() => {
          if (authWindow && !authWindow.isDestroyed()) {
            authWindow.close();
          }
        }, 3000);
      }
    });

    // Return authUrl immediately so browser can open
    // Don't wait for user - return early
    setTimeout(async () => {
      try {
        // Wait for code from local server (in background)
        const code = await codePromise;
        console.log('[Main] Received Gmail authorization code from redirect');

        // Exchange code for tokens
        const { tokens } = await googleAuthService.exchangeCodeForTokens(code);

        // Encrypt tokens
        const encryptedAccessToken = tokenEncryptionService.encrypt(tokens.access_token);
        const encryptedRefreshToken = tokens.refresh_token
          ? tokenEncryptionService.encrypt(tokens.refresh_token)
          : null;

        // Get user's email for the connected_email_address field
        const userInfo = await googleAuthService.getUserInfo(tokens.access_token);

        // Save mailbox token
        await databaseService.saveOAuthToken(userId, 'google', 'mailbox', {
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: tokens.expires_at,
          scopes_granted: tokens.scopes,
          connected_email_address: userInfo.email,
          mailbox_connected: true,
        });

        console.log('[Main] Google mailbox connection completed successfully');

        // Notify renderer of successful connection
        if (mainWindow) {
          mainWindow.webContents.send('google:mailbox-connected', {
            success: true,
            email: userInfo.email,
          });
        }
      } catch (error) {
        console.error('[Main] Google mailbox connection background processing failed:', error);
        if (mainWindow) {
          mainWindow.webContents.send('google:mailbox-connected', {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }, 0);

    // Return immediately with authUrl
    return {
      success: true,
      authUrl,
      scopes,
    };
  } catch (error) {
    console.error('[Main] Google mailbox connection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Microsoft Auth: Start login flow with local server redirect
const handleMicrosoftLogin = async (mainWindow: BrowserWindow | null): Promise<LoginStartResponse> => {
  try {
    console.log('[Main] Starting Microsoft login flow with redirect');

    // Start auth flow - returns authUrl and a promise for the code
    const { authUrl, codePromise, codeVerifier, scopes } = await microsoftAuthService.authenticateForLogin();

    console.log('[Main] Opening auth URL in popup window');

    // Create a popup window for auth with webSecurity disabled to allow Microsoft's scripts
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Disable to allow Microsoft's CDN scripts to load
        allowRunningInsecureContent: true
      },
      autoHideMenuBar: true,
      title: 'Sign in with Microsoft'
    });

    // Strip CSP headers to allow Microsoft's scripts to load
    const filter = { urls: ['*://*.microsoftonline.com/*', '*://*.msauth.net/*', '*://*.msftauth.net/*'] };
    authWindow.webContents.session.webRequest.onHeadersReceived(filter, (details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      delete responseHeaders['content-security-policy'];
      delete responseHeaders['content-security-policy-report-only'];
      delete responseHeaders['x-content-security-policy'];
      callback({ responseHeaders });
    });

    // Load the auth URL
    authWindow.loadURL(authUrl);

    // Close the window when redirected to callback
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith('http://localhost:3000/callback')) {
        // Let the success page load, then close after 3 seconds
        setTimeout(() => {
          if (authWindow && !authWindow.isDestroyed()) {
            authWindow.close();
          }
        }, 3000);
      }
    });

    // Return authUrl immediately so browser can open
    // Don't wait for user - return early
    setTimeout(async () => {
      try {
        // Wait for code from local server (in background)
        const code = await codePromise;
        console.log('[Main] Received authorization code from redirect');

        // Exchange code for tokens
        const tokens = await microsoftAuthService.exchangeCodeForTokens(code, codeVerifier);

        // Get user info
        const userInfo = await microsoftAuthService.getUserInfo(tokens.access_token);

        // Encrypt tokens
        const encryptedAccessToken = tokenEncryptionService.encrypt(tokens.access_token);
        const encryptedRefreshToken = tokens.refresh_token
          ? tokenEncryptionService.encrypt(tokens.refresh_token)
          : null;

        // Sync user to Supabase
        const cloudUser = await supabaseService.syncUser({
          email: userInfo.email,
          first_name: userInfo.given_name,
          last_name: userInfo.family_name,
          display_name: userInfo.name,
          avatar_url: null,
          oauth_provider: 'microsoft',
          oauth_id: userInfo.id,
        });

        // Create user in local database
        let localUser = await databaseService.getUserByOAuthId('microsoft', userInfo.id);

        if (!localUser) {
          const userId = await databaseService.createUser({
            email: userInfo.email,
            first_name: userInfo.given_name,
            last_name: userInfo.family_name,
            display_name: userInfo.name,
            avatar_url: null,
            oauth_provider: 'microsoft',
            oauth_id: userInfo.id,
            subscription_tier: cloudUser.subscription_tier,
            subscription_status: cloudUser.subscription_status,
            trial_ends_at: cloudUser.trial_ends_at,
          });

          localUser = await databaseService.getUserById(userId);
        } else {
          // Update existing user
          localUser = await databaseService.updateUser(localUser.id, {
            email: userInfo.email,
            first_name: userInfo.given_name,
            last_name: userInfo.family_name,
            display_name: userInfo.name,
          });
        }

        // Update last login
        await databaseService.updateLastLogin(localUser!.id);
        // Re-fetch user to get updated last_login_at timestamp
        localUser = await databaseService.getUserById(localUser!.id);

        // Save auth token
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        await databaseService.saveOAuthToken(localUser!.id, 'microsoft', 'authentication', {
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: expiresAt,
          scopes_granted: tokens.scope,
        });

        // Create session
        const sessionToken = await databaseService.createSession(localUser!.id);

        // Validate subscription
        const subscription = await supabaseService.validateSubscription(cloudUser.id);

        // Register device
        const deviceInfo = {
          device_id: crypto.randomUUID(),
          device_name: os.hostname(),
          os: os.platform() + ' ' + os.release(),
          app_version: app.getVersion(),
        };
        await supabaseService.registerDevice(cloudUser.id, deviceInfo);

        // Track login event
        await supabaseService.trackEvent(
          cloudUser.id,
          'user_login',
          { provider: 'microsoft' },
          deviceInfo.device_id,
          app.getVersion()
        );

        console.log('[Main] Microsoft login completed successfully');

        // Check if user needs to accept terms (new user or outdated versions)
        const isNewUser = needsToAcceptTerms(localUser!);

        // Save session for persistence (30 days expiration)
        const sessionExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
        await sessionService.saveSession({
          user: localUser!,
          sessionToken,
          provider: 'microsoft',
          subscription,
          expiresAt: sessionExpiresAt,
        });

        // Notify renderer of successful login
        if (mainWindow) {
          mainWindow.webContents.send('microsoft:login-complete', {
            success: true,
            user: localUser,
            sessionToken,
            subscription,
            isNewUser,
          });
        }
      } catch (error) {
        console.error('[Main] Microsoft login background processing failed:', error);
        if (mainWindow) {
          mainWindow.webContents.send('microsoft:login-complete', {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }, 0);

    // Return immediately with authUrl
    return {
      success: true,
      authUrl,
      scopes,
    };
  } catch (error) {
    console.error('[Main] Microsoft login failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Microsoft Auth: Connect mailbox (Outlook/Mail access)
const handleMicrosoftConnectMailbox = async (mainWindow: BrowserWindow | null, userId: string): Promise<LoginStartResponse> => {
  try {
    console.log('[Main] Starting Microsoft mailbox connection with redirect');

    // Validate input
    const validatedUserId = validateUserId(userId);

    // Get user info to use as login hint
    const user = await databaseService.getUserById(validatedUserId);
    const loginHint = user?.email;

    // Start auth flow - returns authUrl and a promise for the code
    const { authUrl, codePromise, codeVerifier, scopes} = await microsoftAuthService.authenticateForMailbox(loginHint);

    console.log('[Main] Opening mailbox auth URL in popup window');

    // Create a popup window for auth with webSecurity disabled to allow Microsoft's scripts
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Disable to allow Microsoft's CDN scripts to load
        allowRunningInsecureContent: true
      },
      autoHideMenuBar: true,
      title: 'Connect Microsoft Mailbox'
    });

    // Strip CSP headers to allow Microsoft's scripts to load
    const filter = { urls: ['*://*.microsoftonline.com/*', '*://*.msauth.net/*', '*://*.msftauth.net/*'] };
    authWindow.webContents.session.webRequest.onHeadersReceived(filter, (details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      delete responseHeaders['content-security-policy'];
      delete responseHeaders['content-security-policy-report-only'];
      delete responseHeaders['x-content-security-policy'];
      callback({ responseHeaders });
    });

    // Load the auth URL
    authWindow.loadURL(authUrl);

    // Close the window when redirected to callback
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith('http://localhost:3000/callback')) {
        // Let the success page load, then close after 3 seconds
        setTimeout(() => {
          if (authWindow && !authWindow.isDestroyed()) {
            authWindow.close();
          }
        }, 3000);
      }
    });

    // Return authUrl immediately so browser can open
    // Don't wait for user - return early
    setTimeout(async () => {
      try {
        // Wait for code from local server (in background)
        const code = await codePromise;
        console.log('[Main] Received mailbox authorization code from redirect');

        // Exchange code for tokens
        const tokens = await microsoftAuthService.exchangeCodeForTokens(code, codeVerifier);

        // Get user info
        const userInfo = await microsoftAuthService.getUserInfo(tokens.access_token);

        // Encrypt tokens
        const encryptedAccessToken = tokenEncryptionService.encrypt(tokens.access_token);
        const encryptedRefreshToken = tokens.refresh_token
          ? tokenEncryptionService.encrypt(tokens.refresh_token)
          : null;

        // Save mailbox token
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        await databaseService.saveOAuthToken(userId, 'microsoft', 'mailbox', {
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: expiresAt,
          scopes_granted: tokens.scope,
          connected_email_address: userInfo.email,
          mailbox_connected: true,
        });

        console.log('[Main] Microsoft mailbox connection completed successfully');

        // Notify renderer of successful connection
        if (mainWindow) {
          mainWindow.webContents.send('microsoft:mailbox-connected', {
            success: true,
            email: userInfo.email,
          });
        }
      } catch (error) {
        console.error('[Main] Microsoft mailbox connection background processing failed:', error);
        if (mainWindow) {
          mainWindow.webContents.send('microsoft:mailbox-connected', {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }, 0);

    // Return immediately with authUrl
    return {
      success: true,
      authUrl,
      scopes,
    };
  } catch (error) {
    console.error('[Main] Microsoft mailbox connection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};


// Register all handlers (to be called in main.js)
export const registerAuthHandlers = (mainWindow: BrowserWindow | null): void => {
  // Google Auth - Login
  ipcMain.handle('auth:google:login', () => handleGoogleLogin(mainWindow));
  ipcMain.handle('auth:google:complete-login', handleGoogleCompleteLogin);

  // Google Auth - Mailbox Connection
  ipcMain.handle('auth:google:connect-mailbox', (event, userId: string) => handleGoogleConnectMailbox(mainWindow, userId));

  // Microsoft Auth - Login
  ipcMain.handle('auth:microsoft:login', () => handleMicrosoftLogin(mainWindow));

  // Microsoft Auth - Mailbox Connection
  ipcMain.handle('auth:microsoft:connect-mailbox', (event, userId: string) => handleMicrosoftConnectMailbox(mainWindow, userId));

  // Logout
  ipcMain.handle('auth:logout', async (event, sessionToken: string): Promise<AuthResponse> => {
    try {
      // Validate input
      const validatedSessionToken = validateSessionToken(sessionToken);

      await databaseService.deleteSession(validatedSessionToken);
      await sessionService.clearSession();
      return { success: true };
    } catch (error) {
      console.error('[Main] Logout failed:', error);
      if (error instanceof ValidationError) {
        return { success: false, error: `Validation error: ${error.message}` };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Accept terms
  ipcMain.handle('auth:accept-terms', async (event, userId: string): Promise<TermsAcceptanceResponse> => {
    try {
      // Validate input
      const validatedUserId = validateUserId(userId);

      // Save to local database
      const updatedUser = await databaseService.acceptTerms(
        validatedUserId,
        CURRENT_TERMS_VERSION,
        CURRENT_PRIVACY_POLICY_VERSION
      );

      console.log('[Auth] Terms accepted:', userId, `v${CURRENT_TERMS_VERSION}`);

      // Sync to Supabase (cloud backup for legal compliance)
      try {
        await supabaseService.syncTermsAcceptance(
          userId,
          CURRENT_TERMS_VERSION,
          CURRENT_PRIVACY_POLICY_VERSION
        );
      } catch (syncError) {
        // Don't fail the acceptance if sync fails - user already accepted locally
        console.error('[Auth] Failed to sync terms to Supabase:', syncError instanceof Error ? syncError.message : 'Unknown error');
      }

      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('[Auth] Accept terms failed:', error);
      if (error instanceof ValidationError) {
        return { success: false, error: `Validation error: ${error.message}` };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Validate session
  ipcMain.handle('auth:validate-session', async (event, sessionToken: string): Promise<SessionValidationResponse> => {
    try {
      // Validate input
      const validatedSessionToken = validateSessionToken(sessionToken);

      const session = await databaseService.validateSession(validatedSessionToken);

      if (!session) {
        return { success: false, valid: false };
      }

      return { success: true, valid: true, user: session };
    } catch (error) {
      console.error('[Main] Session validation failed:', error);
      if (error instanceof ValidationError) {
        return { success: false, valid: false, error: `Validation error: ${error.message}` };
      }
      return { success: false, valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get current user (load from saved session)
  ipcMain.handle('auth:get-current-user', async (): Promise<CurrentUserResponse> => {
    try {
      const session = await sessionService.loadSession();

      if (!session) {
        return { success: false, error: 'No active session' };
      }

      // Validate session token in database
      const dbSession = await databaseService.validateSession(session.sessionToken);

      if (!dbSession) {
        // Session invalid, clear it
        await sessionService.clearSession();
        return { success: false, error: 'Session expired or invalid' };
      }

      // Load fresh user data from database to ensure we have latest terms acceptance status
      const freshUser = await databaseService.getUserById(session.user.id);
      const user = freshUser || session.user; // Fallback to session user if db read fails

      return {
        success: true,
        user,
        sessionToken: session.sessionToken,
        subscription: session.subscription,
        provider: session.provider,
        isNewUser: needsToAcceptTerms(user), // Flag if user needs to accept/re-accept terms
      };
    } catch (error) {
      console.error('[Main] Get current user failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Shell: Open external URL
  ipcMain.handle('shell:open-external', async (event, url: string): Promise<AuthResponse> => {
    try {
      // Validate input - prevent opening malicious URLs
      const validatedUrl = validateUrl(url);

      await shell.openExternal(validatedUrl);
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to open external URL:', error);
      if (error instanceof ValidationError) {
        return { success: false, error: `Validation error: ${error.message}` };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
};
