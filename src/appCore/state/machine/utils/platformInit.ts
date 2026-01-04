/**
 * Platform Initialization Utilities
 *
 * Utilities for detecting platform and determining platform-specific
 * initialization behavior (macOS Keychain vs Windows DPAPI).
 *
 * @module appCore/state/machine/utils/platformInit
 */

import type { PlatformInfo } from "../types";

/**
 * Detect platform from navigator.
 * Uses both platform and userAgent for robustness.
 *
 * Note: This runs early in initialization before React contexts are available,
 * so it uses raw window.navigator instead of usePlatform() hook.
 */
export function detectPlatform(): Omit<PlatformInfo, "hasIPhone"> {
  const platform = window.navigator.platform || "";
  const userAgent = window.navigator.userAgent || "";

  return {
    isMacOS: platform.includes("Mac") || userAgent.includes("Macintosh"),
    isWindows: platform.includes("Win") || userAgent.includes("Windows"),
  };
}

/**
 * Determine if platform needs explicit keychain setup explanation.
 *
 * macOS uses Keychain which may prompt for access on first run.
 * Users benefit from knowing this before seeing the system prompt.
 *
 * Windows uses DPAPI which is silent (no user interaction needed).
 */
export function needsKeychainPrompt(platform: {
  isMacOS: boolean;
  isWindows: boolean;
}): boolean {
  return platform.isMacOS;
}

/**
 * Determine if platform auto-initializes storage without user interaction.
 *
 * Windows DPAPI doesn't require user interaction - storage can be
 * initialized immediately and silently.
 *
 * macOS Keychain may show system prompts, so initialization should
 * be triggered by user action (clicking Continue) rather than automatically.
 */
export function autoInitializesStorage(platform: {
  isMacOS: boolean;
  isWindows: boolean;
}): boolean {
  return platform.isWindows;
}

/**
 * Get platform-specific loading message for the initializing-db phase.
 *
 * macOS: Explains that Keychain access is being requested
 * Windows: Standard database initialization message
 */
export function getDbInitMessage(platform: {
  isMacOS: boolean;
  isWindows: boolean;
}): string {
  if (platform.isMacOS) {
    return "Waiting for Keychain access...";
  }
  return "Initializing secure database...";
}
