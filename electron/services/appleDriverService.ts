/**
 * Apple Driver Service
 *
 * Detects and installs Apple Mobile Device Support drivers on Windows.
 * These drivers are required for USB communication with iPhones.
 *
 * The drivers are bundled with the app but only installed with user consent.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import log from 'electron-log';

const execAsync = promisify(exec);

/**
 * Status of Apple drivers on the system
 */
export interface AppleDriverStatus {
  /** Whether Apple Mobile Device Support is installed */
  isInstalled: boolean;
  /** Version of installed drivers, if available */
  version: string | null;
  /** Whether the Apple Mobile Device Service is running */
  serviceRunning: boolean;
  /** Error message if check failed */
  error: string | null;
}

/**
 * Result of driver installation attempt
 */
export interface DriverInstallResult {
  success: boolean;
  error: string | null;
  /** Whether a reboot is required */
  rebootRequired: boolean;
}

/**
 * Check if Apple Mobile Device Support drivers are installed
 */
export async function checkAppleDrivers(): Promise<AppleDriverStatus> {
  if (process.platform !== 'win32') {
    return {
      isInstalled: true, // Not needed on non-Windows
      version: null,
      serviceRunning: true,
      error: null,
    };
  }

  try {
    // Check if Apple Mobile Device Support is installed via registry
    const registryCheck = await checkRegistry();

    // Check if the service exists and is running
    const serviceStatus = await checkAppleMobileDeviceService();

    return {
      isInstalled: registryCheck.installed,
      version: registryCheck.version,
      serviceRunning: serviceStatus,
      error: null,
    };
  } catch (error) {
    log.error('[AppleDriverService] Error checking drivers:', error);
    return {
      isInstalled: false,
      version: null,
      serviceRunning: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Windows registry for Apple Mobile Device Support
 */
async function checkRegistry(): Promise<{ installed: boolean; version: string | null }> {
  try {
    // Check 64-bit registry
    const { stdout } = await execAsync(
      'reg query "HKLM\\SOFTWARE\\Apple Inc.\\Apple Mobile Device Support" /v Version',
      { timeout: 5000 }
    );

    const versionMatch = stdout.match(/Version\s+REG_SZ\s+(.+)/);
    if (versionMatch) {
      return {
        installed: true,
        version: versionMatch[1].trim(),
      };
    }
  } catch {
    // Registry key doesn't exist - not installed
  }

  try {
    // Check 32-bit registry (WOW6432Node)
    const { stdout } = await execAsync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Apple Inc.\\Apple Mobile Device Support" /v Version',
      { timeout: 5000 }
    );

    const versionMatch = stdout.match(/Version\s+REG_SZ\s+(.+)/);
    if (versionMatch) {
      return {
        installed: true,
        version: versionMatch[1].trim(),
      };
    }
  } catch {
    // Registry key doesn't exist - not installed
  }

  // Alternative check: look for the service executable
  try {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const servicePath = path.join(
      programFiles,
      'Common Files',
      'Apple',
      'Mobile Device Support',
      'AppleMobileDeviceService.exe'
    );

    if (fs.existsSync(servicePath)) {
      return { installed: true, version: null };
    }
  } catch {
    // File check failed
  }

  return { installed: false, version: null };
}

/**
 * Check if Apple Mobile Device Service is running
 */
async function checkAppleMobileDeviceService(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      'sc query "Apple Mobile Device Service"',
      { timeout: 5000 }
    );

    return stdout.includes('RUNNING');
  } catch {
    return false;
  }
}

/**
 * Get path to bundled Apple driver MSI
 */
export function getBundledDriverPath(): string | null {
  const isDev = !app.isPackaged;

  let basePath: string;
  if (isDev) {
    basePath = path.join(__dirname, '../../resources/win/apple-drivers');
  } else {
    basePath = path.join(process.resourcesPath, 'win/apple-drivers');
  }

  const msiPath = path.join(basePath, 'AppleMobileDeviceSupport64.msi');

  if (fs.existsSync(msiPath)) {
    return msiPath;
  }

  // Try alternative name
  const altPath = path.join(basePath, 'AppleMobileDeviceSupport.msi');
  if (fs.existsSync(altPath)) {
    return altPath;
  }

  log.warn('[AppleDriverService] Bundled driver MSI not found at:', basePath);
  return null;
}

