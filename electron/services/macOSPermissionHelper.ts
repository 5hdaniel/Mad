import { app, shell, Notification } from "electron";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

/**
 * Execute AppleScript safely by passing the script via stdin to osascript.
 * This avoids shell command injection risks from string interpolation.
 *
 * @param script - The AppleScript code to execute
 * @returns Promise that resolves when script completes successfully
 * @throws Error if osascript exits with non-zero code or encounters an error
 */
export function runAppleScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Use osascript with '-' to read script from stdin
    const proc = spawn("osascript", ["-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (error: Error) => {
      reject(new Error(`Failed to spawn osascript: ${error.message}`));
    });

    proc.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `osascript exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
      }
    });

    // Write script to stdin and close
    proc.stdin.write(script);
    proc.stdin.end();
  });
}

/**
 * macOS Permission Helper
 * Handles permission requests and system preferences navigation
 */

interface PermissionResult {
  success: boolean;
  message?: string;
  error?: string;
}

interface FullDiskAccessResult {
  success: boolean;
  message: string;
  appPath: string;
  nextStep: string;
  error?: string;
}

interface PrivacyPaneResult {
  success: boolean;
  error?: string;
}

interface FullDiskAccessStatus {
  granted: boolean;
  message: string;
  error?: string;
}

interface PermissionSetupFlowResult {
  contacts: PermissionResult | null;
  fullDiskAccess: FullDiskAccessResult | null;
  overallSuccess: boolean;
  error?: string;
}

class MacOSPermissionHelper {
  /**
   * Request Contacts permission (standard macOS API)
   * This shows the native macOS permission dialog
   */
  async requestContactsPermission(): Promise<PermissionResult> {
    try {
      // Alternative: Use AppleScript to trigger Contacts access
      const appleScript = `
        tell application "Contacts"
          activate
          delay 0.5
          quit
        end tell
      `;

      await runAppleScript(appleScript);

      return {
        success: true,
        message: "Contacts permission requested",
      };
    } catch (error) {
      console.error("[MacOS] Failed to request Contacts permission:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Add app to Full Disk Access list and open System Preferences
   *
   * Note: macOS doesn't allow programmatically enabling Full Disk Access,
   * but we can open System Preferences to the correct location and
   * optionally add the app to the list (requires user approval)
   */
  async setupFullDiskAccess(): Promise<FullDiskAccessResult> {
    try {
      const appPath = app.getPath("exe");
      const bundleId = "com.realestate.archiveapp";

      // Method 1: Open System Preferences to Privacy > Full Disk Access
      // This uses the x-apple.systempreferences URL scheme
      const privacyURL =
        "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";

      console.log("[MacOS] Opening System Preferences to Full Disk Access...");
      await shell.openExternal(privacyURL);

      // Give System Preferences time to open
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Method 2: Try to programmatically add app to the list
      // This requires admin privileges and may prompt the user
      try {
        // This is informational - actual addition requires user interaction
        console.log("[MacOS] App path:", appPath);
        console.log("[MacOS] Bundle ID:", bundleId);
      } catch {
        console.log(
          "[MacOS] Could not programmatically add app (expected - requires user action)",
        );
      }

      return {
        success: true,
        message: "System Preferences opened to Full Disk Access",
        appPath,
        nextStep:
          "User needs to click the + button and add the app, or toggle it on if already present",
      };
    } catch (error) {
      console.error("[MacOS] Failed to setup Full Disk Access:", error);
      return {
        success: false,
        message: "Failed to setup Full Disk Access",
        appPath: "",
        nextStep: "",
        error: (error as Error).message,
      };
    }
  }

  /**
   * Open System Preferences to specific Privacy pane
   * @param {string} pane - Privacy pane identifier
   */
  async openPrivacyPane(
    pane: string = "Privacy_AllFiles",
  ): Promise<PrivacyPaneResult> {
    const privacyPanes: Record<string, string> = {
      fullDiskAccess: "Privacy_AllFiles",
      contacts: "Privacy_Contacts",
      calendar: "Privacy_Calendars",
      accessibility: "Privacy_Accessibility",
    };

    const paneId = privacyPanes[pane] || pane;
    const url = `x-apple.systempreferences:com.apple.preference.security?${paneId}`;

    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("[MacOS] Failed to open privacy pane:", error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Check if app is already in Full Disk Access list
   * Note: Can't reliably check this programmatically, but we can test by trying to access protected files
   */
  async checkFullDiskAccessStatus(): Promise<FullDiskAccessStatus> {
    const messagesDbPath = path.join(
      process.env.HOME!,
      "Library/Messages/chat.db",
    );

    try {
      await fs.access(messagesDbPath, fs.constants.R_OK);
      return {
        granted: true,
        message: "Full Disk Access is enabled",
      };
    } catch (error) {
      return {
        granted: false,
        message: "Full Disk Access is not enabled",
        error: (error as NodeJS.ErrnoException).code,
      };
    }
  }

  /**
   * Show system notification about permissions
   */
  async showPermissionNotification(title: string, body: string): Promise<void> {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
      });

      notification.show();
    }
  }

  /**
   * Complete permission setup flow
   * Returns status of each step
   */
  async runPermissionSetupFlow(): Promise<PermissionSetupFlowResult> {
    console.log("[MacOS] Starting permission setup flow...");

    const results: PermissionSetupFlowResult = {
      contacts: null,
      fullDiskAccess: null,
      overallSuccess: false,
    };

    try {
      // Step 1: Request Contacts permission
      console.log("[MacOS] Step 1: Requesting Contacts permission...");
      results.contacts = await this.requestContactsPermission();

      // Wait a moment for user to interact with Contacts dialog
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 2: Setup Full Disk Access
      console.log("[MacOS] Step 2: Setting up Full Disk Access...");
      results.fullDiskAccess = await this.setupFullDiskAccess();

      // Step 3: Show notification
      await this.showPermissionNotification(
        "Permission Setup",
        "Please enable Full Disk Access in System Preferences to continue",
      );

      results.overallSuccess =
        results.contacts.success && results.fullDiskAccess.success;

      return results;
    } catch (error) {
      console.error("[MacOS] Permission setup flow failed:", error);
      return {
        ...results,
        error: (error as Error).message,
        overallSuccess: false,
      };
    }
  }
}

export default new MacOSPermissionHelper();
