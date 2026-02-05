/**
 * Keychain Gate Service
 *
 * Single gatekeeper that controls ALL access to macOS Keychain / Windows DPAPI.
 * Prevents keychain prompts from appearing before user is ready.
 *
 * RULE: No code should call safeStorage directly. All calls go through this gate.
 *
 * Flow:
 * 1. App starts with gate LOCKED
 * 2. User sees login, terms, phone selection (no keychain needed)
 * 3. User reaches "Secure Storage" step, sees explanation
 * 4. User clicks "Continue" -> renderer calls unlock()
 * 5. Gate UNLOCKED -> keychain prompt appears
 * 6. All subsequent safeStorage calls work normally
 *
 * @module electron/services/keychainGate
 */

import { safeStorage } from "electron";
import logService from "./logService";

class KeychainGateService {
  private _unlocked = false;
  private _platform: NodeJS.Platform;

  constructor() {
    this._platform = process.platform;
  }

  /**
   * Check if the gate is unlocked (keychain access allowed)
   */
  isUnlocked(): boolean {
    return this._unlocked;
  }

  /**
   * Unlock the gate - allows keychain access
   * Should ONLY be called when user explicitly allows it (clicks Continue on secure storage step)
   */
  unlock(): void {
    if (this._unlocked) {
      logService.debug("[KeychainGate] Already unlocked", "KeychainGate");
      return;
    }

    logService.info("[KeychainGate] Unlocking keychain access", "KeychainGate");
    this._unlocked = true;
  }

  /**
   * Lock the gate - blocks keychain access
   * Used for testing or reset scenarios
   */
  lock(): void {
    logService.info("[KeychainGate] Locking keychain access", "KeychainGate");
    this._unlocked = false;
  }

  /**
   * Check if encryption is available (safe to call without keychain prompt)
   * This doesn't actually access the keychain, just checks if the API is available
   */
  isEncryptionAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch (error) {
      logService.error("[KeychainGate] Error checking encryption availability", "KeychainGate", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Encrypt a string using OS keychain
   * @throws Error if gate is locked
   */
  encryptString(plaintext: string): Buffer {
    if (!this._unlocked) {
      const error = new Error("[KeychainGate] Cannot encrypt - keychain access not yet allowed. User must complete secure storage step first.");
      logService.error(error.message, "KeychainGate");
      throw error;
    }

    return safeStorage.encryptString(plaintext);
  }

  /**
   * Decrypt a buffer using OS keychain
   * @throws Error if gate is locked
   */
  decryptString(encrypted: Buffer): string {
    if (!this._unlocked) {
      const error = new Error("[KeychainGate] Cannot decrypt - keychain access not yet allowed. User must complete secure storage step first.");
      logService.error(error.message, "KeychainGate");
      throw error;
    }

    return safeStorage.decryptString(encrypted);
  }

  /**
   * Check if this platform requires user consent before keychain access
   * Windows DPAPI is silent, macOS Keychain prompts user
   */
  requiresUserConsent(): boolean {
    return this._platform === "darwin";
  }

  /**
   * Auto-unlock for platforms that don't need user consent (Windows)
   * Call this during app startup for non-macOS platforms
   */
  autoUnlockIfSilent(): void {
    if (!this.requiresUserConsent()) {
      logService.info("[KeychainGate] Auto-unlocking for silent platform (Windows/Linux)", "KeychainGate");
      this._unlocked = true;
    }
  }
}

// Singleton instance
const keychainGate = new KeychainGateService();
export default keychainGate;