/**
 * Check if bundled drivers are available
 */
export function hasBundledDrivers(): boolean {
  return getBundledDriverPath() !== null;
}

/**
 * Install Apple Mobile Device Support drivers
 * Requires user consent before calling this function
 *
 * @returns Installation result
 */
export async function installAppleDrivers(): Promise<DriverInstallResult> {
  if (process.platform !== 'win32') {
    return {
      success: false,
      error: 'Driver installation only supported on Windows',
      rebootRequired: false,
    };
  }

  const msiPath = getBundledDriverPath();
  if (!msiPath) {
    return {
      success: false,
      error: 'Apple driver package not found. Please install iTunes from the Microsoft Store.',
      rebootRequired: false,
    };
  }

  log.info('[AppleDriverService] Installing Apple drivers from:', msiPath);

  try {
    // Run MSI installer silently
    // /qn = quiet, no UI
    // /norestart = don't restart automatically
    // REBOOT=ReallySuppress = suppress reboot prompts
    const result = await runMsiInstaller(msiPath);

    if (result.success) {
      log.info('[AppleDriverService] Driver installation completed');

      // Start the service if it's not running
      await startAppleMobileDeviceService();
    }

    return result;
  } catch (error) {
    log.error('[AppleDriverService] Installation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Installation failed',
      rebootRequired: false,
    };
  }
}

/**
 * Run MSI installer with elevated privileges
 */
function runMsiInstaller(msiPath: string): Promise<DriverInstallResult> {
  return new Promise((resolve) => {
    // Use msiexec to install silently
    const args = [
      '/i',
      `"${msiPath}"`,
      '/qn',           // Quiet, no UI
      '/norestart',    // Don't restart
      'REBOOT=ReallySuppress',
    ];

    log.info('[AppleDriverService] Running: msiexec', args.join(' '));

    // spawn msiexec - it will trigger UAC prompt
    const installer = spawn('msiexec', args, {
      shell: true,
      // This will trigger UAC if needed
    });

    let stderr = '';

    installer.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    installer.on('close', (code) => {
      log.info('[AppleDriverService] MSI installer exited with code:', code);

      if (code === 0) {
        resolve({
          success: true,
          error: null,
          rebootRequired: false,
        });
      } else if (code === 3010) {
        // 3010 = ERROR_SUCCESS_REBOOT_REQUIRED
        resolve({
          success: true,
          error: null,
          rebootRequired: true,
        });
      } else if (code === 1602) {
        // 1602 = ERROR_INSTALL_USEREXIT (user cancelled UAC or installer)
        resolve({
          success: false,
          error: 'Installation was cancelled',
          rebootRequired: false,
        });
      } else if (code === 1603) {
        // 1603 = ERROR_INSTALL_FAILURE
        resolve({
          success: false,
          error: 'Installation failed. Try running as administrator.',
          rebootRequired: false,
        });
      } else {
        resolve({
          success: false,
          error: `Installation failed with code ${code}. ${stderr}`.trim(),
          rebootRequired: false,
        });
      }
    });

    installer.on('error', (error) => {
      log.error('[AppleDriverService] Failed to start installer:', error);
      resolve({
        success: false,
        error: `Failed to start installer: ${error.message}`,
        rebootRequired: false,
      });
    });
  });
}

/**
 * Start Apple Mobile Device Service
 */
async function startAppleMobileDeviceService(): Promise<void> {
  try {
    await execAsync('net start "Apple Mobile Device Service"', { timeout: 30000 });
    log.info('[AppleDriverService] Apple Mobile Device Service started');
  } catch (error) {
    // Service might already be running or might need a reboot
    log.warn('[AppleDriverService] Could not start service:', error);
  }
}

/**
 * Get iTunes download URL
 */
export function getITunesDownloadUrl(): string {
  // Microsoft Store link - easiest for users
  return 'ms-windows-store://pdp/?ProductId=9PB2MZ1ZMB1S';
}

/**
 * Get iTunes web download URL (fallback)
 */
export function getITunesWebUrl(): string {
  return 'https://www.apple.com/itunes/download/win64';
}
