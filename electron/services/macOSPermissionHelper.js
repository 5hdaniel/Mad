const { app, shell } = require('electron');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');

/**
 * macOS Permission Helper
 * Handles permission requests and system preferences navigation
 */

class MacOSPermissionHelper {
  /**
   * Request Contacts permission (standard macOS API)
   * This shows the native macOS permission dialog
   */
  async requestContactsPermission() {
    try {
      // Use Contacts framework to trigger permission request
      const script = `
        const Contacts = require('@napi-rs/apple-contacts');
        await Contacts.requestAccess();
      `;

      // Alternative: Use AppleScript to trigger Contacts access
      const appleScript = `
        tell application "Contacts"
          activate
          delay 0.5
          quit
        end tell
      `;

      await execAsync(`osascript -e '${appleScript}'`);

      return {
        success: true,
        message: 'Contacts permission requested',
      };
    } catch (error) {
      console.error('[MacOS] Failed to request Contacts permission:', error);
      return {
        success: false,
        error: error.message,
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
  async setupFullDiskAccess() {
    try {
      const appPath = app.getPath('exe');
      const bundleId = 'com.realestate.archiveapp';

      // Method 1: Open System Preferences to Privacy > Full Disk Access
      // This uses the x-apple.systempreferences URL scheme
      const privacyURL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles';

      console.log('[MacOS] Opening System Preferences to Full Disk Access...');
      await shell.openExternal(privacyURL);

      // Give System Preferences time to open
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Method 2: Try to programmatically add app to the list
      // This requires admin privileges and may prompt the user
      try {
        // Use tccutil to add app (requires admin)
        // Note: This may not work on all macOS versions
        const addToListScript = `
          tell application "System Events"
            tell process "System Preferences"
              click button "Click the lock to make changes." of window "Security & Privacy"
            end tell
          end tell
        `;

        // This is informational - actual addition requires user interaction
        console.log('[MacOS] App path:', appPath);
        console.log('[MacOS] Bundle ID:', bundleId);
      } catch (adminError) {
        console.log('[MacOS] Could not programmatically add app (expected - requires user action)');
      }

      return {
        success: true,
        message: 'System Preferences opened to Full Disk Access',
        appPath,
        nextStep: 'User needs to click the + button and add the app, or toggle it on if already present',
      };
    } catch (error) {
      console.error('[MacOS] Failed to setup Full Disk Access:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Open System Preferences to specific Privacy pane
   * @param {string} pane - Privacy pane identifier
   */
  async openPrivacyPane(pane = 'Privacy_AllFiles') {
    const privacyPanes = {
      fullDiskAccess: 'Privacy_AllFiles',
      contacts: 'Privacy_Contacts',
      calendar: 'Privacy_Calendars',
      accessibility: 'Privacy_Accessibility',
    };

    const paneId = privacyPanes[pane] || pane;
    const url = `x-apple.systempreferences:com.apple.preference.security?${paneId}`;

    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('[MacOS] Failed to open privacy pane:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if app is already in Full Disk Access list
   * Note: Can't reliably check this programmatically, but we can test by trying to access protected files
   */
  async checkFullDiskAccessStatus() {
    const fs = require('fs').promises;
    const messagesDbPath = path.join(process.env.HOME, 'Library/Messages/chat.db');

    try {
      await fs.access(messagesDbPath, fs.constants.R_OK);
      return {
        granted: true,
        message: 'Full Disk Access is enabled',
      };
    } catch (error) {
      return {
        granted: false,
        message: 'Full Disk Access is not enabled',
        error: error.code,
      };
    }
  }

  /**
   * Show system notification about permissions
   */
  async showPermissionNotification(title, body) {
    const { Notification } = require('electron');

    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        sound: true,
      });

      notification.show();
    }
  }

  /**
   * Complete permission setup flow
   * Returns status of each step
   */
  async runPermissionSetupFlow() {
    console.log('[MacOS] Starting permission setup flow...');

    const results = {
      contacts: null,
      fullDiskAccess: null,
      overallSuccess: false,
    };

    try {
      // Step 1: Request Contacts permission
      console.log('[MacOS] Step 1: Requesting Contacts permission...');
      results.contacts = await this.requestContactsPermission();

      // Wait a moment for user to interact with Contacts dialog
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 2: Setup Full Disk Access
      console.log('[MacOS] Step 2: Setting up Full Disk Access...');
      results.fullDiskAccess = await this.setupFullDiskAccess();

      // Step 3: Show notification
      await this.showPermissionNotification(
        'Permission Setup',
        'Please enable Full Disk Access in System Preferences to continue'
      );

      results.overallSuccess = results.contacts.success && results.fullDiskAccess.success;

      return results;
    } catch (error) {
      console.error('[MacOS] Permission setup flow failed:', error);
      return {
        ...results,
        error: error.message,
        overallSuccess: false,
      };
    }
  }
}

module.exports = new MacOSPermissionHelper();
