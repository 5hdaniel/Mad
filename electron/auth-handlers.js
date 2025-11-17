// ============================================
// AUTHENTICATION IPC HANDLERS
// This file contains auth handlers to be added to main.js
// ============================================

const { ipcMain, app, shell } = require('electron');
const os = require('os');
const crypto = require('crypto');

// Import services
const databaseService = require('./services/databaseService');
const googleAuthService = require('./services/googleAuthService');
const microsoftAuthService = require('./services/microsoftAuthService');
const supabaseService = require('./services/supabaseService');
const tokenEncryptionService = require('./services/tokenEncryptionService');
const sessionService = require('./services/sessionService');

// Initialize database when app is ready
const initializeDatabase = async () => {
  try {
    await databaseService.initialize();
    console.log('[Main] Database initialized');
  } catch (error) {
    console.error('[Main] Failed to initialize database:', error);
  }
};

// Google Auth: Start login flow
const handleGoogleLogin = async (mainWindow) => {
  try {
    console.log('[Main] Starting Google login flow');

    const result = await googleAuthService.authenticateForLogin((deviceCodeInfo) => {
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
      error: error.message,
    };
  }
};

// Google Auth: Complete login with authorization code
const handleGoogleCompleteLogin = async (event, authCode) => {
  try {
    console.log('[Main] Completing Google login');

    // Exchange code for tokens
    const { tokens, userInfo } = await googleAuthService.exchangeCodeForTokens(authCode);

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
    await databaseService.updateLastLogin(localUser.id);
    // Re-fetch user to get updated last_login_at timestamp
    localUser = await databaseService.getUserById(localUser.id);

    // Save auth token
    await databaseService.saveOAuthToken(localUser.id, 'google', 'authentication', {
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: tokens.expires_at,
      scopes_granted: tokens.scopes,
    });

    // Create session
    const sessionToken = await databaseService.createSession(localUser.id);

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

    // Check if user is new (hasn't accepted terms yet)
    const isNewUser = !localUser.terms_accepted_at;

    // Save session for persistence (30 days expiration)
    const sessionExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    await sessionService.saveSession({
      user: localUser,
      sessionToken,
      provider: 'google',
      subscription,
      expiresAt: sessionExpiresAt,
    });

    return {
      success: true,
      user: localUser,
      sessionToken,
      subscription,
      isNewUser,
    };
  } catch (error) {
    console.error('[Main] Google login completion failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Microsoft Auth: Start login flow with local server redirect
const handleMicrosoftLogin = async (mainWindow) => {
  try {
    console.log('[Main] Starting Microsoft login flow with redirect');

    // Start auth flow - returns authUrl and a promise for the code
    const { authUrl, codePromise, codeVerifier, scopes } = await microsoftAuthService.authenticateForLogin();

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
        await databaseService.updateLastLogin(localUser.id);
        // Re-fetch user to get updated last_login_at timestamp
        localUser = await databaseService.getUserById(localUser.id);

        // Save auth token
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        await databaseService.saveOAuthToken(localUser.id, 'microsoft', 'authentication', {
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: expiresAt,
          scopes_granted: tokens.scope,
        });

        // Create session
        const sessionToken = await databaseService.createSession(localUser.id);

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

        // Check if user is new (hasn't accepted terms yet)
        const isNewUser = !localUser.terms_accepted_at;

        // Save session for persistence (30 days expiration)
        const sessionExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
        await sessionService.saveSession({
          user: localUser,
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
            error: error.message,
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
      error: error.message,
    };
  }
};


// Register all handlers (to be called in main.js)
const registerAuthHandlers = (mainWindow) => {
  ipcMain.handle('auth:google:login', () => handleGoogleLogin(mainWindow));
  ipcMain.handle('auth:google:complete-login', handleGoogleCompleteLogin);

  // Microsoft Auth (MSAL Device Code Flow - single step, no completion handler needed)
  ipcMain.handle('auth:microsoft:login', () => handleMicrosoftLogin(mainWindow));

  // Logout
  ipcMain.handle('auth:logout', async (event, sessionToken) => {
    try {
      await databaseService.deleteSession(sessionToken);
      await sessionService.clearSession();
      return { success: true };
    } catch (error) {
      console.error('[Main] Logout failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Accept terms
  ipcMain.handle('auth:accept-terms', async (event, userId) => {
    try {
      const updatedUser = await databaseService.acceptTerms(userId);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('[Main] Accept terms failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Validate session
  ipcMain.handle('auth:validate-session', async (event, sessionToken) => {
    try {
      const session = await databaseService.validateSession(sessionToken);

      if (!session) {
        return { success: false, valid: false };
      }

      return { success: true, valid: true, user: session };
    } catch (error) {
      console.error('[Main] Session validation failed:', error);
      return { success: false, valid: false, error: error.message };
    }
  });

  // Get current user (load from saved session)
  ipcMain.handle('auth:get-current-user', async () => {
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

      return {
        success: true,
        user: session.user,
        sessionToken: session.sessionToken,
        subscription: session.subscription,
        provider: session.provider,
      };
    } catch (error) {
      console.error('[Main] Get current user failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Shell: Open external URL
  ipcMain.handle('shell:open-external', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to open external URL:', error);
      return { success: false, error: error.message };
    }
  });
};

module.exports = {
  initializeDatabase,
  registerAuthHandlers,
};
