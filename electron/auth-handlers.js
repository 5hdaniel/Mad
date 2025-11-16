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

    return {
      success: true,
      user: localUser,
      sessionToken,
      subscription,
    };
  } catch (error) {
    console.error('[Main] Google login completion failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Microsoft Auth: Start login flow with MSAL Device Code
const handleMicrosoftLogin = async (mainWindow) => {
  try {
    console.log('[Main] Starting Microsoft login flow with MSAL');

    // Device code flow - this will wait for user to complete auth
    const result = await microsoftAuthService.authenticateForLogin((deviceCodeInfo) => {
      // Send device code to renderer for display
      if (mainWindow) {
        mainWindow.webContents.send('microsoft:device-code', {
          userCode: deviceCodeInfo.userCode,
          verificationUri: deviceCodeInfo.verificationUri,
          message: deviceCodeInfo.message
        });
      }
    });

    // Authentication complete - get user info
    const accessToken = result.authResponse.accessToken;
    const userInfo = await microsoftAuthService.getUserInfo(accessToken);

    // Encrypt tokens
    const encryptedAccessToken = tokenEncryptionService.encrypt(accessToken);
    const encryptedRefreshToken = result.authResponse.refreshToken
      ? tokenEncryptionService.encrypt(result.authResponse.refreshToken)
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

    // Save auth token
    const expiresAt = result.authResponse.expiresOn
      ? result.authResponse.expiresOn.toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    await databaseService.saveOAuthToken(localUser.id, 'microsoft', 'authentication', {
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expires_at: expiresAt,
      scopes_granted: result.scopes.join(' '),
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

    return {
      success: true,
      user: localUser,
      sessionToken,
      subscription,
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
      return { success: true };
    } catch (error) {
      console.error('[Main] Logout failed:', error);
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

  // Get current user
  ipcMain.handle('auth:get-current-user', async () => {
    return { success: false, error: 'Session management not yet implemented' };
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
