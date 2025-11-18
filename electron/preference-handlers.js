// ============================================
// PREFERENCE IPC HANDLERS
// This file contains preference handlers to be added to main.js
// ============================================

const { ipcMain } = require('electron');
const supabaseService = require('./services/supabaseService');

/**
 * Register all preference-related IPC handlers
 */
function registerPreferenceHandlers() {
  // Get user preferences
  ipcMain.handle('preferences:get', async (event, userId) => {
    try {
      console.log('[Preferences] Getting preferences for user:', userId);

      if (!userId) {
        throw new Error('User ID is required');
      }

      const preferences = await supabaseService.getPreferences(userId);

      return {
        success: true,
        preferences: preferences || {}
      };
    } catch (error) {
      console.error('[Preferences] Failed to get preferences:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Save user preferences
  ipcMain.handle('preferences:save', async (event, userId, preferences) => {
    try {
      console.log('[Preferences] Saving preferences for user:', userId);

      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!preferences || typeof preferences !== 'object') {
        throw new Error('Preferences must be an object');
      }

      await supabaseService.syncPreferences(userId, preferences);

      return {
        success: true
      };
    } catch (error) {
      console.error('[Preferences] Failed to save preferences:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Update specific preference (partial update)
  ipcMain.handle('preferences:update', async (event, userId, partialPreferences) => {
    try {
      console.log('[Preferences] Updating preferences for user:', userId);

      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!partialPreferences || typeof partialPreferences !== 'object') {
        throw new Error('Preferences must be an object');
      }

      // Get existing preferences
      const existingPreferences = await supabaseService.getPreferences(userId);

      // Merge with new preferences (deep merge for nested objects)
      const updatedPreferences = deepMerge(existingPreferences, partialPreferences);

      // Save merged preferences
      await supabaseService.syncPreferences(userId, updatedPreferences);

      return {
        success: true,
        preferences: updatedPreferences
      };
    } catch (error) {
      console.error('[Preferences] Failed to update preferences:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  console.log('[Preferences] Handlers registered');
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
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
 * @param {*} item - Item to check
 * @returns {boolean} True if object
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

module.exports = {
  registerPreferenceHandlers
};
