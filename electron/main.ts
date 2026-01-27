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

// Load environment files: .env.development first (OAuth credentials), then .env.local for overrides
dotenv.config({ path: path.join(__dirname, "../.env.development") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });

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
      const accessToken = parsed.searchParams.get("access_token");
      const refreshToken = parsed.searchParams.get("refresh_token");

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

      // TASK-1507: Step 6 - Success! Send all data to renderer
      log.info("[DeepLink] Auth complete, sending success event for user:", user.id);
      sendToRenderer("auth:deep-link-callback", {
        accessToken,
        refreshToken,
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name,
        },
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
