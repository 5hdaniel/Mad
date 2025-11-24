"use strict";
/**
 * Supabase Service
 * Handles all cloud database operations and sync
 * Currently uses service_role key for development
 * TODO: Refactor to use Supabase Auth for production
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '.env.development' });
class SupabaseService {
    constructor() {
        this.client = null;
        this.initialized = false;
    }
    /**
     * Initialize Supabase client
     */
    initialize() {
        if (this.initialized) {
            return;
        }
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Using service_role for now
        if (!supabaseUrl || !supabaseKey) {
            console.error('[Supabase] Missing credentials. Check .env.development file.');
            throw new Error('Supabase credentials not configured');
        }
        console.log('[Supabase] Initializing with URL:', supabaseUrl);
        this.client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
        this.initialized = true;
        console.log('[Supabase] Initialized successfully');
    }
    /**
     * Ensure client is initialized and return it
     * @private
     * @throws {Error} If client cannot be initialized
     */
    _ensureClient() {
        if (!this.initialized || !this.client) {
            this.initialize();
        }
        if (!this.client) {
            throw new Error('Supabase client is not initialized');
        }
        return this.client;
    }
    // ============================================
    // USER OPERATIONS
    // ============================================
    /**
     * Sync user to cloud (create or update)
     * @param userData - User data to sync
     * @returns Synced user data
     */
    async syncUser(userData) {
        const client = this._ensureClient();
        try {
            // Check if user exists
            const { data: existingUser, error: fetchError } = await client
                .from('users')
                .select('*')
                .eq('oauth_provider', userData.oauth_provider)
                .eq('oauth_id', userData.oauth_id)
                .single();
            if (fetchError && fetchError.code !== 'PGRST116') {
                // PGRST116 = not found, which is OK
                throw fetchError;
            }
            let result;
            if (existingUser) {
                // Update existing user
                const { data, error } = await client
                    .from('users')
                    .update({
                    email: userData.email,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    display_name: userData.display_name,
                    avatar_url: userData.avatar_url,
                    last_login_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                    .eq('id', existingUser.id)
                    .select()
                    .single();
                if (error)
                    throw error;
                // Increment login count
                await client.rpc('increment', {
                    row_id: existingUser.id,
                    x: 1,
                    table_name: 'users',
                    column_name: 'login_count',
                });
                result = data;
                console.log('[Supabase] User updated:', result.id);
            }
            else {
                // Create new user
                const { data, error } = await client
                    .from('users')
                    .insert({
                    email: userData.email,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    display_name: userData.display_name,
                    avatar_url: userData.avatar_url,
                    oauth_provider: userData.oauth_provider,
                    oauth_id: userData.oauth_id,
                    subscription_tier: userData.subscription_tier || 'free',
                    subscription_status: 'trial',
                    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
                    login_count: 1,
                    last_login_at: new Date().toISOString(),
                    signup_source: 'desktop_app',
                })
                    .select()
                    .single();
                if (error)
                    throw error;
                result = data;
                console.log('[Supabase] New user created:', result.id);
            }
            return result;
        }
        catch (error) {
            console.error('[Supabase] Failed to sync user:', error);
            throw error;
        }
    }
    /**
     * Get user by ID
     * @param userId - User UUID
     * @returns User data
     */
    async getUserById(userId) {
        const client = this._ensureClient();
        try {
            const { data, error } = await client
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            console.error('[Supabase] Failed to get user:', error);
            throw error;
        }
    }
    /**
     * Sync terms acceptance to cloud
     * @param userId - User UUID
     * @param termsVersion - Version of Terms of Service accepted
     * @param privacyVersion - Version of Privacy Policy accepted
     */
    async syncTermsAcceptance(userId, termsVersion, privacyVersion) {
        const client = this._ensureClient();
        try {
            const { data, error } = await client
                .from('users')
                .update({
                terms_accepted_at: new Date().toISOString(),
                terms_version_accepted: termsVersion,
                privacy_policy_accepted_at: new Date().toISOString(),
                privacy_policy_version_accepted: privacyVersion,
                updated_at: new Date().toISOString(),
            })
                .eq('id', userId)
                .select()
                .single();
            if (error)
                throw error;
            console.log('[Supabase] Terms acceptance synced for user:', userId);
            return data;
        }
        catch (error) {
            console.error('[Supabase] Failed to sync terms acceptance:', error);
            throw error;
        }
    }
    /**
     * Validate user's subscription status
     * @param userId - User UUID
     * @returns Subscription status
     */
    async validateSubscription(userId) {
        const client = this._ensureClient();
        try {
            const user = await this.getUserById(userId);
            const now = new Date();
            const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
            const subscription = {
                tier: user.subscription_tier,
                status: user.subscription_status,
                isActive: user.subscription_status === 'active',
                isTrial: user.subscription_status === 'trial',
                trialEnded: trialEndsAt ? trialEndsAt < now : false,
                trialDaysRemaining: trialEndsAt
                    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                    : 0,
            };
            // If trial has ended, update status
            if (subscription.isTrial && subscription.trialEnded) {
                await client
                    .from('users')
                    .update({ subscription_status: 'expired' })
                    .eq('id', userId);
                subscription.status = 'expired';
                subscription.isActive = false;
            }
            return subscription;
        }
        catch (error) {
            console.error('[Supabase] Failed to validate subscription:', error);
            throw error;
        }
    }
    // ============================================
    // DEVICE OPERATIONS
    // ============================================
    /**
     * Register a device for a user
     * @param userId - User UUID
     * @param deviceInfo - Device information
     * @returns Device record
     */
    async registerDevice(userId, deviceInfo) {
        const client = this._ensureClient();
        try {
            // Check if device already registered
            const { data: existing, error: fetchError } = await client
                .from('devices')
                .select('*')
                .eq('user_id', userId)
                .eq('device_id', deviceInfo.device_id)
                .single();
            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }
            if (existing) {
                // Update last_seen_at
                const { data, error } = await client
                    .from('devices')
                    .update({
                    device_name: deviceInfo.device_name,
                    os: deviceInfo.os,
                    app_version: deviceInfo.app_version,
                    last_seen_at: new Date().toISOString(),
                })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (error)
                    throw error;
                console.log('[Supabase] Device updated:', data.id);
                return data;
            }
            else {
                // Create new device
                const { data, error } = await client
                    .from('devices')
                    .insert({
                    user_id: userId,
                    device_id: deviceInfo.device_id,
                    device_name: deviceInfo.device_name,
                    os: deviceInfo.os,
                    app_version: deviceInfo.app_version,
                })
                    .select()
                    .single();
                if (error)
                    throw error;
                console.log('[Supabase] Device registered:', data.id);
                return data;
            }
        }
        catch (error) {
            console.error('[Supabase] Failed to register device:', error);
            throw error;
        }
    }
    /**
     * Check if user has reached device limit
     * @param userId - User UUID
     * @param deviceId - Current device ID
     * @returns Device limit check result
     */
    async checkDeviceLimit(userId, deviceId) {
        const client = this._ensureClient();
        try {
            // Get user's active license
            const { data: license } = await client
                .from('licenses')
                .select('max_devices')
                .eq('user_id', userId)
                .eq('status', 'active')
                .single();
            const maxDevices = license?.max_devices || 2; // Default to 2 devices
            // Count active devices
            const { data: devices, error: devicesError } = await client
                .from('devices')
                .select('device_id')
                .eq('user_id', userId);
            if (devicesError)
                throw devicesError;
            const deviceCount = devices?.length || 0;
            const isCurrentDevice = devices?.some((d) => d.device_id === deviceId) || false;
            return {
                allowed: isCurrentDevice || deviceCount < maxDevices,
                current: deviceCount,
                max: maxDevices,
                isCurrentDevice,
            };
        }
        catch (error) {
            console.error('[Supabase] Failed to check device limit:', error);
            // If error, allow access (fail open)
            return { allowed: true, current: 0, max: 2 };
        }
    }
    // ============================================
    // ANALYTICS OPERATIONS
    // ============================================
    /**
     * Track an analytics event
     * @param userId - User UUID
     * @param eventName - Event name
     * @param eventData - Event data
     * @param deviceId - Device ID
     * @param appVersion - App version
     */
    async trackEvent(userId, eventName, eventData = {}, deviceId = null, appVersion = null) {
        const client = this._ensureClient();
        try {
            await client.from('analytics_events').insert({
                user_id: userId,
                event_name: eventName,
                event_data: eventData,
                device_id: deviceId,
                app_version: appVersion,
            });
            console.log('[Supabase] Event tracked:', eventName);
        }
        catch (error) {
            // Don't throw - analytics failures shouldn't break the app
            console.error('[Supabase] Failed to track event:', error);
        }
    }
    // ============================================
    // API USAGE TRACKING
    // ============================================
    /**
     * Track API usage for rate limiting
     * @param userId - User UUID
     * @param apiName - API name (e.g., 'google_maps')
     * @param endpoint - Endpoint called
     * @param estimatedCost - Estimated cost in USD
     */
    async trackApiUsage(userId, apiName, endpoint, estimatedCost = 0) {
        const client = this._ensureClient();
        try {
            await client.from('api_usage').insert({
                user_id: userId,
                api_name: apiName,
                endpoint: endpoint,
                estimated_cost: estimatedCost,
            });
            console.log('[Supabase] API usage tracked:', apiName, endpoint);
        }
        catch (error) {
            // Don't throw - tracking failures shouldn't break the app
            console.error('[Supabase] Failed to track API usage:', error);
        }
    }
    /**
     * Check API usage limit for current month
     * @param userId - User UUID
     * @param apiName - API name
     * @param tierLimits - Limits by subscription tier
     * @returns Usage check result
     */
    async checkApiLimit(userId, apiName, tierLimits = { free: 10, pro: 100, enterprise: 1000 }) {
        const client = this._ensureClient();
        try {
            // Get start of current month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            // Count API calls this month
            const { count, error } = await client
                .from('api_usage')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('api_name', apiName)
                .gte('created_at', startOfMonth.toISOString());
            if (error)
                throw error;
            // Get user's subscription tier
            const user = await this.getUserById(userId);
            const limit = tierLimits[user.subscription_tier] || tierLimits.free;
            return {
                allowed: (count || 0) < limit,
                current: count || 0,
                limit: limit,
                remaining: Math.max(0, limit - (count || 0)),
            };
        }
        catch (error) {
            console.error('[Supabase] Failed to check API limit:', error);
            // If error, allow access (fail open)
            return { allowed: true, current: 0, limit: 100, remaining: 100 };
        }
    }
    // ============================================
    // PREFERENCES SYNC
    // ============================================
    /**
     * Sync user preferences to cloud
     * @param userId - User UUID
     * @param preferences - User preferences
     */
    async syncPreferences(userId, preferences) {
        const client = this._ensureClient();
        try {
            const { error } = await client
                .from('user_preferences')
                .upsert({
                user_id: userId,
                preferences: preferences,
                updated_at: new Date().toISOString(),
            });
            if (error)
                throw error;
            console.log('[Supabase] Preferences synced');
        }
        catch (error) {
            console.error('[Supabase] Failed to sync preferences:', error);
            throw error;
        }
    }
    /**
     * Get user preferences from cloud
     * @param userId - User UUID
     * @returns User preferences
     */
    async getPreferences(userId) {
        const client = this._ensureClient();
        try {
            const { data, error } = await client
                .from('user_preferences')
                .select('preferences')
                .eq('user_id', userId)
                .single();
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            return data?.preferences || {};
        }
        catch (error) {
            console.error('[Supabase] Failed to get preferences:', error);
            return {};
        }
    }
    // ============================================
    // EDGE FUNCTIONS
    // ============================================
    /**
     * Call a Supabase Edge Function
     * @param functionName - Function name
     * @param payload - Request payload
     * @returns Function response
     */
    async callEdgeFunction(functionName, payload) {
        const client = this._ensureClient();
        try {
            const { data, error } = await client.functions.invoke(functionName, {
                body: payload,
            });
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            console.error(`[Supabase] Edge function '${functionName}' failed:`, error);
            throw error;
        }
    }
}
// Export singleton instance
exports.default = new SupabaseService();
