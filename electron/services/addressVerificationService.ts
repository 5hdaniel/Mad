/**
 * Address Verification Service
 * Uses Google Places API to verify and autocomplete property addresses
 */

import axios from 'axios';

/**
 * Address suggestion from autocomplete
 */
export interface AddressSuggestion {
  place_id: string;
  formatted_address: string;
  main_text: string;
  secondary_text: string;
}

/**
 * Coordinates
 */
interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Detailed address information
 */
export interface AddressDetails {
  formatted_address: string;
  street_number?: string;
  route?: string;
  street: string;
  city?: string;
  state?: string;
  state_short?: string;
  zip?: string;
  country?: string;
  coordinates: Coordinates;
  place_id: string;
}

/**
 * Google address component
 */
interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

/**
 * Parsed address components
 */
interface ParsedAddressComponents {
  street_number?: string;
  route?: string;
  locality?: string;
  administrative_area_level_1?: string;
  administrative_area_level_1_short?: string;
  administrative_area_level_2?: string;
  postal_code?: string;
  country?: string;
  country_short?: string;
}

class AddressVerificationService {
  private apiKey: string | null = null;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api';

  /**
   * Initialize with API key from environment or config
   */
  initialize(apiKey?: string): boolean {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || null;

    if (!this.apiKey) {
      console.warn('[AddressVerification] No Google Maps API key configured');
      return false;
    }

    console.log('[AddressVerification] Initialized with API key');
    return true;
  }

  /**
   * Get address autocomplete suggestions
   * @param input - Partial address input
   * @param sessionToken - Session token for billing optimization
   * @returns Array of address suggestions
   */
  async getAddressSuggestions(input: string, sessionToken: string | null = null): Promise<AddressSuggestion[]> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    if (!input || input.length < 3) {
      return [];
    }

    try {
      const url = `${this.baseUrl}/place/autocomplete/json`;
      const params: any = {
        input: input,
        key: this.apiKey,
        types: 'address',
        components: 'country:us', // Restrict to US addresses (change as needed)
      };

      if (sessionToken) {
        params.sessiontoken = sessionToken;
      }

      console.log('[AddressVerification] Fetching suggestions for:', input);

      const response = await axios.get(url, { params });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        console.error('[AddressVerification] API error:', response.data.status, response.data.error_message);
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      // Transform predictions to our format
      const suggestions = (response.data.predictions || []).map((prediction: any) => ({
        place_id: prediction.place_id,
        formatted_address: prediction.description,
        main_text: prediction.structured_formatting?.main_text || '',
        secondary_text: prediction.structured_formatting?.secondary_text || '',
      }));

      console.log(`[AddressVerification] Found ${suggestions.length} suggestions`);

      return suggestions;
    } catch (error) {
      console.error('[AddressVerification] Failed to fetch suggestions:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Get detailed address information for a place ID
   * @param placeId - Google Place ID
   * @returns Detailed address object
   */
  async getAddressDetails(placeId: string): Promise<AddressDetails> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const url = `${this.baseUrl}/place/details/json`;
      const params = {
        place_id: placeId,
        key: this.apiKey,
        fields: 'address_components,formatted_address,geometry',
      };

      console.log('[AddressVerification] Fetching details for place:', placeId);

      const response = await axios.get(url, { params });

      if (response.data.status !== 'OK') {
        console.error('[AddressVerification] API error:', response.data.status);
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      const result = response.data.result;

      // Parse address components
      const addressComponents = this._parseAddressComponents(result.address_components);

      return {
        formatted_address: result.formatted_address,
        street_number: addressComponents.street_number,
        route: addressComponents.route,
        street: `${addressComponents.street_number || ''} ${addressComponents.route || ''}`.trim(),
        city: addressComponents.locality || addressComponents.administrative_area_level_2,
        state: addressComponents.administrative_area_level_1,
        state_short: addressComponents.administrative_area_level_1_short,
        zip: addressComponents.postal_code,
        country: addressComponents.country,
        coordinates: {
          lat: result.geometry?.location?.lat,
          lng: result.geometry?.location?.lng,
        },
        place_id: placeId,
      };
    } catch (error) {
      console.error('[AddressVerification] Failed to fetch address details:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Parse Google address components into usable format
   * @private
   */
  private _parseAddressComponents(components: GoogleAddressComponent[]): ParsedAddressComponents {
    const parsed: ParsedAddressComponents = {};

    components.forEach((component) => {
      const types = component.types;

      if (types.includes('street_number')) {
        parsed.street_number = component.long_name;
      }
      if (types.includes('route')) {
        parsed.route = component.long_name;
      }
      if (types.includes('locality')) {
        parsed.locality = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        parsed.administrative_area_level_1 = component.long_name;
        parsed.administrative_area_level_1_short = component.short_name;
      }
      if (types.includes('administrative_area_level_2')) {
        parsed.administrative_area_level_2 = component.long_name;
      }
      if (types.includes('postal_code')) {
        parsed.postal_code = component.long_name;
      }
      if (types.includes('country')) {
        parsed.country = component.long_name;
        parsed.country_short = component.short_name;
      }
    });

    return parsed;
  }

  /**
   * Geocode an address string to coordinates
   * @param address - Full address string
   * @returns Geocoded address with coordinates
   */
  async geocodeAddress(address: string): Promise<AddressDetails> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const url = `${this.baseUrl}/geocode/json`;
      const params = {
        address: address,
        key: this.apiKey,
      };

      console.log('[AddressVerification] Geocoding address:', address);

      const response = await axios.get(url, { params });

      if (response.data.status !== 'OK') {
        console.error('[AddressVerification] Geocoding error:', response.data.status);
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }

      const result = response.data.results[0];
      const addressComponents = this._parseAddressComponents(result.address_components);

      return {
        formatted_address: result.formatted_address,
        street_number: addressComponents.street_number,
        route: addressComponents.route,
        street: `${addressComponents.street_number || ''} ${addressComponents.route || ''}`.trim(),
        city: addressComponents.locality || addressComponents.administrative_area_level_2,
        state: addressComponents.administrative_area_level_1,
        state_short: addressComponents.administrative_area_level_1_short,
        zip: addressComponents.postal_code,
        country: addressComponents.country,
        coordinates: {
          lat: result.geometry?.location?.lat,
          lng: result.geometry?.location?.lng,
        },
        place_id: result.place_id,
      };
    } catch (error) {
      console.error('[AddressVerification] Geocoding failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Validate if an address exists and is complete
   * @param address - Address string to validate
   * @returns True if address is valid
   */
  async validateAddress(address: string): Promise<boolean> {
    try {
      const result = await this.geocodeAddress(address);
      return !!(result.street && result.city && result.state && result.zip);
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export default new AddressVerificationService();
