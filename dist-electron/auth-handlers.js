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
// NOTE: tokenEncryptionService removed - using session-only OAuth
// Tokens are kept in memory during session, users re-authenticate each app launch
// Database encryption (databaseEncryptionService) still protects PII at rest for SOC 2 compliance
const sessionService_1 = __importDefault(require("./services/sessionService"));
const rateLimitService_1 = __importDefault(require("./services/rateLimitService"));
const sessionSecurityService_1 = __importDefault(require("./services/sessionSecurityService"));
const auditService_1 = __importDefault(require("./services/auditService"));
const logService_1 = __importDefault(require("./services/logService"));
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
        return true;
    }
    if (user.privacy_policy_version_accepted && user.privacy_policy_version_accepted !== legalVersions_1.CURRENT_PRIVACY_POLICY_VERSION) {
        return true;
    }
    return false;
}
// Initialize database when app is ready
const initializeDatabase = async () => {
    try {
        await databaseService_1.default.initialize();
        await logService_1.default.info('Database initialized', 'AuthHandlers');
        // Initialize audit service with dependencies
        auditService_1.default.initialize(databaseService_1.default, supabaseService_1.default);
        await logService_1.default.info('Audit service initialized', 'AuthHandlers');
    }
    catch (error) {
        await logService_1.default.error('Failed to initialize database', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
        throw error;
    }
};
exports.initializeDatabase = initializeDatabase;
// Google Auth: Start login flow (uses popup window like Microsoft)
const handleGoogleLogin = async (mainWindow) => {
    try {
        await logService_1.default.info('Starting Google login flow with redirect', 'AuthHandlers');
        // Start auth flow - returns authUrl and a promise for the code
        const { authUrl, codePromise, scopes } = await googleAuthService_1.default.authenticateForLogin();
        await logService_1.default.info('Opening Google auth URL in popup window', 'AuthHandlers');
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
            title: 'Sign in with Google'
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
        // Track if auth completed successfully
        let authCompleted = false;
        // Clean up server if window is closed before auth completes
        authWindow.on('closed', () => {
            if (!authCompleted) {
                googleAuthService_1.default.stopLocalServer();
                logService_1.default.info('Google login auth window closed by user, cleaned up server', 'AuthHandlers');
                // Notify renderer that auth was cancelled
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('google:login-cancelled');
                    logService_1.default.info('Sent google:login-cancelled event to renderer', 'AuthHandlers');
                }
            }
        });
        // Intercept navigation to callback URL to extract code directly (faster than HTTP round-trip)
        const handleGoogleLoginCallbackUrl = (callbackUrl) => {
            const parsedUrl = new URL(callbackUrl);
            const code = parsedUrl.searchParams.get('code');
            const error = parsedUrl.searchParams.get('error');
            const errorDescription = parsedUrl.searchParams.get('error_description');
            if (error) {
                logService_1.default.error(`Google login error from navigation: ${error}`, 'AuthHandlers', { errorDescription });
                googleAuthService_1.default.rejectCodeDirectly(errorDescription || error);
                authCompleted = true;
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
            }
            else if (code) {
                logService_1.default.info('Extracted Google login code directly from navigation (bypassing HTTP server)', 'AuthHandlers');
                googleAuthService_1.default.resolveCodeDirectly(code);
                authCompleted = true;
                // Close window immediately since we don't need to show the success page
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
            }
        };
        // Use will-navigate to intercept the callback before it hits the HTTP server
        authWindow.webContents.on('will-navigate', (event, url) => {
            if (url.startsWith('http://localhost:3001/callback')) {
                event.preventDefault(); // Prevent the navigation to avoid HTTP round-trip
                handleGoogleLoginCallbackUrl(url);
            }
        });
        // Also handle will-redirect as a fallback for server-side redirects
        authWindow.webContents.on('will-redirect', (event, url) => {
            if (url.startsWith('http://localhost:3001/callback')) {
                event.preventDefault(); // Prevent the redirect to avoid HTTP round-trip
                handleGoogleLoginCallbackUrl(url);
            }
        });
        // Return authUrl immediately so frontend knows login started
        // Process the actual login in the background
        setTimeout(async () => {
            try {
                // Wait for code from local server (in background) with timeout
                await logService_1.default.info('Waiting for Google authorization code...', 'AuthHandlers');
                // Add timeout to prevent infinite waiting
                const timeoutMs = 120000; // 2 minutes
                const codeWithTimeout = Promise.race([
                    codePromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Authentication timed out - no response from Google')), timeoutMs))
                ]);
                const code = await codeWithTimeout;
                authCompleted = true;
                await logService_1.default.info('Received Google authorization code from redirect', 'AuthHandlers');
                // Exchange code for tokens
                await logService_1.default.info('Exchanging Google authorization code for tokens...', 'AuthHandlers');
                const { tokens, userInfo } = await googleAuthService_1.default.exchangeCodeForTokens(code);
                await logService_1.default.info('Google token exchange successful', 'AuthHandlers');
                // Session-only OAuth: tokens stored in database (encrypted at rest via databaseEncryptionService)
                // No additional keychain encryption needed - tokens cleared on app restart
                const accessToken = tokens.access_token;
                const refreshToken = tokens.refresh_token || null;
                // Sync user to Supabase (cloud) - doesn't require local database
                await logService_1.default.info('Syncing user to Supabase...', 'AuthHandlers');
                const cloudUser = await supabaseService_1.default.syncUser({
                    email: userInfo.email,
                    first_name: userInfo.given_name,
                    last_name: userInfo.family_name,
                    display_name: userInfo.name,
                    avatar_url: userInfo.picture,
                    oauth_provider: 'google',
                    oauth_id: userInfo.id,
                });
                await logService_1.default.info('User synced to Supabase successfully', 'AuthHandlers', { cloudUserId: cloudUser.id });
                // Validate subscription (cloud) - doesn't require local database
                await logService_1.default.info('Validating subscription...', 'AuthHandlers');
                const subscription = await supabaseService_1.default.validateSubscription(cloudUser.id);
                await logService_1.default.info('Subscription validated', 'AuthHandlers', { tier: subscription?.tier });
                // Check if local database is initialized (keychain has been set up)
                // If not, send pending login data so frontend can show keychain explanation first
                if (!databaseService_1.default.isInitialized()) {
                    await logService_1.default.info('Database not initialized - sending pending login for keychain setup', 'AuthHandlers');
                    // Close the auth window
                    if (authWindow && !authWindow.isDestroyed()) {
                        authWindow.close();
                    }
                    // Send pending login data to frontend
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('google:login-pending', {
                            success: true,
                            pendingLogin: true,
                            // OAuth data needed to complete login after keychain setup
                            oauthData: {
                                provider: 'google',
                                userInfo,
                                tokens: {
                                    access_token: accessToken,
                                    refresh_token: refreshToken,
                                    expires_at: tokens.expires_at ?? new Date(Date.now() + 3600 * 1000).toISOString(),
                                    scopes: Array.isArray(tokens.scopes) ? tokens.scopes : scopes,
                                },
                                cloudUser,
                                subscription: subscription ?? undefined,
                            },
                        });
                    }
                    return; // Exit - frontend will complete login after keychain setup
                }
                // Database is initialized - proceed with local user creation
                await logService_1.default.info('Looking up or creating local user...', 'AuthHandlers');
                let localUser = await databaseService_1.default.getUserByOAuthId('google', userInfo.id);
                const isNewUser = !localUser;
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
                // Update last login
                if (!localUser) {
                    throw new Error('Local user is unexpectedly null after creation/update');
                }
                await logService_1.default.info('Updating last login timestamp...', 'AuthHandlers');
                await databaseService_1.default.updateLastLogin(localUser.id);
                // Re-fetch user to get updated last_login_at timestamp
                const refreshedUser = await databaseService_1.default.getUserById(localUser.id);
                if (!refreshedUser) {
                    throw new Error('Failed to retrieve user after update');
                }
                localUser = refreshedUser;
                await logService_1.default.info('Local user record updated', 'AuthHandlers', { userId: localUser.id });
                // Save auth token (session-only, no keychain encryption)
                await logService_1.default.info('Saving OAuth token for session...', 'AuthHandlers');
                const expiresAt = tokens.expires_at ?? new Date(Date.now() + 3600 * 1000).toISOString();
                await databaseService_1.default.saveOAuthToken(localUser.id, 'google', 'authentication', {
                    access_token: accessToken,
                    refresh_token: refreshToken ?? undefined,
                    token_expires_at: expiresAt,
                    scopes_granted: Array.isArray(tokens.scopes) ? tokens.scopes.join(' ') : scopes.join(' '),
                });
                await logService_1.default.info('OAuth token saved for session', 'AuthHandlers');
                // Create session
                await logService_1.default.info('Creating session...', 'AuthHandlers');
                const sessionToken = await databaseService_1.default.createSession(localUser.id);
                await logService_1.default.info('Session created', 'AuthHandlers');
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
                await logService_1.default.info('Google login completed successfully', 'AuthHandlers', {
                    userId: localUser.id,
                    provider: 'google',
                });
                // Audit log
                await auditService_1.default.log({
                    userId: localUser.id,
                    action: 'LOGIN',
                    resourceType: 'SESSION',
                    resourceId: sessionToken,
                    metadata: { provider: 'google', isNewUser },
                    success: true,
                });
                // Close the auth window if still open
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
                // Notify renderer of successful login
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('google:login-complete', {
                        success: true,
                        user: localUser,
                        sessionToken,
                        subscription: subscription ?? undefined,
                        isNewUser,
                    });
                }
            }
            catch (error) {
                await logService_1.default.error('Google login background processing failed', 'AuthHandlers', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                // Close the auth window if still open
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
                // Notify renderer of failure
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('google:login-complete', {
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }, 0);
        return {
            success: true,
            authUrl,
            scopes,
        };
    }
    catch (error) {
        await logService_1.default.error('Google login failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Google Auth: Complete login with authorization code
const handleGoogleCompleteLogin = async (event, authCode) => {
    try {
        await logService_1.default.info('Completing Google login', 'AuthHandlers');
        // Validate input
        const validatedAuthCode = (0, validation_1.validateAuthCode)(authCode);
        // Exchange code for tokens
        const { tokens, userInfo } = await googleAuthService_1.default.exchangeCodeForTokens(validatedAuthCode);
        // Session-only OAuth: no keychain encryption needed
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token || null;
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
            // Update existing user - sync profile AND user state from cloud (source of truth)
            await databaseService_1.default.updateUser(localUser.id, {
                // Profile fields from OAuth
                email: userInfo.email,
                first_name: userInfo.given_name,
                last_name: userInfo.family_name,
                display_name: userInfo.name,
                avatar_url: userInfo.picture,
                // User state from Supabase (cloud is source of truth)
                terms_accepted_at: cloudUser.terms_accepted_at,
                privacy_policy_accepted_at: cloudUser.privacy_policy_accepted_at,
                terms_version_accepted: cloudUser.terms_version_accepted,
                privacy_policy_version_accepted: cloudUser.privacy_policy_version_accepted,
                email_onboarding_completed_at: cloudUser.email_onboarding_completed_at,
                subscription_tier: cloudUser.subscription_tier,
                subscription_status: cloudUser.subscription_status,
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
        // Save auth token (session-only, no keychain encryption)
        await databaseService_1.default.saveOAuthToken(localUser.id, 'google', 'authentication', {
            access_token: accessToken,
            refresh_token: refreshToken ?? undefined,
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
        await logService_1.default.info('Google login completed successfully', 'AuthHandlers', {
            userId: localUser.id,
            provider: 'google',
        });
        // Check if user needs to accept terms (new user or outdated versions)
        const isNewUser = needsToAcceptTerms(localUser);
        // Session-only OAuth: NO session persistence
        // Users must re-authenticate each app launch for better security
        // This also means only ONE keychain prompt ever (for database encryption)
        // Record successful login for rate limiting
        await rateLimitService_1.default.recordAttempt(localUser.email, true);
        // Audit log successful login
        await auditService_1.default.log({
            userId: localUser.id,
            sessionId: sessionToken,
            action: 'LOGIN',
            resourceType: 'SESSION',
            resourceId: sessionToken,
            metadata: { provider: 'google', isNewUser },
            success: true,
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
        await logService_1.default.error('Google login completion failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
        // Audit log failed login
        await auditService_1.default.log({
            userId: 'unknown',
            action: 'LOGIN_FAILED',
            resourceType: 'SESSION',
            metadata: { provider: 'google', error: error instanceof Error ? error.message : 'Unknown error' },
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Google Auth: Connect mailbox (Gmail access)
const handleGoogleConnectMailbox = async (mainWindow, userId) => {
    try {
        await logService_1.default.info('Starting Google mailbox connection with redirect', 'AuthHandlers');
        // Validate input
        const validatedUserId = (0, validation_1.validateUserId)(userId); // Will throw if invalid, never null
        // Get user info to use as login hint
        const user = await databaseService_1.default.getUserById(validatedUserId);
        const loginHint = user?.email ?? undefined;
        // Start auth flow - returns authUrl and a promise for the code
        const { authUrl, codePromise, scopes } = await googleAuthService_1.default.authenticateForMailbox(loginHint);
        await logService_1.default.info('Opening Google mailbox auth URL in popup window', 'AuthHandlers');
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
        // Track if auth completed successfully
        let authCompleted = false;
        // Clean up server if window is closed before auth completes
        authWindow.on('closed', () => {
            if (!authCompleted) {
                googleAuthService_1.default.stopLocalServer();
                logService_1.default.info('Google mailbox auth window closed by user, cleaned up server', 'AuthHandlers');
                // Notify renderer that auth was cancelled
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('google:mailbox-cancelled');
                    logService_1.default.info('Sent google:mailbox-cancelled event to renderer', 'AuthHandlers');
                }
            }
        });
        // Intercept navigation to callback URL to extract code directly (faster than HTTP round-trip)
        const handleGoogleCallbackUrl = (callbackUrl) => {
            const parsedUrl = new URL(callbackUrl);
            const code = parsedUrl.searchParams.get('code');
            const error = parsedUrl.searchParams.get('error');
            const errorDescription = parsedUrl.searchParams.get('error_description');
            if (error) {
                logService_1.default.error(`Google mailbox auth error from navigation: ${error}`, 'AuthHandlers', { errorDescription });
                googleAuthService_1.default.rejectCodeDirectly(errorDescription || error);
                authCompleted = true;
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
            }
            else if (code) {
                logService_1.default.info('Extracted Google auth code directly from navigation (bypassing HTTP server)', 'AuthHandlers');
                googleAuthService_1.default.resolveCodeDirectly(code);
                authCompleted = true;
                // Close window immediately since we don't need to show the success page
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
            }
        };
        // Use will-navigate to intercept the callback before it hits the HTTP server
        authWindow.webContents.on('will-navigate', (event, url) => {
            if (url.startsWith('http://localhost:3001/callback')) {
                event.preventDefault(); // Prevent the navigation to avoid HTTP round-trip
                handleGoogleCallbackUrl(url);
            }
        });
        // Also handle will-redirect as a fallback for server-side redirects
        authWindow.webContents.on('will-redirect', (event, url) => {
            if (url.startsWith('http://localhost:3001/callback')) {
                event.preventDefault(); // Prevent the redirect to avoid HTTP round-trip
                handleGoogleCallbackUrl(url);
            }
        });
        // Return authUrl immediately so browser can open
        // Don't wait for user - return early
        setTimeout(async () => {
            try {
                // Wait for code from local server (in background)
                const code = await codePromise;
                authCompleted = true;
                await logService_1.default.info('Received Gmail authorization code from redirect', 'AuthHandlers');
                // Exchange code for tokens
                const { tokens } = await googleAuthService_1.default.exchangeCodeForTokens(code);
                // Session-only OAuth: no keychain encryption needed
                const accessToken = tokens.access_token;
                const refreshToken = tokens.refresh_token || null;
                // Get user's email for the connected_email_address field
                const userInfo = await googleAuthService_1.default.getUserInfo(tokens.access_token);
                // Save mailbox token (session-only, no keychain encryption)
                await databaseService_1.default.saveOAuthToken(userId, 'google', 'mailbox', {
                    access_token: accessToken,
                    refresh_token: refreshToken ?? undefined,
                    token_expires_at: tokens.expires_at ?? undefined,
                    scopes_granted: Array.isArray(tokens.scopes) ? tokens.scopes.join(' ') : tokens.scopes,
                    connected_email_address: userInfo.email,
                    mailbox_connected: true,
                });
                await logService_1.default.info('Google mailbox connection completed successfully', 'AuthHandlers', {
                    userId,
                    email: userInfo.email,
                });
                // Audit log mailbox connection
                await auditService_1.default.log({
                    userId,
                    action: 'MAILBOX_CONNECT',
                    resourceType: 'MAILBOX',
                    metadata: { provider: 'google', email: userInfo.email },
                    success: true,
                });
                // Notify renderer of successful connection
                if (mainWindow) {
                    mainWindow.webContents.send('google:mailbox-connected', {
                        success: true,
                        email: userInfo.email,
                    });
                }
            }
            catch (error) {
                await logService_1.default.error('Google mailbox connection background processing failed', 'AuthHandlers', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
                // Audit log failed mailbox connection
                await auditService_1.default.log({
                    userId,
                    action: 'MAILBOX_CONNECT',
                    resourceType: 'MAILBOX',
                    metadata: { provider: 'google' },
                    success: false,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                });
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
        await logService_1.default.error('Google mailbox connection failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Microsoft Auth: Start login flow with local server redirect
const handleMicrosoftLogin = async (mainWindow) => {
    try {
        await logService_1.default.info('Starting Microsoft login flow with redirect', 'AuthHandlers');
        // Start auth flow - returns authUrl and a promise for the code
        const { authUrl, codePromise, codeVerifier, scopes } = await microsoftAuthService_1.default.authenticateForLogin();
        await logService_1.default.info('Opening auth URL in popup window', 'AuthHandlers');
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
        // Track if auth completed successfully
        let authCompleted = false;
        // Clean up server if window is closed before auth completes
        authWindow.on('closed', () => {
            if (!authCompleted) {
                microsoftAuthService_1.default.stopLocalServer();
                logService_1.default.info('Microsoft login auth window closed by user, cleaned up server', 'AuthHandlers');
                // Notify renderer that auth was cancelled
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('microsoft:login-cancelled');
                    logService_1.default.info('Sent microsoft:login-cancelled event to renderer', 'AuthHandlers');
                }
            }
        });
        // Intercept navigation to callback URL to extract code directly (faster than HTTP round-trip)
        const handleCallbackUrl = (callbackUrl) => {
            const parsedUrl = new URL(callbackUrl);
            const code = parsedUrl.searchParams.get('code');
            const error = parsedUrl.searchParams.get('error');
            const errorDescription = parsedUrl.searchParams.get('error_description');
            if (error) {
                logService_1.default.error(`Microsoft auth error from navigation: ${error}`, 'AuthHandlers', { errorDescription });
                microsoftAuthService_1.default.rejectCodeDirectly(errorDescription || error);
                authCompleted = true;
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
            }
            else if (code) {
                logService_1.default.info('Extracted auth code directly from navigation (bypassing HTTP server)', 'AuthHandlers');
                microsoftAuthService_1.default.resolveCodeDirectly(code);
                authCompleted = true;
                // Close window immediately since we don't need to show the success page
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
            }
        };
        // Use will-navigate to intercept the callback before it hits the HTTP server
        authWindow.webContents.on('will-navigate', (event, url) => {
            if (url.startsWith('http://localhost:3000/callback')) {
                event.preventDefault(); // Prevent the navigation to avoid HTTP round-trip
                handleCallbackUrl(url);
            }
        });
        // Also handle will-redirect as a fallback for server-side redirects
        authWindow.webContents.on('will-redirect', (event, url) => {
            if (url.startsWith('http://localhost:3000/callback')) {
                event.preventDefault(); // Prevent the redirect to avoid HTTP round-trip
                handleCallbackUrl(url);
            }
        });
        // Return authUrl immediately so browser can open
        // Don't wait for user - return early
        setTimeout(async () => {
            try {
                // Wait for code from local server (in background) with timeout
                await logService_1.default.info('Waiting for authorization code from local server...', 'AuthHandlers');
                // Add timeout to prevent infinite waiting
                const timeoutMs = 120000; // 2 minutes
                const codeWithTimeout = Promise.race([
                    codePromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Authentication timed out - no response from Microsoft')), timeoutMs))
                ]);
                const code = await codeWithTimeout;
                authCompleted = true;
                await logService_1.default.info('Received authorization code from redirect', 'AuthHandlers');
                // Exchange code for tokens
                await logService_1.default.info('Exchanging authorization code for tokens...', 'AuthHandlers');
                const tokens = await microsoftAuthService_1.default.exchangeCodeForTokens(code, codeVerifier);
                await logService_1.default.info('Token exchange successful', 'AuthHandlers');
                // Get user info
                await logService_1.default.info('Fetching user info from Microsoft Graph...', 'AuthHandlers');
                const userInfo = await microsoftAuthService_1.default.getUserInfo(tokens.access_token);
                await logService_1.default.info('User info retrieved successfully', 'AuthHandlers', { email: userInfo.email });
                // Session-only OAuth: no keychain encryption needed
                const accessToken = tokens.access_token;
                const refreshToken = tokens.refresh_token || null;
                // Sync user to Supabase (cloud) - doesn't require local database
                await logService_1.default.info('Syncing user to Supabase...', 'AuthHandlers');
                const cloudUser = await supabaseService_1.default.syncUser({
                    email: userInfo.email,
                    first_name: userInfo.given_name,
                    last_name: userInfo.family_name,
                    display_name: userInfo.name,
                    avatar_url: undefined,
                    oauth_provider: 'microsoft',
                    oauth_id: userInfo.id,
                });
                await logService_1.default.info('User synced to Supabase successfully', 'AuthHandlers', { cloudUserId: cloudUser.id });
                // Validate subscription (cloud) - doesn't require local database
                await logService_1.default.info('Validating subscription...', 'AuthHandlers');
                const subscription = await supabaseService_1.default.validateSubscription(cloudUser.id);
                await logService_1.default.info('Subscription validated', 'AuthHandlers', { tier: subscription?.tier });
                // Check if local database is initialized (keychain has been set up)
                // If not, send pending login data so frontend can show keychain explanation first
                if (!databaseService_1.default.isInitialized()) {
                    await logService_1.default.info('Database not initialized - sending pending login for keychain setup', 'AuthHandlers');
                    // Close the auth window
                    if (authWindow && !authWindow.isDestroyed()) {
                        authWindow.close();
                    }
                    // Send pending login data to frontend
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('microsoft:login-pending', {
                            success: true,
                            pendingLogin: true,
                            // OAuth data needed to complete login after keychain setup
                            oauthData: {
                                provider: 'microsoft',
                                userInfo,
                                tokens: {
                                    access_token: accessToken,
                                    refresh_token: refreshToken,
                                    expires_in: tokens.expires_in,
                                    scope: tokens.scope,
                                },
                                cloudUser,
                                subscription: subscription ?? undefined,
                            },
                        });
                    }
                    return; // Exit - frontend will complete login after keychain setup
                }
                // Database is initialized - proceed with local user creation
                await logService_1.default.info('Looking up or creating local user...', 'AuthHandlers');
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
                    // Update existing user - sync profile AND user state from cloud (source of truth)
                    await databaseService_1.default.updateUser(localUser.id, {
                        // Profile fields from OAuth
                        email: userInfo.email,
                        first_name: userInfo.given_name,
                        last_name: userInfo.family_name,
                        display_name: userInfo.name,
                        // User state from Supabase (cloud is source of truth)
                        terms_accepted_at: cloudUser.terms_accepted_at,
                        privacy_policy_accepted_at: cloudUser.privacy_policy_accepted_at,
                        terms_version_accepted: cloudUser.terms_version_accepted,
                        privacy_policy_version_accepted: cloudUser.privacy_policy_version_accepted,
                        email_onboarding_completed_at: cloudUser.email_onboarding_completed_at,
                        subscription_tier: cloudUser.subscription_tier,
                        subscription_status: cloudUser.subscription_status,
                    });
                }
                // Update last login (localUser is guaranteed non-null from the if/else above)
                if (!localUser) {
                    throw new Error('Local user is unexpectedly null after creation/update');
                }
                await logService_1.default.info('Updating last login timestamp...', 'AuthHandlers');
                await databaseService_1.default.updateLastLogin(localUser.id);
                // Re-fetch user to get updated last_login_at timestamp
                const refreshedUser = await databaseService_1.default.getUserById(localUser.id);
                if (!refreshedUser) {
                    throw new Error('Failed to retrieve user after update');
                }
                localUser = refreshedUser;
                await logService_1.default.info('Local user record updated', 'AuthHandlers', { userId: localUser.id });
                // Save auth token (session-only, no keychain encryption)
                await logService_1.default.info('Saving OAuth token for session...', 'AuthHandlers');
                const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
                await databaseService_1.default.saveOAuthToken(localUser.id, 'microsoft', 'authentication', {
                    access_token: accessToken,
                    refresh_token: refreshToken ?? undefined,
                    token_expires_at: expiresAt,
                    scopes_granted: tokens.scope,
                });
                await logService_1.default.info('OAuth token saved for session', 'AuthHandlers');
                // Create session
                await logService_1.default.info('Creating session...', 'AuthHandlers');
                const sessionToken = await databaseService_1.default.createSession(localUser.id);
                await logService_1.default.info('Session created', 'AuthHandlers');
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
                await logService_1.default.info('Microsoft login completed successfully', 'AuthHandlers', {
                    userId: localUser.id,
                    provider: 'microsoft',
                });
                // Check if user needs to accept terms (new user or outdated versions)
                const isNewUser = needsToAcceptTerms(localUser);
                // Session-only OAuth: NO session persistence
                // Users must re-authenticate each app launch for better security
                // This also means only ONE keychain prompt ever (for database encryption)
                // Record successful login for rate limiting
                await rateLimitService_1.default.recordAttempt(localUser.email, true);
                // Audit log successful login
                await auditService_1.default.log({
                    userId: localUser.id,
                    sessionId: sessionToken,
                    action: 'LOGIN',
                    resourceType: 'SESSION',
                    resourceId: sessionToken,
                    metadata: { provider: 'microsoft', isNewUser },
                    success: true,
                });
                // Notify renderer of successful login
                await logService_1.default.info('Preparing to notify renderer of successful login...', 'AuthHandlers');
                if (mainWindow && !mainWindow.isDestroyed()) {
                    await logService_1.default.info('Sending microsoft:login-complete IPC message to renderer', 'AuthHandlers');
                    mainWindow.webContents.send('microsoft:login-complete', {
                        success: true,
                        user: localUser,
                        sessionToken,
                        subscription,
                        isNewUser,
                    });
                    await logService_1.default.info('IPC message sent successfully', 'AuthHandlers');
                }
                else {
                    await logService_1.default.error('Cannot send IPC message - mainWindow is null or destroyed', 'AuthHandlers', {
                        mainWindowExists: !!mainWindow,
                        isDestroyed: mainWindow?.isDestroyed() ?? 'N/A',
                    });
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const errorStack = error instanceof Error ? error.stack : undefined;
                await logService_1.default.error('Microsoft login background processing failed', 'AuthHandlers', { error: errorMessage, stack: errorStack });
                // Audit log failed login
                await auditService_1.default.log({
                    userId: 'unknown',
                    action: 'LOGIN_FAILED',
                    resourceType: 'SESSION',
                    metadata: { provider: 'microsoft', error: errorMessage },
                    success: false,
                    errorMessage: errorMessage,
                });
                if (mainWindow && !mainWindow.isDestroyed()) {
                    await logService_1.default.info('Sending microsoft:login-complete error IPC message to renderer', 'AuthHandlers');
                    mainWindow.webContents.send('microsoft:login-complete', {
                        success: false,
                        error: errorMessage,
                    });
                }
                else {
                    await logService_1.default.error('Cannot send error IPC message - mainWindow is null or destroyed', 'AuthHandlers');
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
        await logService_1.default.error('Microsoft login failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Microsoft Auth: Connect mailbox (Outlook/Mail access)
const handleMicrosoftConnectMailbox = async (mainWindow, userId) => {
    try {
        await logService_1.default.info('Starting Microsoft mailbox connection with redirect', 'AuthHandlers');
        // Validate input
        const validatedUserId = (0, validation_1.validateUserId)(userId); // Will throw if invalid, never null
        // Get user info to use as login hint
        const user = await databaseService_1.default.getUserById(validatedUserId);
        const loginHint = user?.email ?? undefined;
        // Start auth flow - returns authUrl and a promise for the code
        const { authUrl, codePromise, codeVerifier, scopes } = await microsoftAuthService_1.default.authenticateForMailbox(loginHint);
        await logService_1.default.info('Opening mailbox auth URL in popup window', 'AuthHandlers');
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
        // Track if auth completed successfully
        let authCompleted = false;
        // Clean up server if window is closed before auth completes
        authWindow.on('closed', () => {
            if (!authCompleted) {
                microsoftAuthService_1.default.stopLocalServer();
                logService_1.default.info('Microsoft mailbox auth window closed by user, cleaned up server', 'AuthHandlers');
                // Notify renderer that auth was cancelled
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('microsoft:mailbox-cancelled');
                    logService_1.default.info('Sent microsoft:mailbox-cancelled event to renderer', 'AuthHandlers');
                }
            }
        });
        // Intercept navigation to callback URL to extract code directly (faster than HTTP round-trip)
        const handleMailboxCallbackUrl = (callbackUrl) => {
            const parsedUrl = new URL(callbackUrl);
            const code = parsedUrl.searchParams.get('code');
            const error = parsedUrl.searchParams.get('error');
            const errorDescription = parsedUrl.searchParams.get('error_description');
            if (error) {
                logService_1.default.error(`Microsoft mailbox auth error from navigation: ${error}`, 'AuthHandlers', { errorDescription });
                microsoftAuthService_1.default.rejectCodeDirectly(errorDescription || error);
                authCompleted = true;
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
            }
            else if (code) {
                logService_1.default.info('Extracted mailbox auth code directly from navigation (bypassing HTTP server)', 'AuthHandlers');
                microsoftAuthService_1.default.resolveCodeDirectly(code);
                authCompleted = true;
                // Close window immediately since we don't need to show the success page
                if (authWindow && !authWindow.isDestroyed()) {
                    authWindow.close();
                }
            }
        };
        // Use will-navigate to intercept the callback before it hits the HTTP server
        authWindow.webContents.on('will-navigate', (event, url) => {
            if (url.startsWith('http://localhost:3000/callback')) {
                event.preventDefault(); // Prevent the navigation to avoid HTTP round-trip
                handleMailboxCallbackUrl(url);
            }
        });
        // Also handle will-redirect as a fallback for server-side redirects
        authWindow.webContents.on('will-redirect', (event, url) => {
            if (url.startsWith('http://localhost:3000/callback')) {
                event.preventDefault(); // Prevent the redirect to avoid HTTP round-trip
                handleMailboxCallbackUrl(url);
            }
        });
        // Return authUrl immediately so browser can open
        // Don't wait for user - return early
        setTimeout(async () => {
            try {
                // Wait for code from local server (in background)
                const code = await codePromise;
                authCompleted = true;
                await logService_1.default.info('Received mailbox authorization code from redirect', 'AuthHandlers');
                // Exchange code for tokens
                const tokens = await microsoftAuthService_1.default.exchangeCodeForTokens(code, codeVerifier);
                // Get user info
                const userInfo = await microsoftAuthService_1.default.getUserInfo(tokens.access_token);
                // Session-only OAuth: no keychain encryption needed
                const accessToken = tokens.access_token;
                const refreshToken = tokens.refresh_token || null;
                // Save mailbox token (session-only, no keychain encryption)
                const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
                await logService_1.default.info('Saving Microsoft mailbox token for user', 'AuthHandlers');
                await databaseService_1.default.saveOAuthToken(userId, 'microsoft', 'mailbox', {
                    access_token: accessToken,
                    refresh_token: refreshToken ?? undefined,
                    token_expires_at: expiresAt,
                    scopes_granted: tokens.scope,
                    connected_email_address: userInfo.email,
                    mailbox_connected: true,
                });
                await logService_1.default.info('Microsoft mailbox connection completed successfully', 'AuthHandlers', {
                    userId,
                    email: userInfo.email,
                });
                // Audit log mailbox connection
                await auditService_1.default.log({
                    userId,
                    action: 'MAILBOX_CONNECT',
                    resourceType: 'MAILBOX',
                    metadata: { provider: 'microsoft', email: userInfo.email },
                    success: true,
                });
                // Notify renderer of successful connection
                if (mainWindow) {
                    mainWindow.webContents.send('microsoft:mailbox-connected', {
                        success: true,
                        email: userInfo.email,
                    });
                }
            }
            catch (error) {
                await logService_1.default.error('Microsoft mailbox connection background processing failed', 'AuthHandlers', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
                // Audit log failed mailbox connection
                await auditService_1.default.log({
                    userId,
                    action: 'MAILBOX_CONNECT',
                    resourceType: 'MAILBOX',
                    metadata: { provider: 'microsoft' },
                    success: false,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                });
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
        await logService_1.default.error('Microsoft mailbox connection failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
/**
 * Complete a pending login after keychain setup
 * This is called when OAuth succeeded but database wasn't initialized yet.
 * Now that the database is ready, we can save the user locally.
 */
const handleCompletePendingLogin = async (_event, oauthData) => {
    try {
        await logService_1.default.info(`Completing pending ${oauthData.provider} login after keychain setup`, 'AuthHandlers');
        const { provider, userInfo, tokens, cloudUser, subscription } = oauthData;
        // Create user in local database
        await logService_1.default.info('Looking up or creating local user...', 'AuthHandlers');
        let localUser = await databaseService_1.default.getUserByOAuthId(provider, userInfo.id);
        const isNewUser = !localUser;
        if (!localUser) {
            localUser = await databaseService_1.default.createUser({
                email: userInfo.email,
                first_name: userInfo.given_name,
                last_name: userInfo.family_name,
                display_name: userInfo.name,
                avatar_url: userInfo.picture,
                oauth_provider: provider,
                oauth_id: userInfo.id,
                subscription_tier: cloudUser.subscription_tier ?? 'free',
                subscription_status: cloudUser.subscription_status ?? 'trial',
                trial_ends_at: cloudUser.trial_ends_at,
                is_active: true,
            });
        }
        else {
            // Update existing user - sync profile AND user state from cloud (source of truth)
            await databaseService_1.default.updateUser(localUser.id, {
                email: userInfo.email,
                first_name: userInfo.given_name,
                last_name: userInfo.family_name,
                display_name: userInfo.name,
                avatar_url: userInfo.picture,
                terms_accepted_at: cloudUser.terms_accepted_at,
                privacy_policy_accepted_at: cloudUser.privacy_policy_accepted_at,
                terms_version_accepted: cloudUser.terms_version_accepted,
                privacy_policy_version_accepted: cloudUser.privacy_policy_version_accepted,
                email_onboarding_completed_at: cloudUser.email_onboarding_completed_at,
                subscription_tier: cloudUser.subscription_tier ?? 'free',
                subscription_status: cloudUser.subscription_status ?? 'trial',
            });
        }
        if (!localUser) {
            throw new Error('Local user is unexpectedly null after creation/update');
        }
        // Update last login
        await databaseService_1.default.updateLastLogin(localUser.id);
        const refreshedUser = await databaseService_1.default.getUserById(localUser.id);
        if (!refreshedUser) {
            throw new Error('Failed to retrieve user after update');
        }
        localUser = refreshedUser;
        // Calculate expiry time
        const expiresAt = tokens.expires_at
            ? tokens.expires_at
            : tokens.expires_in
                ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                : new Date(Date.now() + 3600 * 1000).toISOString();
        // Save auth token
        await databaseService_1.default.saveOAuthToken(localUser.id, provider, 'authentication', {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token ?? undefined,
            token_expires_at: expiresAt,
            scopes_granted: tokens.scopes ? tokens.scopes.join(' ') : tokens.scope || '',
        });
        // Create session
        const sessionToken = await databaseService_1.default.createSession(localUser.id);
        // Register device
        const deviceInfo = {
            device_id: crypto_1.default.randomUUID(),
            device_name: os_1.default.hostname(),
            os: os_1.default.platform() + ' ' + os_1.default.release(),
            app_version: electron_1.app.getVersion(),
        };
        await supabaseService_1.default.registerDevice(cloudUser.id, deviceInfo);
        // Track login event
        await supabaseService_1.default.trackEvent(cloudUser.id, 'user_login', { provider }, deviceInfo.device_id, electron_1.app.getVersion());
        // Audit log
        await auditService_1.default.log({
            userId: localUser.id,
            action: 'LOGIN',
            resourceType: 'SESSION',
            resourceId: sessionToken,
            metadata: { provider, isNewUser, pendingLogin: true },
            success: true,
        });
        await logService_1.default.info(`Pending ${provider} login completed successfully`, 'AuthHandlers', {
            userId: localUser.id,
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
        await logService_1.default.error('Failed to complete pending login', 'AuthHandlers', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};
// Disconnect mailbox (remove OAuth token for mailbox purpose)
const handleDisconnectMailbox = async (mainWindow, userId, provider) => {
    try {
        await logService_1.default.info(`Starting ${provider} mailbox disconnect`, 'AuthHandlers', { userId });
        // Validate input
        const validatedUserId = (0, validation_1.validateUserId)(userId);
        // Delete the OAuth token for this mailbox
        await databaseService_1.default.deleteOAuthToken(validatedUserId, provider, 'mailbox');
        await logService_1.default.info(`${provider} mailbox disconnected successfully`, 'AuthHandlers', { userId });
        // Audit log mailbox disconnect
        await auditService_1.default.log({
            userId: validatedUserId,
            action: 'MAILBOX_DISCONNECT',
            resourceType: 'MAILBOX',
            metadata: { provider },
            success: true,
        });
        // Notify renderer of successful disconnect
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(`${provider}:mailbox-disconnected`, {
                success: true,
            });
        }
        return { success: true };
    }
    catch (error) {
        await logService_1.default.error(`${provider} mailbox disconnect failed`, 'AuthHandlers', { userId, error: error instanceof Error ? error.message : 'Unknown error' });
        // Audit log failed disconnect
        await auditService_1.default.log({
            userId,
            action: 'MAILBOX_DISCONNECT',
            resourceType: 'MAILBOX',
            metadata: { provider },
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
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
    // Google Auth - Mailbox Disconnect
    electron_1.ipcMain.handle('auth:google:disconnect-mailbox', (event, userId) => handleDisconnectMailbox(mainWindow, userId, 'google'));
    // Microsoft Auth - Login
    electron_1.ipcMain.handle('auth:microsoft:login', () => handleMicrosoftLogin(mainWindow));
    // Microsoft Auth - Mailbox Connection
    electron_1.ipcMain.handle('auth:microsoft:connect-mailbox', (event, userId) => handleMicrosoftConnectMailbox(mainWindow, userId));
    // Microsoft Auth - Mailbox Disconnect
    electron_1.ipcMain.handle('auth:microsoft:disconnect-mailbox', (event, userId) => handleDisconnectMailbox(mainWindow, userId, 'microsoft'));
    // Complete pending login (after keychain setup)
    // Used when OAuth succeeds but database wasn't initialized yet
    electron_1.ipcMain.handle('auth:complete-pending-login', handleCompletePendingLogin);
    // Logout
    electron_1.ipcMain.handle('auth:logout', async (event, sessionToken) => {
        try {
            // Validate input
            const validatedSessionToken = (0, validation_1.validateSessionToken)(sessionToken);
            // Get session info before deleting for audit purposes
            const session = await databaseService_1.default.validateSession(validatedSessionToken);
            const userId = session?.user_id || 'unknown';
            await databaseService_1.default.deleteSession(validatedSessionToken);
            await sessionService_1.default.clearSession();
            sessionSecurityService_1.default.cleanupSession(validatedSessionToken);
            // Audit log logout
            await auditService_1.default.log({
                userId,
                sessionId: validatedSessionToken,
                action: 'LOGOUT',
                resourceType: 'SESSION',
                resourceId: validatedSessionToken,
                success: true,
            });
            await logService_1.default.info('User logged out successfully', 'AuthHandlers', { userId });
            return { success: true };
        }
        catch (error) {
            await logService_1.default.error('Logout failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
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
            await logService_1.default.info('Terms accepted', 'AuthHandlers', { version: legalVersions_1.CURRENT_TERMS_VERSION });
            // Sync to Supabase (cloud backup for legal compliance)
            try {
                await supabaseService_1.default.syncTermsAcceptance(userId, legalVersions_1.CURRENT_TERMS_VERSION, legalVersions_1.CURRENT_PRIVACY_POLICY_VERSION);
            }
            catch (syncError) {
                // Don't fail the acceptance if sync fails - user already accepted locally
                await logService_1.default.warn('Failed to sync terms to Supabase', 'AuthHandlers', { error: syncError instanceof Error ? syncError.message : 'Unknown error' });
            }
            return { success: true, user: updatedUser };
        }
        catch (error) {
            await logService_1.default.error('Accept terms failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
            if (error instanceof validation_1.ValidationError) {
                return { success: false, error: `Validation error: ${error.message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Complete email onboarding
    electron_1.ipcMain.handle('auth:complete-email-onboarding', async (event, userId) => {
        try {
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            // Save to local database
            await databaseService_1.default.completeEmailOnboarding(validatedUserId);
            await logService_1.default.info('Email onboarding completed', 'AuthHandlers', { userId: validatedUserId });
            // Sync to Supabase
            try {
                await supabaseService_1.default.completeEmailOnboarding(userId);
            }
            catch (syncError) {
                // Don't fail if sync fails - user already completed locally
                await logService_1.default.warn('Failed to sync email onboarding to Supabase', 'AuthHandlers', { error: syncError instanceof Error ? syncError.message : 'Unknown error' });
            }
            return { success: true };
        }
        catch (error) {
            await logService_1.default.error('Complete email onboarding failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
            if (error instanceof validation_1.ValidationError) {
                return { success: false, error: `Validation error: ${error.message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Check email onboarding status
    electron_1.ipcMain.handle('auth:check-email-onboarding', async (event, userId) => {
        try {
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            // Check local database
            const completed = await databaseService_1.default.hasCompletedEmailOnboarding(validatedUserId);
            return { success: true, completed };
        }
        catch (error) {
            await logService_1.default.error('Check email onboarding status failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
            if (error instanceof validation_1.ValidationError) {
                return { success: false, completed: false, error: `Validation error: ${error.message}` };
            }
            return { success: false, completed: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
            // Check session security (idle and absolute timeout)
            const createdAt = session.created_at instanceof Date
                ? session.created_at.toISOString()
                : session.created_at;
            const lastAccessedAt = session.last_accessed_at instanceof Date
                ? session.last_accessed_at.toISOString()
                : session.last_accessed_at;
            const securityCheck = await sessionSecurityService_1.default.checkSessionValidity({ created_at: createdAt, last_accessed_at: lastAccessedAt }, validatedSessionToken);
            if (!securityCheck.valid) {
                // Session expired, clean up
                await databaseService_1.default.deleteSession(validatedSessionToken);
                sessionSecurityService_1.default.cleanupSession(validatedSessionToken);
                return { success: false, valid: false, error: `Session ${securityCheck.reason}` };
            }
            // Record activity for idle timeout tracking
            sessionSecurityService_1.default.recordActivity(validatedSessionToken);
            return { success: true, valid: true, user: session };
        }
        catch (error) {
            await logService_1.default.error('Session validation failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
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
                sessionSecurityService_1.default.cleanupSession(session.sessionToken);
                return { success: false, error: 'Session expired or invalid' };
            }
            // Check session security (idle and absolute timeout)
            const dbCreatedAt = dbSession.created_at instanceof Date
                ? dbSession.created_at.toISOString()
                : dbSession.created_at;
            const dbLastAccessedAt = dbSession.last_accessed_at instanceof Date
                ? dbSession.last_accessed_at.toISOString()
                : dbSession.last_accessed_at;
            const securityCheck = await sessionSecurityService_1.default.checkSessionValidity({ created_at: dbCreatedAt, last_accessed_at: dbLastAccessedAt }, session.sessionToken);
            if (!securityCheck.valid) {
                // Session expired, clean up
                await databaseService_1.default.deleteSession(session.sessionToken);
                await sessionService_1.default.clearSession();
                sessionSecurityService_1.default.cleanupSession(session.sessionToken);
                return { success: false, error: `Session ${securityCheck.reason}` };
            }
            // Record activity for idle timeout tracking
            sessionSecurityService_1.default.recordActivity(session.sessionToken);
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
            await logService_1.default.error('Get current user failed', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
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
            await logService_1.default.error('Failed to open external URL', 'AuthHandlers', { error: error instanceof Error ? error.message : 'Unknown error' });
            if (error instanceof validation_1.ValidationError) {
                return { success: false, error: `Validation error: ${error.message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
};
exports.registerAuthHandlers = registerAuthHandlers;
