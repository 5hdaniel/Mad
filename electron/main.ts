import {
  app,
  BrowserWindow,
  session,
} from "electron";
import path from "path";
import log from "electron-log";

// ==========================================
// DEEP LINK PROTOCOL REGISTRATION (TASK-1500)
// ==========================================
// Register magicaudit:// protocol handler at runtime
// This is needed for development mode and as a fallback for production
if (process.defaultApp) {
  // In development, register with the full path to the project directory
  // This ensures macOS can launch the app correctly via deep link
  const appPath = path.resolve(__dirname, '..');
  log.info('[DeepLink] Dev mode - registering protocol with path:', appPath);
  log.info('[DeepLink] Electron binary:', process.execPath);
  app.setAsDefaultProtocolClient('magicaudit', process.execPath, [appPath]);
} else {
  // In production, electron-builder handles registration via package.json protocols config
  app.setAsDefaultProtocolClient('magicaudit');
}

// ==========================================
// SINGLE INSTANCE LOCK (TASK-1500)
// ==========================================
// Ensure only one instance of the app is running
// This is required for deep link handling on Windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is running, quit this one
  // The other instance will handle the deep link via second-instance event
  app.quit();
}
import { autoUpdater } from "electron-updater";
import dotenv from "dotenv";

// Load environment files based on whether app is packaged or in development
if (app.isPackaged) {
  // Packaged build: load .env.production from resources
  const envPath = path.join(process.resourcesPath, "app.asar", ".env.production");
  dotenv.config({ path: envPath });
} else {
  // Development: load .env.development first (OAuth credentials), then .env.local for overrides
  dotenv.config({ path: path.join(__dirname, "../.env.development") });
  dotenv.config({ path: path.join(__dirname, "../.env.local") });
}

// Import constants
import {
  WINDOW_CONFIG,
  DEV_SERVER_URL,
  UPDATE_CHECK_DELAY,
} from "./constants";

// Import handler registration functions
import { registerAuthHandlers } from "./auth-handlers";
import { registerTransactionHandlers, cleanupTransactionHandlers } from "./transaction-handlers";
import { registerContactHandlers } from "./contact-handlers";
import { registerAddressHandlers } from "./address-handlers";
import { registerFeedbackHandlers } from "./feedback-handlers";
import { registerSystemHandlers } from "./system-handlers";
import { registerPreferenceHandlers } from "./preference-handlers";
import {
  registerDeviceHandlers,
  cleanupDeviceHandlers,
} from "./device-handlers";
import { registerBackupHandlers } from "./backup-handlers";
import { registerSyncHandlers, cleanupSyncHandlers } from "./sync-handlers";
import { registerDriverHandlers } from "./driver-handlers";
import { registerLLMHandlers } from "./llm-handlers";
import { registerLicenseHandlers } from "./license-handlers";
import { LLMConfigService } from "./services/llm/llmConfigService";

// Import license and device services for deep link auth validation (TASK-1507)
import { validateLicense, createUserLicense } from "./services/licenseService";
import { registerDevice } from "./services/deviceService";
import supabaseService from "./services/supabaseService";
import databaseService from "./services/databaseService";
import type { OAuthProvider, SubscriptionTier, SubscriptionStatus } from "./types";

// Import extracted handlers from handlers/ directory
import {
  registerPermissionHandlers,
  registerConversationHandlers,
  registerMessageImportHandlers,
  registerOutlookHandlers,
  registerUpdaterHandlers,
} from "./handlers";

// Configure logging for auto-updater
log.transports.file.level = "info";

// Global error handlers - must be registered early, before any async operations
// These catch uncaught exceptions and unhandled promise rejections to prevent silent crashes
process.on("uncaughtException", (error: Error) => {
  console.error("[FATAL] Uncaught Exception:", error);
  log.error("[FATAL] Uncaught Exception:", error);
  // Do NOT call process.exit() - let Electron handle graceful shutdown
  // Do NOT show dialog here - it may not be ready at startup
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[ERROR] Unhandled Rejection:", reason);
  log.error("[ERROR] Unhandled Rejection:", reason);
  // Log but do not crash - unhandled rejections are often recoverable
});

let mainWindow: BrowserWindow | null = null;

// ==========================================
// PENDING DEEP LINK USER (TASK-1507D)
// ==========================================
// When deep link auth completes before database is initialized,
// we store the user data here and create the local user after DB init.

