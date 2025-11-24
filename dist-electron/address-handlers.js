"use strict";
// ============================================
// ADDRESS VERIFICATION IPC HANDLERS
// This file contains address verification handlers for Google Places API
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAddressHandlers = void 0;
const electron_1 = require("electron");
// Service (still JS - to be migrated)
const addressVerificationService = require('./services/addressVerificationService');
// Import validation utilities
const validation_1 = require("./utils/validation");
/**
 * Register all address verification IPC handlers
 */
const registerAddressHandlers = () => {
    // Initialize address verification service with API key
    electron_1.ipcMain.handle('address:initialize', async (event, apiKey) => {
        try {
            // Validate API key
            const validatedApiKey = (0, validation_1.validateString)(apiKey, 'apiKey', {
                required: false,
                minLength: 20,
                maxLength: 500,
            });
            const initialized = addressVerificationService.initialize(validatedApiKey);
            return {
                success: initialized,
                message: initialized ? 'Address verification initialized' : 'No API key provided',
            };
        }
        catch (error) {
            console.error('[Main] Address initialization failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Get address autocomplete suggestions
    electron_1.ipcMain.handle('address:get-suggestions', async (event, input, sessionToken) => {
        try {
            // Validate input
            const validatedInput = (0, validation_1.validateString)(input, 'input', {
                required: true,
                minLength: 1,
                maxLength: 500,
            });
            // Validate session token (optional)
            const validatedSessionToken = sessionToken
                ? (0, validation_1.validateSessionToken)(sessionToken)
                : null;
            const suggestions = await addressVerificationService.getAddressSuggestions(validatedInput, validatedSessionToken);
            return {
                success: true,
                suggestions,
            };
        }
        catch (error) {
            console.error('[Main] Get address suggestions failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                    suggestions: [],
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                suggestions: [],
            };
        }
    });
    // Get detailed address information
    electron_1.ipcMain.handle('address:get-details', async (event, placeId) => {
        try {
            // Validate place ID
            const validatedPlaceId = (0, validation_1.validateString)(placeId, 'placeId', {
                required: true,
                minLength: 10,
                maxLength: 200,
            });
            const details = await addressVerificationService.getAddressDetails(validatedPlaceId);
            return {
                success: true,
                address: details,
            };
        }
        catch (error) {
            console.error('[Main] Get address details failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Geocode an address
    electron_1.ipcMain.handle('address:geocode', async (event, address) => {
        try {
            // Validate address
            const validatedAddress = (0, validation_1.validateString)(address, 'address', {
                required: true,
                minLength: 5,
                maxLength: 500,
            });
            const result = await addressVerificationService.geocodeAddress(validatedAddress);
            return {
                success: true,
                address: result,
            };
        }
        catch (error) {
            console.error('[Main] Geocode address failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // Validate an address
    electron_1.ipcMain.handle('address:validate', async (event, address) => {
        try {
            // Validate address
            const validatedAddress = (0, validation_1.validateString)(address, 'address', {
                required: true,
                minLength: 5,
                maxLength: 500,
            });
            const isValid = await addressVerificationService.validateAddress(validatedAddress);
            return {
                success: true,
                valid: isValid,
            };
        }
        catch (error) {
            console.error('[Main] Validate address failed:', error);
            if (error instanceof validation_1.ValidationError) {
                return {
                    success: false,
                    error: `Validation error: ${error.message}`,
                };
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
};
exports.registerAddressHandlers = registerAddressHandlers;
