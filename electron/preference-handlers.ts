// ============================================
// PREFERENCE IPC HANDLERS
// This file contains preference handlers to be added to main.js
// ============================================

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import supabaseService from './services/supabaseService';

// Import validation utilities
import {
  ValidationError,
  validateUserId,
  sanitizeObject,
} from './utils/validation';

// Import logging service
import logService from './services/logService';

// Type definitions
interface PreferenceResponse {
  success: boolean;
  error?: string;
  preferences?: Record<string, unknown>;
}

/**
 * Register all preference-related IPC handlers
 */
export function registerPreferenceHandlers(): void {
  // Get user preferences
  ipcMain.handle('preferences:get', async (event: IpcMainInvokeEvent, userId: string): Promise<PreferenceResponse> => {
    try {
      logService.debug('Getting preferences for user', 'Preferences', { userId });

      // Validate input
      const validatedUserId = validateUserId(userId)!;

      const preferences = await supabaseService.getPreferences(validatedUserId) ?? {};

      return {
        success: true,
        preferences: preferences || {}
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to get preferences', 'Preferences', { userId, error: errorMessage });
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`
        };
      }
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  // Save user preferences
  ipcMain.handle('preferences:save', async (event: IpcMainInvokeEvent, userId: string, preferences: unknown): Promise<PreferenceResponse> => {
    try {
      logService.debug('Saving preferences for user', 'Preferences', { userId });

      // Validate inputs
      const validatedUserId = validateUserId(userId)!;

      if (!preferences || typeof preferences !== 'object') {
        throw new ValidationError('Preferences must be an object', 'preferences');
      }

      // Sanitize preferences to prevent prototype pollution
      const sanitizedPreferences = sanitizeObject(preferences) as Record<string, any>;

      await supabaseService.syncPreferences(validatedUserId, sanitizedPreferences);

      logService.info('Preferences saved successfully', 'Preferences', { userId });
      return {
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to save preferences', 'Preferences', { userId, error: errorMessage });
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`
        };
      }
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  // Update specific preference (partial update)
  ipcMain.handle('preferences:update', async (event: IpcMainInvokeEvent, userId: string, partialPreferences: unknown): Promise<PreferenceResponse> => {
    try {
      logService.debug('Updating preferences for user', 'Preferences', { userId });

      // Validate inputs
      const validatedUserId = validateUserId(userId)!;

      if (!partialPreferences || typeof partialPreferences !== 'object') {
        throw new ValidationError('Preferences must be an object', 'partialPreferences');
      }

      // Sanitize preferences to prevent prototype pollution
      const sanitizedPartialPreferences = sanitizeObject(partialPreferences);

      // Get existing preferences
      const existingPreferences = await supabaseService.getPreferences(validatedUserId) ?? {};

      // Merge with new preferences (deep merge for nested objects)
      const updatedPreferences = deepMerge(existingPreferences, sanitizedPartialPreferences);

      // Save merged preferences
      await supabaseService.syncPreferences(validatedUserId, updatedPreferences);

      logService.info('Preferences updated successfully', 'Preferences', { userId });
      return {
        success: true,
        preferences: updatedPreferences
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logService.error('Failed to update preferences', 'Preferences', { userId, error: errorMessage });
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`
        };
      }
      return {
        success: false,
        error: errorMessage
      };
    }
  });

  logService.info('Preference handlers registered', 'Preferences');
}

/**
 * Deep merge two objects
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
function deepMerge(target: unknown, source: unknown): Record<string, unknown> {
  const output = { ...target as Record<string, unknown> };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in (target as Record<string, unknown>))) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge((target as Record<string, unknown>)[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }

  return output;
}

/**
 * Check if value is an object
 * @param item - Item to check
 * @returns True if object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}
