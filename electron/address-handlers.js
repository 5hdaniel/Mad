// ============================================
// ADDRESS VERIFICATION IPC HANDLERS
// This file contains address verification handlers for Google Places API
// ============================================

const { ipcMain } = require('electron');
const addressVerificationService = require('./services/addressVerificationService');

/**
 * Register all address verification IPC handlers
 */
const registerAddressHandlers = () => {
  // Initialize address verification service with API key
  ipcMain.handle('address:initialize', async (event, apiKey) => {
    try {
      const initialized = addressVerificationService.initialize(apiKey);

      return {
        success: initialized,
        message: initialized ? 'Address verification initialized' : 'No API key provided',
      };
    } catch (error) {
      console.error('[Main] Address initialization failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Get address autocomplete suggestions
  ipcMain.handle('address:get-suggestions', async (event, input, sessionToken) => {
    try {
      const suggestions = await addressVerificationService.getAddressSuggestions(input, sessionToken);

      return {
        success: true,
        suggestions,
      };
    } catch (error) {
      console.error('[Main] Get address suggestions failed:', error);
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
      const details = await addressVerificationService.getAddressDetails(placeId);

      return {
        success: true,
        address: details,
      };
    } catch (error) {
      console.error('[Main] Get address details failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Geocode an address
  ipcMain.handle('address:geocode', async (event, address) => {
    try {
      const result = await addressVerificationService.geocodeAddress(address);

      return {
        success: true,
        address: result,
      };
    } catch (error) {
      console.error('[Main] Geocode address failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Validate an address
  ipcMain.handle('address:validate', async (event, address) => {
    try {
      const isValid = await addressVerificationService.validateAddress(address);

      return {
        success: true,
        valid: isValid,
      };
    } catch (error) {
      console.error('[Main] Validate address failed:', error);
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
