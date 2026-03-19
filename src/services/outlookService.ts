/**
 * Outlook Service
 *
 * Service abstraction for Outlook-related API calls.
 * Centralizes all window.api.outlook calls and provides type-safe wrappers.
 */

import { getErrorMessage } from "./index";

/**
 * Outlook service - wraps window.api.outlook methods
 */
export const outlookService = {
  /**
   * Initialize the Outlook integration
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!window.api.outlook) {
        return { success: false, error: "Outlook API not available" };
      }
      return await window.api.outlook.initialize();
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Authenticate with Microsoft/Outlook
   */
  async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!window.api.outlook) {
        return { success: false, error: "Outlook API not available" };
      }
      return await window.api.outlook.authenticate();
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Check if currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      if (!window.api.outlook) return false;
      return await window.api.outlook.isAuthenticated();
    } catch {
      return false;
    }
  },

  /**
   * Get the connected user's email address
   */
  async getUserEmail(): Promise<string | null> {
    try {
      if (!window.api.outlook) return null;
      return await window.api.outlook.getUserEmail();
    } catch {
      return null;
    }
  },

  /**
   * Export emails for a given set of criteria
   */
  async exportEmails(
    options: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      if (!window.api.outlook) {
        return { success: false, error: "Outlook API not available" };
      }
      return await window.api.outlook.exportEmails(options);
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Register callback for device code flow (Outlook OAuth)
   */
  onDeviceCode(callback: (code: string, url: string) => void): (() => void) | undefined {
    if (!window.api.outlook) return undefined;
    return window.api.outlook.onDeviceCode(callback);
  },

  /**
   * Register callback for export progress
   */
  onExportProgress(
    callback: (progress: { current: number; total: number; phase?: string }) => void
  ): (() => void) | undefined {
    if (!window.api.outlook) return undefined;
    return window.api.outlook.onExportProgress(callback);
  },
};