interface PendingDeepLinkUser {
  supabaseId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  provider: OAuthProvider;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  trialEndsAt?: string;
}

let pendingDeepLinkUser: PendingDeepLinkUser | null = null;

/**
 * Store pending deep link user data for later creation
 * Used when deep link auth completes before database is initialized
 */
export function setPendingDeepLinkUser(data: PendingDeepLinkUser): void {
  pendingDeepLinkUser = data;
  log.info("[DeepLink] Stored pending user for later creation:", data.supabaseId);
}

/**
 * Get and clear pending deep link user data
 * Called after database initialization to create the user
 */
export function getAndClearPendingDeepLinkUser(): PendingDeepLinkUser | null {
  const user = pendingDeepLinkUser;
  pendingDeepLinkUser = null;
  return user;
}

/**
 * Create or update local SQLite user from deep link auth data (TASK-1507D)
 *
 * This ensures the local database has a user record after deep link auth,
 * which is required for FK constraints (mailbox connection, audit logs, etc.)
 *
 * @param userData - User data from Supabase session
 * @returns Promise<void>
 */
async function syncDeepLinkUserToLocalDb(userData: PendingDeepLinkUser): Promise<void> {
  try {
    // Check if user already exists by email (deep link users use Supabase ID as oauth_id)
    // We check by email first since that's the unique identifier
    let localUser = await databaseService.getUserByEmail(userData.email);

    if (!localUser) {
      // Also check by OAuth ID in case the user was created via a different flow
      // Map 'azure' to 'microsoft' for lookup (Azure AD is Microsoft's provider)
      const lookupProvider = userData.provider === "azure" ? "microsoft" : userData.provider;
      localUser = await databaseService.getUserByOAuthId(lookupProvider, userData.supabaseId);
    }

    if (!localUser) {
      // TASK-1507G: Use Supabase Auth UUID as local user ID for unified IDs
      // Map 'azure' to 'microsoft' - Azure AD is Microsoft's auth provider
      const normalizedProvider = userData.provider === "azure" ? "microsoft" : userData.provider;
      await databaseService.createUser({
        id: userData.supabaseId,
        email: userData.email,
        display_name: userData.displayName || userData.email.split("@")[0],
        avatar_url: userData.avatarUrl,
        oauth_provider: normalizedProvider,
        oauth_id: userData.supabaseId,
        subscription_tier: userData.subscriptionTier || "free",
        subscription_status: userData.subscriptionStatus || "trial",
        trial_ends_at: userData.trialEndsAt,
        is_active: true,
      });
      log.info("[DeepLink] Created local SQLite user for:", userData.supabaseId);
    } else {
      log.info("[DeepLink] Local user already exists for:", userData.email);
    }
  } catch (error) {
    log.error("[DeepLink] Failed to create local user:", error);
    // Don't rethrow - auth should still succeed even if local user creation fails
    // The user will be created on next database operation that requires it
  }
}

// ==========================================
// DEEP LINK HANDLER (TASK-1500, enhanced TASK-1507)
// ==========================================
/**
 * Handle incoming deep link authentication callback
 * Parses the URL, validates license, registers device, and sends result to renderer
 *
 * TASK-1507: Enhanced to validate license and register device before completing auth
 *
 * Expected URL format: magicaudit://callback?access_token=...&refresh_token=...
 *
 * @param url - The deep link URL to process
 */
