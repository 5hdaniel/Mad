import {
  app,
  BrowserWindow,
  session,
} from "electron";
import path from "path";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Import constants
import {
  WINDOW_CONFIG,
  DEV_SERVER_URL,
  UPDATE_CHECK_DELAY,
} from "./constants";

// Import handler registration functions
import { registerAuthHandlers } from "./auth-handlers";
import { registerTransactionHandlers } from "./transaction-handlers";
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
import { LLMConfigService } from "./services/llm/llmConfigService";

// Import extracted handlers from handlers/ directory
import {
  registerPermissionHandlers,
  registerConversationHandlers,
  registerOutlookHandlers,
  registerUpdaterHandlers,
} from "./handlers";

// Configure logging for auto-updater
log.transports.file.level = "info";

let mainWindow: BrowserWindow | null = null;

/**
 * Configure Content Security Policy for the application
 * This prevents the "unsafe-eval" security warning
 */
function setupContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDevelopment =
      process.env.NODE_ENV === "development" || !app.isPackaged;

    // Configure CSP based on environment
    // Development: Allow localhost dev server and inline styles for HMR
    // Production: Strict CSP without unsafe-eval
    const cspDirectives = isDevelopment
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' http://localhost:* ws://localhost:* https:",
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
      // Disable sandbox to allow preload script to use Node.js APIs
      // Required for Electron 20+ where sandbox is enabled by default
      sandbox: false,
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
  registerContactHandlers();
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

  // Register extracted handlers from handlers/ directory
  registerPermissionHandlers();
  registerConversationHandlers(mainWindow!);
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
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
