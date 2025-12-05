/**
 * Platform Detection Utility
 *
 * Detects the current operating system and provides feature availability checks.
 * Used to show/hide features based on platform capabilities:
 * - macOS: Can access local Messages.app database directly
 * - Windows: Must sync from iPhone via USB
 * - Linux: Similar to Windows (USB sync)
 */

export type Platform = 'macos' | 'windows' | 'linux';

/**
 * Gets the current platform from Electron's process.platform.
 * Falls back to 'windows' if platform cannot be determined.
 */
export function getPlatform(): Platform {
  // In Electron, we can access process.platform via preload
  const platform = window.electron?.platform || 'unknown';

  switch (platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      console.warn(
        `[Platform] Unknown platform detected: "${platform}". Defaulting to Windows. ` +
        `This may cause unexpected behavior. Please report this issue.`
      );
      return 'windows'; // Default to Windows for safety
  }
}

/**
 * Returns true if running on macOS
 */
export function isMacOS(): boolean {
  return getPlatform() === 'macos';
}

/**
 * Returns true if running on Windows
 */
export function isWindows(): boolean {
  return getPlatform() === 'windows';
}

/**
 * Returns true if running on Linux
 */
export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

/**
 * Feature availability by platform.
 * Maps feature names to the platforms where they are available.
 */
export const platformFeatures = {
  /** Access to local Messages.app database (macOS only) */
  localMessagesAccess: ['macos'],
  /** Access to local Contacts.app database (macOS only) */
  localContactsAccess: ['macos'],
  /** Sync messages from iPhone via USB (Windows/Linux) */
  iPhoneUSBSync: ['windows', 'linux'],
  /** Email integration via OAuth (all platforms) */
  emailIntegration: ['macos', 'windows', 'linux'],
} as const;

export type FeatureName = keyof typeof platformFeatures;

/**
 * Checks if a feature is available on the current platform.
 * @param feature - The feature name to check
 * @returns true if the feature is available on the current platform
 */
export function isFeatureAvailable(feature: FeatureName): boolean {
  const platform = getPlatform();
  return (platformFeatures[feature] as readonly string[]).includes(platform);
}