async function handleDeepLinkCallback(url: string): Promise<void> {
  try {
    const parsed = new URL(url);

    // Support multiple path formats: //callback, /callback, or host=callback
    const isCallback =
      parsed.pathname === "//callback" ||
      parsed.pathname === "/callback" ||
      parsed.host === "callback";

    if (isCallback) {
      // TASK-1508A: Parse tokens from both query params AND URL fragment
      // Supabase OAuth returns tokens in fragment (#access_token=...) not query params (?access_token=...)
      // URL fragments are not sent to servers, only processed client-side (OAuth implicit flow security)
      const hashParams = parsed.hash ? new URLSearchParams(parsed.hash.slice(1)) : null;
      const accessToken = parsed.searchParams.get("access_token") || hashParams?.get("access_token");
      const refreshToken = parsed.searchParams.get("refresh_token") || hashParams?.get("refresh_token");

      // Log which format was detected for debugging
      log.info("[DeepLink] Parsing callback URL", {
        hasQueryParams: !!parsed.searchParams.get("access_token"),
        hasHashParams: !!hashParams?.get("access_token"),
      });

      if (!accessToken || !refreshToken) {
        // Missing tokens - send error to renderer
        log.error("[DeepLink] Callback URL missing tokens:", url);
        sendToRenderer("auth:deep-link-error", {
          error: "Missing tokens in callback URL",
          code: "MISSING_TOKENS",
        });
        return;
      }

      // TASK-1507: Step 1 - Verify tokens and establish session using setSession()
      // Per SR Engineer review: Use setSession() instead of getUser() for proper session establishment
      log.info("[DeepLink] Setting session with tokens...");
      const { data: sessionData, error: sessionError } = await supabaseService
        .getClient()
        .auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

      if (sessionError || !sessionData?.user) {
        log.error("[DeepLink] Failed to set session:", sessionError);
        sendToRenderer("auth:deep-link-error", {
          error: "Invalid authentication tokens",
          code: "INVALID_TOKENS",
        });
        return;
      }

      const user = sessionData.user;
      log.info("[DeepLink] Session established for user:", user.id);

      // TASK-1507: Step 2 - Validate license
      log.info("[DeepLink] Validating license for user:", user.id);
      let licenseStatus = await validateLicense(user.id);

      // TASK-1507: Step 3 - Create trial license if needed
      if (licenseStatus.blockReason === "no_license") {
        log.info("[DeepLink] Creating trial license for new user:", user.id);
        licenseStatus = await createUserLicense(user.id);
      }

      // TASK-1507: Step 4 - Check if license blocks access (expired/suspended)
      if (!licenseStatus.isValid && licenseStatus.blockReason !== "no_license") {
        log.warn("[DeepLink] License blocked for user:", user.id, "reason:", licenseStatus.blockReason);
        sendToRenderer("auth:deep-link-license-blocked", {
          accessToken,
          refreshToken,
          userId: user.id,
          blockReason: licenseStatus.blockReason,
          licenseStatus,
        });
        focusMainWindow();
        return;
      }

      // TASK-1507: Step 5 - Register device
      log.info("[DeepLink] Registering device for user:", user.id);
      const deviceResult = await registerDevice(user.id);

      if (!deviceResult.success && deviceResult.error === "device_limit_reached") {
        log.warn("[DeepLink] Device limit reached for user:", user.id);
        sendToRenderer("auth:deep-link-device-limit", {
          accessToken,
          refreshToken,
          userId: user.id,
          licenseStatus,
        });
        focusMainWindow();
        return;
      }

      // TASK-1507D: Step 5.5 - Create local SQLite user
      // This is required for FK constraints (mailbox connection, audit logs, contacts)
      const provider = (user.app_metadata?.provider as OAuthProvider) || "google";

      // Map license type to subscription tier
      // licenseType: 'trial' | 'individual' | 'team' -> subscriptionTier: 'free' | 'pro' | 'enterprise'
      const mapLicenseToTier = (lt: string): SubscriptionTier => {
        if (lt === "individual") return "pro";
        if (lt === "team") return "enterprise";
        return "free"; // trial or unknown
      };

      // Map trial status to subscription status
      // trialStatus: 'active' | 'expired' | 'converted' -> subscriptionStatus: 'trial' | 'active' | 'cancelled' | 'expired'
      const mapTrialToStatus = (ts?: string, lt?: string): SubscriptionStatus => {
        if (lt === "individual" || lt === "team") return "active"; // Paid plan
        if (ts === "expired") return "expired";
        if (ts === "converted") return "active";
        return "trial"; // Default for trial license
      };

      // Extract email - Azure/Microsoft may have empty user.email but email in user_metadata
      const userEmail = user.email || user.user_metadata?.email || "";

      const deepLinkUserData: PendingDeepLinkUser = {
        supabaseId: user.id,
        email: userEmail,
        displayName: user.user_metadata?.full_name,
        avatarUrl: user.user_metadata?.avatar_url,
        provider,
        subscriptionTier: mapLicenseToTier(licenseStatus.licenseType),
        subscriptionStatus: mapTrialToStatus(licenseStatus.trialStatus, licenseStatus.licenseType),
      };

      // TASK-1507F: Track local user ID for renderer callback
      // The renderer needs the LOCAL SQLite user ID (not Supabase UUID) for FK constraints
      let localUserId = user.id; // Default to Supabase UUID as fallback

      if (databaseService.isInitialized()) {
        // Database is ready - create user now
        log.info("[DeepLink] Database initialized, creating local user");
        await syncDeepLinkUserToLocalDb(deepLinkUserData);

        // TASK-1507F: Get the local user ID after creation/sync
        const localUser = await databaseService.getUserByEmail(userEmail);
        if (localUser) {
          localUserId = localUser.id;
          log.info("[DeepLink] Using local user ID:", localUserId);
        } else {
          log.warn("[DeepLink] Local user not found after sync, using Supabase ID");
        }
      } else {
        // Database not ready yet - store for later
        // User will be created after DB initialization in system-handlers.ts
        log.info("[DeepLink] Database not initialized, storing pending user");
        setPendingDeepLinkUser(deepLinkUserData);
        // Note: localUserId remains as Supabase UUID since we can't query local DB yet
        // The renderer will need to handle this case (existing flow before TASK-1507F)
      }

      // TASK-1507: Step 6 - Success! Send all data to renderer
      // TASK-1507F: Use local user ID instead of Supabase UUID for FK constraint compatibility
      log.info("[DeepLink] Auth complete, sending success event for user:", localUserId);
      sendToRenderer("auth:deep-link-callback", {
        accessToken,
        refreshToken,
        userId: localUserId,
        user: {
          id: localUserId,
          email: userEmail,
          name: user.user_metadata?.full_name,
        },
        provider: user.app_metadata?.provider,
        licenseStatus,
        device: deviceResult.device,
      });

      focusMainWindow();
    }
  } catch (error) {
    // Invalid URL format or unexpected error
    log.error("[DeepLink] Failed to handle callback:", error);
    sendToRenderer("auth:deep-link-error", {
      error: "Authentication failed",
      code: "UNKNOWN_ERROR",
    });
  }
}

