"use strict";
// ============================================
// PREFERENCE IPC HANDLERS
// This file contains preference handlers to be added to main.js
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPreferenceHandlers = registerPreferenceHandlers;
const electron_1 = require("electron");
const supabaseService_1 = __importDefault(require("./services/supabaseService"));
// Import validation utilities
const validation_1 = require("./utils/validation");
/**
 * Register all preference-related IPC handlers
 */
function registerPreferenceHandlers() {
    // Get user preferences
    electron_1.ipcMain.handle('preferences:get', async (event, userId) => {
        try {
            console.log('[Preferences] Getting preferences for user:', userId);
            // Validate input
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            const preferences = await supabaseService_1.default.getPreferences(validatedUserId) ?? {};
            return {
                success: true,
                preferences: preferences || {}
            };
        }
        catch (error) {
            console.error('[Preferences] Failed to get preferences:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });
    // Save user preferences
    electron_1.ipcMain.handle('preferences:save', async (event, userId, preferences) => {
        try {
            console.log('[Preferences] Saving preferences for user:', userId);
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            if (!preferences || typeof preferences !== 'object') {
                throw new validation_1.ValidationError('Preferences must be an object', 'preferences');
            }
            // Sanitize preferences to prevent prototype pollution
            const sanitizedPreferences = (0, validation_1.sanitizeObject)(preferences);
            await supabaseService_1.default.syncPreferences(validatedUserId, sanitizedPreferences);
            return {
                success: true
            };
        }
        catch (error) {
            console.error('[Preferences] Failed to save preferences:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });
    // Update specific preference (partial update)
    electron_1.ipcMain.handle('preferences:update', async (event, userId, partialPreferences) => {
        try {
            console.log('[Preferences] Updating preferences for user:', userId);
            // Validate inputs
            const validatedUserId = (0, validation_1.validateUserId)(userId);
            if (!partialPreferences || typeof partialPreferences !== 'object') {
                throw new validation_1.ValidationError('Preferences must be an object', 'partialPreferences');
            }
            // Sanitize preferences to prevent prototype pollution
            const sanitizedPartialPreferences = (0, validation_1.sanitizeObject)(partialPreferences);
            // Get existing preferences
            const existingPreferences = await supabaseService_1.default.getPreferences(validatedUserId) ?? {};
            // Merge with new preferences (deep merge for nested objects)
            const updatedPreferences = deepMerge(existingPreferences, sanitizedPartialPreferences);
            // Save merged preferences
            await supabaseService_1.default.syncPreferences(validatedUserId, updatedPreferences);
            return {
                success: true,
                preferences: updatedPreferences
            };
        }
        catch (error) {
            console.error('[Preferences] Failed to update preferences:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });
    console.log('[Preferences] Handlers registered');
}
/**
 * Deep merge two objects
 * @param target - Target object
 * @param source - Source object
 * @returns Merged object
 */
function deepMerge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    output[key] = source[key];
                }
                else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            }
            else {
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
function isObject(item) {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
}
