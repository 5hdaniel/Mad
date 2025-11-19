// ============================================
// ADDRESS VERIFICATION IPC HANDLERS
// This file contains address verification handlers for Google Places API
// ============================================

const { ipcMain } = require('electron');
const addressVerificationService = require('./services/addressVerificationService');

// Import validation utilities
const {
  ValidationError,
  validateString,
  validateSessionToken,
} = require('./utils/validation');

/**
 * Register all address verification IPC handlers
 */
const registerAddressHandlers = () => {
  // Initialize address verification service with API key
  ipcMain.handle('address:initialize', async (event, apiKey) => {
    try {
      // Validate API key
      const validatedApiKey = validateString(apiKey, 'apiKey', {
        required: false,
        minLength: 20,
        maxLength: 500,
      });

      const initialized = addressVerificationService.initialize(validatedApiKey);

      return {
        success: initialized,
        message: initialized ? 'Address verification initialized' : 'No API key provided',
      };
    } catch (error) {
      console.error('[Main] Address initialization failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Get address autocomplete suggestions
  ipcMain.handle('address:get-suggestions', async (event, input, sessionToken) => {
    try {
      // Validate input
      const validatedInput = validateString(input, 'input', {
        required: true,
        minLength: 1,
        maxLength: 500,
      });

      // Validate session token (optional)
      const validatedSessionToken = sessionToken
        ? validateSessionToken(sessionToken)
        : null;

      const suggestions = await addressVerificationService.getAddressSuggestions(
        validatedInput,
        validatedSessionToken
      );

      return {
        success: true,
        suggestions,
      };
    } catch (error) {
      console.error('[Main] Get address suggestions failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
          suggestions: [],
        };
      }
      return {
        success: false,
        error: error.message,
        suggestions: [],
      };
    }
  });

  // Get detailed address information
  ipcMain.handle('address:get-details', async (event, placeId) => {
    try {
      // Validate place ID
      const validatedPlaceId = validateString(placeId, 'placeId', {
        required: true,
        minLength: 10,
        maxLength: 200,
      });

      const details = await addressVerificationService.getAddressDetails(validatedPlaceId);

      return {
        success: true,
        address: details,
      };
    } catch (error) {
      console.error('[Main] Get address details failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Geocode an address
  ipcMain.handle('address:geocode', async (event, address) => {
    try {
      // Validate address
      const validatedAddress = validateString(address, 'address', {
        required: true,
        minLength: 5,
        maxLength: 500,
      });

      const result = await addressVerificationService.geocodeAddress(validatedAddress);

      return {
        success: true,
        address: result,
      };
    } catch (error) {
      console.error('[Main] Geocode address failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Validate an address
  ipcMain.handle('address:validate', async (event, address) => {
    try {
      // Validate address
      const validatedAddress = validateString(address, 'address', {
        required: true,
        minLength: 5,
        maxLength: 500,
      });

      const isValid = await addressVerificationService.validateAddress(validatedAddress);

      return {
        success: true,
        valid: isValid,
      };
    } catch (error) {
      console.error('[Main] Validate address failed:', error);
      if (error instanceof ValidationError) {
        return {
          success: false,
          error: `Validation error: ${error.message}`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
  });
};

module.exports = {
  registerAddressHandlers,
};
