"use strict";
// ============================================
// AUTHENTICATION IPC HANDLERS
// This file contains auth handlers to be added to main.js
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthHandlers = exports.initializeDatabase = void 0;
const electron_1 = require("electron");
const os_1 = __importDefault(require("os"));
const crypto_1 = __importDefault(require("crypto"));
// Import services
const databaseService_1 = __importDefault(require("./services/databaseService"));
const googleAuthService_1 = __importDefault(require("./services/googleAuthService"));
const microsoftAuthService_1 = __importDefault(require("./services/microsoftAuthService"));
const supabaseService_1 = __importDefault(require("./services/supabaseService"));
const tokenEncryptionService_1 = __importDefault(require("./services/tokenEncryptionService"));
const sessionService_1 = __importDefault(require("./services/sessionService"));
// Import validation utilities
const validation_1 = require("./utils/validation");
// Import constants
const legalVersions_1 = require("./constants/legalVersions");
/**
 * Check if user needs to accept or re-accept terms
 * Returns true if user hasn't accepted OR if the accepted versions are outdated
 */
function needsToAcceptTerms(user) {
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
    if (user.terms_version_accepted && user.terms_version_accepted !== legalVersions_1.CURRENT_TERMS_VERSION) {
        console.log('[Auth] User needs to re-accept terms: Terms version updated');
        return true;
    }
    if (user.privacy_policy_version_accepted && user.privacy_policy_version_accepted !== legalVersions_1.CURRENT_PRIVACY_POLICY_VERSION) {
        console.log('[Auth] User needs to re-accept terms: Privacy Policy version updated');
        return true;
    }
    return false;
}
// Initialize database when app is ready
const initializeDatabase = async () => {
    try {
        await databaseService_1.default.initialize();
        console.log('[Main] Database initialized');
    }
    catch (error) {
        console.error('[Main] Failed to initialize database:', error);
    }
};
exports.initializeDatabase = initializeDatabase;
// Google Auth: Start login flow
const handleGoogleLogin = async (_mainWindow) => {
    try {
        console.log('[Main] Starting Google login flow');
        const result = await googleAuthService_1.default.authenticateForLogin();
        return {
            success: true,
            authUrl: result.authUrl,
            scopes: result.scopes,
        };
    }
    catch (error) {
        console.error('[Main] Google login failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Google Auth: Complete login with authorization code
const handleGoogleCompleteLogin = async (event, authCode) => {
    try {
        console.log('[Main] Completing Google login');
        // Validate input
        const validatedAuthCode = (0, validation_1.validateAuthCode)(authCode);
        // Exchange code for tokens
        const { tokens, userInfo } = await googleAuthService_1.default.exchangeCodeForTokens(validatedAuthCode);
        // Encrypt tokens
        const encryptedAccessToken = tokenEncryptionService_1.default.encrypt(tokens.access_token);
        const encryptedRefreshToken = tokens.refresh_token
            ? tokenEncryptionService_1.default.encrypt(tokens.refresh_token)
            : null;
        // Sync user to Supabase
        const cloudUser = await supabaseService_1.default.syncUser({
            email: userInfo.email,
            first_name: userInfo.given_name,
            last_name: userInfo.family_name,
            display_name: userInfo.name,
            avatar_url: userInfo.picture,
            oauth_provider: 'google',
            oauth_id: userInfo.id,
        });
        // Create user in local database
        let localUser = await databaseService_1.default.getUserByOAuthId('google', userInfo.id);
        if (!localUser) {
            localUser = await databaseService_1.default.createUser({
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
                is_active: true,
            });
        }
        else {
            // Update existing user
            await databaseService_1.default.updateUser(localUser.id, {
                email: userInfo.email,
                first_name: userInfo.given_name,
                last_name: userInfo.family_name,
                display_name: userInfo.name,
                avatar_url: userInfo.picture,
            });
        }
        // Update last login (localUser is guaranteed non-null from the if/else above)
        if (!localUser) {
            throw new Error('Local user is unexpectedly null after creation/update');
        }
        await databaseService_1.default.updateLastLogin(localUser.id);
        // Re-fetch user to get updated last_login_at timestamp
        const refreshedUser = await databaseService_1.default.getUserById(localUser.id);
        if (!refreshedUser) {
            throw new Error('Failed to retrieve user after update');
        }
        localUser = refreshedUser;
        // Save auth token
        await databaseService_1.default.saveOAuthToken(localUser.id, 'google', 'authentication', {
            access_token: encryptedAccessToken,
            refresh_token: encryptedRefreshToken ?? undefined,
            token_expires_at: tokens.expires_at ?? undefined,
            scopes_granted: Array.isArray(tokens.scopes) ? tokens.scopes.join(' ') : tokens.scopes,
        });
        // Create session
        const sessionToken = await databaseService_1.default.createSession(localUser.id);
        // Validate subscription
        const subscription = await supabaseService_1.default.validateSubscription(cloudUser.id);
        // Register device
        const deviceInfo = {
            device_id: crypto_1.default.randomUUID(),
            device_name: os_1.default.hostname(),
            os: os_1.default.platform() + ' ' + os_1.default.release(),
            app_version: electron_1.app.getVersion(),
        };
        await supabaseService_1.default.registerDevice(cloudUser.id, deviceInfo);
        // Track login event
        await supabaseService_1.default.trackEvent(cloudUser.id, 'user_login', { provider: 'google' }, deviceInfo.device_id, electron_1.app.getVersion());
        console.log('[Main] Google login completed successfully');
        // Check if user needs to accept terms (new user or outdated versions)
        const isNewUser = needsToAcceptTerms(localUser);
        // Save session for persistence (30 days expiration)
        const sessionExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
        await sessionService_1.default.saveSession({
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
    }
    catch (error) {
        console.error('[Main] Google login completion failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Google Auth: Connect mailbox (Gmail access)
const handleGoogleConnectMailbox = async (mainWindow, userId) => {
    try {
        console.log('[Main] Starting Google mailbox connection with redirect');
        // Validate input
        const validatedUserId = (0, validation_1.validateUserId)(userId); // Will throw if invalid, never null
        // Get user info to use as login hint
        const user = await databaseService_1.default.getUserById(validatedUserId);
        const loginHint = user?.email ?? undefined;
        // Start auth flow - returns authUrl and a promise for the code
        const { authUrl, codePromise, scopes } = await googleAuthService_1.default.authenticateForMailbox(loginHint);
        console.log('[Main] Opening Google mailbox auth URL in popup window');
        // Create a popup window for auth with webSecurity disabled to allow Google's scripts
        const authWindow = new electron_1.BrowserWindow({
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
                const { tokens } = await googleAuthService_1.default.exchangeCodeForTokens(code);
                // Encrypt tokens
                const encryptedAccessToken = tokenEncryptionService_1.default.encrypt(tokens.access_token);
                const encryptedRefreshToken = tokens.refresh_token
                    ? tokenEncryptionService_1.default.encrypt(tokens.refresh_token)
                    : null;
                // Get user's email for the connected_email_address field
                const userInfo = await googleAuthService_1.default.getUserInfo(tokens.access_token);
                // Save mailbox token
                await databaseService_1.default.saveOAuthToken(userId, 'google', 'mailbox', {
                    access_token: encryptedAccessToken,
                    refresh_token: encryptedRefreshToken ?? undefined,
                    token_expires_at: tokens.expires_at ?? undefined,
                    scopes_granted: Array.isArray(tokens.scopes) ? tokens.scopes.join(' ') : tokens.scopes,
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
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('[Main] Google mailbox connection failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Microsoft Auth: Start login flow with local server redirect
const handleMicrosoftLogin = async (mainWindow) => {
    try {
        console.log('[Main] Starting Microsoft login flow with redirect');
        // Start auth flow - returns authUrl and a promise for the code
        const { authUrl, codePromise, codeVerifier, scopes } = await microsoftAuthService_1.default.authenticateForLogin();
        console.log('[Main] Opening auth URL in popup window');
        // Create a popup window for auth with webSecurity disabled to allow Microsoft's scripts
        const authWindow = new electron_1.BrowserWindow({
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
                const tokens = await microsoftAuthService_1.default.exchangeCodeForTokens(code, codeVerifier);
                // Get user info
                const userInfo = await microsoftAuthService_1.default.getUserInfo(tokens.access_token);
                // Encrypt tokens
                const encryptedAccessToken = tokenEncryptionService_1.default.encrypt(tokens.access_token);
                const encryptedRefreshToken = tokens.refresh_token
                    ? tokenEncryptionService_1.default.encrypt(tokens.refresh_token)
                    : null;
                // Sync user to Supabase
                const cloudUser = await supabaseService_1.default.syncUser({
                    email: userInfo.email,
                    first_name: userInfo.given_name,
                    last_name: userInfo.family_name,
                    display_name: userInfo.name,
                    avatar_url: undefined,
                    oauth_provider: 'microsoft',
                    oauth_id: userInfo.id,
                });
                // Create user in local database
                let localUser = await databaseService_1.default.getUserByOAuthId('microsoft', userInfo.id);
                if (!localUser) {
                    localUser = await databaseService_1.default.createUser({
                        email: userInfo.email,
                        first_name: userInfo.given_name,
                        last_name: userInfo.family_name,
                        display_name: userInfo.name,
                        avatar_url: undefined,
                        oauth_provider: 'microsoft',
                        oauth_id: userInfo.id,
                        subscription_tier: cloudUser.subscription_tier,
                        subscription_status: cloudUser.subscription_status,
                        trial_ends_at: cloudUser.trial_ends_at,
                        is_active: true,
                    });
                }
                else {
                    // Update existing user
                    await databaseService_1.default.updateUser(localUser.id, {
                        email: userInfo.email,
                        first_name: userInfo.given_name,
                        last_name: userInfo.family_name,
                        display_name: userInfo.name,
                    });
                }
                // Update last login (localUser is guaranteed non-null from the if/else above)
                if (!localUser) {
                    throw new Error('Local user is unexpectedly null after creation/update');
                }
                await databaseService_1.default.updateLastLogin(localUser.id);
                // Re-fetch user to get updated last_login_at timestamp
                const refreshedUser = await databaseService_1.default.getUserById(localUser.id);
                if (!refreshedUser) {
                    throw new Error('Failed to retrieve user after update');
                }
                localUser = refreshedUser;
                // Save auth token
                const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
                await databaseService_1.default.saveOAuthToken(localUser.id, 'microsoft', 'authentication', {
                    access_token: encryptedAccessToken,
                    refresh_token: encryptedRefreshToken ?? undefined,
                    token_expires_at: expiresAt,
                    scopes_granted: tokens.scope,
                });
                // Create session
                const sessionToken = await databaseService_1.default.createSession(localUser.id);
                // Validate subscription
                const subscription = await supabaseService_1.default.validateSubscription(cloudUser.id);
                // Register device
                const deviceInfo = {
                    device_id: crypto_1.default.randomUUID(),
                    device_name: os_1.default.hostname(),
                    os: os_1.default.platform() + ' ' + os_1.default.release(),
                    app_version: electron_1.app.getVersion(),
                };
                await supabaseService_1.default.registerDevice(cloudUser.id, deviceInfo);
                // Track login event
                await supabaseService_1.default.trackEvent(cloudUser.id, 'user_login', { provider: 'microsoft' }, deviceInfo.device_id, electron_1.app.getVersion());
                console.log('[Main] Microsoft login completed successfully');
                // Check if user needs to accept terms (new user or outdated versions)
                const isNewUser = needsToAcceptTerms(localUser);
                // Save session for persistence (30 days expiration)
                const sessionExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
                await sessionService_1.default.saveSession({
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
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('[Main] Microsoft login failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Microsoft Auth: Connect mailbox (Outlook/Mail access)
const handleMicrosoftConnectMailbox = async (mainWindow, userId) => {
    try {
        console.log('[Main] Starting Microsoft mailbox connection with redirect');
        // Validate input
        const validatedUserId = (0, validation_1.validateUserId)(userId); // Will throw if invalid, never null
        // Get user info to use as login hint
        const user = await databaseService_1.default.getUserById(validatedUserId);
        const loginHint = user?.email ?? undefined;
        // Start auth flow - returns authUrl and a promise for the code
        const { authUrl, codePromise, codeVerifier, scopes } = await microsoftAuthService_1.default.authenticateForMailbox(loginHint);
        console.log('[Main] Opening mailbox auth URL in popup window');
        // Create a popup window for auth with webSecurity disabled to allow Microsoft's scripts
        const authWindow = new electron_1.BrowserWindow({
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
                const tokens = await microsoftAuthService_1.default.exchangeCodeForTokens(code, codeVerifier);
                // Get user info
                const userInfo = await microsoftAuthService_1.default.getUserInfo(tokens.access_token);
                // Encrypt tokens
                const encryptedAccessToken = tokenEncryptionService_1.default.encrypt(tokens.access_token);
                const encryptedRefreshToken = tokens.refresh_token
                    ? tokenEncryptionService_1.default.encrypt(tokens.refresh_token)
                    : null;
                // Save mailbox token
                const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
                await databaseService_1.default.saveOAuthToken(userId, 'microsoft', 'mailbox', {
                    access_token: encryptedAccessToken,
                    refresh_token: encryptedRefreshToken ?? undefined,
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
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('[Main] Microsoft mailbox connection failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Register all handlers (to be called in main.js)
const registerAuthHandlers = (mainWindow) => {
    // Google Auth - Login
    electron_1.ipcMain.handle('auth:google:login', () => handleGoogleLogin(mainWindow));
    electron_1.ipcMain.handle('auth:google:complete-login', handleGoogleCompleteLogin);
    // Google Auth - Mailbox Connection
    electron_1.ipcMain.handle('auth:google:connect-mailbox', (event, userId) => handleGoogleConnectMailbox(mainWindow, userId));
    // Microsoft Auth - Login
    electron_1.ipcMain.handle('auth:microsoft:login', () => handleMicrosoftLogin(mainWindow));
    // Microsoft Auth - Mailbox Connection
    electron_1.ipcMain.handle('auth:microsoft:connect-mailbox', (event, userId) => handleMicrosoftConnectMailbox(mainWindow, userId));
    // Logout
    electron_1.ipcMain.handle('auth:logout', async (event, sessionToken) => {
        try {
            // Validate input
            const validatedSessionToken = (0, validation_1.validateSessionToken)(sessionToken);
            await databaseService_1.default.deleteSession(validatedSessionToken);
            await sessionService_1.default.clearSession();
            return { success: true };
        }
        catch (error) {
            console.error('[Main] Logout failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return { success: false, error: `Validation error: ${error.message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Accept terms
    electron_1.ipcMain.handle('auth:accept-terms', async (event, userId) => {
        try {
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId); // Will throw if invalid, never null
            // Save to local database
            const updatedUser = await databaseService_1.default.acceptTerms(validatedUserId, legalVersions_1.CURRENT_TERMS_VERSION, legalVersions_1.CURRENT_PRIVACY_POLICY_VERSION);
            console.log('[Auth] Terms accepted:', userId, `v${legalVersions_1.CURRENT_TERMS_VERSION}`);
            // Sync to Supabase (cloud backup for legal compliance)
            try {
                await supabaseService_1.default.syncTermsAcceptance(userId, legalVersions_1.CURRENT_TERMS_VERSION, legalVersions_1.CURRENT_PRIVACY_POLICY_VERSION);
            }
            catch (syncError) {
                // Don't fail the acceptance if sync fails - user already accepted locally
                console.error('[Auth] Failed to sync terms to Supabase:', syncError instanceof Error ? syncError.message : 'Unknown error');
            }
            return { success: true, user: updatedUser };
        }
        catch (error) {
            console.error('[Auth] Accept terms failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return { success: false, error: `Validation error: ${error.message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Validate session
    electron_1.ipcMain.handle('auth:validate-session', async (event, sessionToken) => {
        try {
            // Validate input
            const validatedSessionToken = (0, validation_1.validateSessionToken)(sessionToken);
            const session = await databaseService_1.default.validateSession(validatedSessionToken);
            if (!session) {
                return { success: false, valid: false };
            }
            return { success: true, valid: true, user: session };
        }
        catch (error) {
            console.error('[Main] Session validation failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return { success: false, valid: false, error: `Validation error: ${error.message}` };
            }
            return { success: false, valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Get current user (load from saved session)
    electron_1.ipcMain.handle('auth:get-current-user', async () => {
        try {
            const session = await sessionService_1.default.loadSession();
            if (!session) {
                return { success: false, error: 'No active session' };
            }
            // Validate session token in database
            const dbSession = await databaseService_1.default.validateSession(session.sessionToken);
            if (!dbSession) {
                // Session invalid, clear it
                await sessionService_1.default.clearSession();
                return { success: false, error: 'Session expired or invalid' };
            }
            // Load fresh user data from database to ensure we have latest terms acceptance status
            const freshUser = await databaseService_1.default.getUserById(session.user.id);
            const user = freshUser || session.user; // Fallback to session user if db read fails
            return {
                success: true,
                user,
                sessionToken: session.sessionToken,
                subscription: session.subscription,
                provider: session.provider,
                isNewUser: needsToAcceptTerms(user), // Flag if user needs to accept/re-accept terms
            };
        }
        catch (error) {
            console.error('[Main] Get current user failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Shell: Open external URL
    electron_1.ipcMain.handle('shell:open-external', async (event, url) => {
        try {
            // Validate input - prevent opening malicious URLs
            const validatedUrl = (0, validation_1.validateUrl)(url);
            await electron_1.shell.openExternal(validatedUrl);
            return { success: true };
        }
        catch (error) {
            console.error('[Main] Failed to open external URL:', error);
            if (error instanceof validation_1.ValidationError) {
                return { success: false, error: `Validation error: ${error.message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
};
exports.registerAuthHandlers = registerAuthHandlers;
