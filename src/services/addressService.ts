/**
 * Address Service
 *
 * Service abstraction for address lookup and geocoding API calls.
 * Centralizes all window.api.address calls and provides type-safe wrappers.
 */

import { type ApiResult, getErrorMessage } from "./index";

/**
 * Address suggestion from autocomplete
 */
export interface AddressSuggestion {
  description: string;
  placeId: string;
}

/**
 * Full address details
 */
export interface AddressDetails {
  formatted_address?: string;
  street?: string;
  city?: string;
  state?: string;
  state_short?: string;
  zip?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

/**
 * Geocode result
 */
export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * Address Service
 * Provides a clean abstraction over window.api.address
 */
export const addressService = {
  /**
   * Initialize the address service with API key
   */
  async initialize(apiKey: string): Promise<ApiResult> {
    try {
      const result = await window.api.address.initialize(apiKey);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get address suggestions (autocomplete)
   */
  async getSuggestions(
    input: string,
    sessionToken?: string
  ): Promise<ApiResult<AddressSuggestion[]>> {
    try {
      const result = await window.api.address.getSuggestions(input, sessionToken);
      if (result.success) {
        return { success: true, data: result.suggestions || [] };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get full address details from a place ID
   */
  async getDetails(placeId: string): Promise<ApiResult<AddressDetails>> {
    try {
      const result = await window.api.address.getDetails(placeId);
      if (result.success) {
        // Handle both nested and flat response formats
        const address = result.address || {
          formatted_address: result.formatted_address,
          street: result.street,
          city: result.city,
          state: result.state,
          state_short: result.state_short,
          zip: result.zip,
          coordinates: result.coordinates,
        };
        return { success: true, data: address };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Geocode an address string to coordinates
   */
  async geocode(address: string): Promise<ApiResult<GeocodeResult>> {
    try {
      const result = await window.api.address.geocode(address);
      return {
        success: true,
        data: {
          lat: result.lat,
          lng: result.lng,
          formattedAddress: result.formattedAddress,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};

export default addressService;