/**
 * Helper: Send event to renderer process safely
 * @param channel - IPC channel name
 * @param data - Data to send
 */
function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * Helper: Focus the main window (brings app to foreground)
 */
function focusMainWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

// ==========================================
// MACOS DEEP LINK HANDLER (TASK-1500)
// ==========================================
// Handle deep links on macOS via open-url event
// This fires when the app is already running and a deep link is clicked
app.on("open-url", (event, url) => {
  event.preventDefault();
  log.info("[DeepLink] Received URL (macOS):", url);
  handleDeepLinkCallback(url);
});

// ==========================================
// WINDOWS DEEP LINK HANDLER (TASK-1500)
// ==========================================
// Handle deep links on Windows via second-instance event
// On Windows, deep links are passed as command line args to a new instance
// Since we have single-instance lock, the existing instance gets this event
app.on("second-instance", (_event, commandLine) => {
  // Find the deep link URL in command line args
  const url = commandLine.find((arg) => arg.startsWith("magicaudit://"));
  if (url) {
    log.info("[DeepLink] Received URL (Windows):", url);
    handleDeepLinkCallback(url);
  }

  // Focus main window when second instance is attempted
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/**
 * Configure Content Security Policy for the application
 * This prevents the "unsafe-eval" security warning
 *
 * Development vs Production CSP differences:
 * - script-src: Dev uses 'unsafe-inline' for Vite HMR (Hot Module Replacement).
 *   Vite injects inline scripts for HMR updates. Cannot be removed without breaking HMR.
 *   See: https://vitejs.dev/guide/features.html#content-security-policy
 * - style-src: Both use 'unsafe-inline' for CSS-in-JS and dynamic styling.
 * - connect-src: Dev allows localhost:5173 (Vite dev server) + ws:// for HMR websocket.
 *   Production only allows HTTPS connections.
 */
function setupContentSecurityPolicy(): void {
  const isDevelopment =
    process.env.NODE_ENV === "development" || !app.isPackaged;

  // Log CSP mode on startup for debugging
  if (isDevelopment) {
    console.log("[CSP] Development mode - tightened CSP active");
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Configure CSP based on environment
    // Development: Allow localhost dev server and inline styles for HMR
    // Production: Strict CSP without unsafe-eval
    const cspDirectives = isDevelopment
      ? [
          "default-src 'self'",
          // NOTE: 'unsafe-inline' required for Vite HMR - cannot be removed without
          // breaking hot module replacement. Production does not use this directive.
          "script-src 'self' 'unsafe-inline'",
          // NOTE: 'unsafe-inline' required for CSS-in-JS and dynamic styling.
          // This is also needed in production for the same reason.
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          // Tightened: Specific port 5173 instead of wildcard localhost:*
          // Port 5173 is Vite's default dev server port (see vite.config.js and package.json)
          "connect-src 'self' http://localhost:5173 ws://localhost:5173 https:",
          "media-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "worker-src 'self' blob:",
          "upgrade-insecure-requests",
        ]
      : [
          "default-src 'self'",
          "script-src 'self'",
          // NOTE: 'unsafe-inline' required for CSS-in-JS and dynamic styling
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
          "media-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "worker-src 'self' blob:",
        ];

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [cspDirectives.join("; ")],
      },
    });
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: WINDOW_CONFIG.DEFAULT_WIDTH,
    height: WINDOW_CONFIG.DEFAULT_HEIGHT,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: WINDOW_CONFIG.TITLE_BAR_STYLE as
      | "default"
      | "hidden"
      | "hiddenInset"
      | "customButtonsOnHover",
    backgroundColor: WINDOW_CONFIG.BACKGROUND_COLOR,
  });

  // Load the app
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

    // Check for updates after window loads (only in production)
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, UPDATE_CHECK_DELAY);
  }
}

