/**
 * Supabase Edge Function: Validate Address
 *
 * Securely calls Google Maps Geocoding API to validate and parse addresses
 * Enforces Washington state restriction
 * Tracks API usage and enforces rate limits
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    // Parse request
    const { address, userId } = await req.json();

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);

    // Check user's subscription and API limits (if userId provided)
    if (userId) {
      // Get start of current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Count API usage this month
      const { count } = await supabase
        .from('api_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('api_name', 'google_maps')
        .gte('created_at', startOfMonth.toISOString());

      // Get user's subscription tier
      const { data: user } = await supabase
        .from('users')
        .select('subscription_tier, subscription_status')
        .eq('id', userId)
        .single();

      // Define limits per tier
      const limits = {
        free: 10,
        pro: 100,
        enterprise: 1000,
      };

      const limit = limits[user?.subscription_tier || 'free'];

      // Check if limit exceeded
      if (count && count >= limit) {
        return new Response(
          JSON.stringify({
            error: 'Monthly address validation limit reached',
            limit,
            current: count,
            tier: user?.subscription_tier || 'free',
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Call Google Maps Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${GOOGLE_MAPS_API_KEY}`;

    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    // Check API response status
    if (geocodeData.status !== 'OK') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: geocodeData.status,
          message: geocodeData.error_message || 'Address not found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = geocodeData.results[0];

    // Extract address components
    const components: any = {
      street_number: '',
      street_name: '',
      city: '',
      county: '',
      state: '',
      zip: '',
      country: '',
    };

    result.address_components.forEach((component: any) => {
      if (component.types.includes('street_number')) {
        components.street_number = component.long_name;
      }
      if (component.types.includes('route')) {
        components.street_name = component.long_name;
      }
      if (component.types.includes('locality')) {
        components.city = component.long_name;
      }
      if (component.types.includes('administrative_area_level_2')) {
        components.county = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        components.state = component.short_name;
      }
      if (component.types.includes('postal_code')) {
        components.zip = component.long_name;
      }
      if (component.types.includes('country')) {
        components.country = component.short_name;
      }
    });

    // Validate Washington state only
    if (components.state !== 'WA') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'OUT_OF_STATE',
          message: 'Only Washington state properties are supported',
          address: components,
          formatted: result.formatted_address,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build full street address
    const streetAddress = components.street_number
      ? `${components.street_number} ${components.street_name}`
      : components.street_name;

    // Track API usage
    if (userId) {
      await supabase.from('api_usage').insert({
        user_id: userId,
        api_name: 'google_maps',
        endpoint: 'geocode',
        estimated_cost: 0.005, // $5 per 1000 requests
        request_data: { address },
        response_status: 200,
      });
    }

    // Return validated address
    return new Response(
      JSON.stringify({
        valid: true,
        formatted: result.formatted_address,
        components: {
          street: streetAddress,
          city: components.city,
          county: components.county,
          state: components.state,
          zip: components.zip,
          country: components.country,
        },
        coordinates: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        },
        placeId: result.place_id,
        locationType: result.geometry.location_type,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
