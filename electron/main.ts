import {
  app,
  BrowserWindow,
  session,
} from "electron";
import path from "path";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
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