app.whenReady().then(async () => {
  // Configure auto-updater after app is ready
  autoUpdater.logger = log;

  // Auto-updater event handlers
  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info);
    if (mainWindow) {
      mainWindow.webContents.send("update-available", info);
    }
  });

  autoUpdater.on("update-not-available", (info) => {
    log.info("Update not available:", info);
  });

  autoUpdater.on("error", (err) => {
    log.error("Error in auto-updater:", err);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(2)}%`;
    log.info(message);
    if (mainWindow) {
      mainWindow.webContents.send("update-progress", progressObj);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info);
    if (mainWindow) {
      mainWindow.webContents.send("update-downloaded", info);
    }
  });

  // Set up Content Security Policy
  setupContentSecurityPolicy();

  // Database initialization is now ALWAYS deferred to the renderer process
  // This allows us to show an explanation screen (KeychainExplanation) before the keychain prompt
  //
  // The renderer will call 'system:initialize-secure-storage' which handles:
  // 1. Database initialization (triggers keychain prompt)
  // 2. Clearing sessions/tokens for session-only OAuth

  createWindow();

  // ==========================================
  // COLD START DEEP LINK HANDLING (TASK-1500)
  // ==========================================
  // Handle deep link when app is cold started via URL
  // On macOS: URL comes through 'open-url' event, not command line
  // On Windows: URL is in process.argv
  if (process.platform === "win32") {
    const deepLinkUrl = process.argv.find((arg) => arg.startsWith("magicaudit://"));
    if (deepLinkUrl) {
      log.info("[DeepLink] Cold start with URL (Windows):", deepLinkUrl);
      // Wait for window to be ready before processing
      mainWindow?.webContents.once("did-finish-load", () => {
        // Small delay to ensure renderer is fully initialized
        setTimeout(() => handleDeepLinkCallback(deepLinkUrl), 100);
      });
    }
  }
  // On macOS, cold start URLs come through the 'open-url' event which is already registered

  // Register existing handler modules
  registerAuthHandlers(mainWindow!);
  registerTransactionHandlers(mainWindow!);
  registerContactHandlers(mainWindow!);
  registerAddressHandlers();
  registerFeedbackHandlers();
  registerSystemHandlers();
  registerPreferenceHandlers();
  registerDeviceHandlers(mainWindow!);
  registerBackupHandlers(mainWindow!);
  registerSyncHandlers(mainWindow!);
  registerDriverHandlers();

  // Initialize LLM services and register handlers
  const llmConfigService = new LLMConfigService();
  registerLLMHandlers(llmConfigService);

  // Register license handlers
  registerLicenseHandlers();

  // Register extracted handlers from handlers/ directory
  registerPermissionHandlers();
  registerConversationHandlers(mainWindow!);
  registerMessageImportHandlers(mainWindow!);
  registerOutlookHandlers(mainWindow!);
  registerUpdaterHandlers(mainWindow!);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Clean up device detection polling
  cleanupDeviceHandlers();
  // Clean up sync handlers
  cleanupSyncHandlers();
  // Clean up transaction handlers (submission sync)
  cleanupTransactionHandlers();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
