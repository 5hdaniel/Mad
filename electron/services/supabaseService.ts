/**
 * Supabase Service
 * Handles all cloud database operations and sync
 * Currently uses service_role key for development
 * TODO: Refactor to use Supabase Auth for production
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { User, SubscriptionTier, Subscription } from "../types/models";
import type { AuditLogEntry } from "./auditService";
import logService from "./logService";

/**
 * User data for sync operations
 */
interface UserSyncData {
  email: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  oauth_provider: string;
  oauth_id: string;
  subscription_tier?: SubscriptionTier;
}

/**
 * Device information
 */
interface DeviceInfo {
  device_id: string;
  device_name: string;
  os: string;
  app_version: string;
}

/**
 * Device record from database
 */
interface DeviceRecord {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  os: string;
  app_version: string;
  last_seen_at?: string;
}

/**
 * Device limit check result
 */
interface DeviceLimitCheck {
  allowed: boolean;
  current: number;
  max: number;
  isCurrentDevice?: boolean;
}

/**
 * API usage check result
 */
interface ApiUsageCheck {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}

/**
 * Tier limits for API usage
 */
interface TierLimits {
  free: number;
  pro: number;
  enterprise: number;
}

/**
 * Supabase Auth Session (BACKLOG-390)
 * Stores the current authenticated session for RLS
 */
interface SupabaseAuthSession {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

class SupabaseService {
  private client: SupabaseClient | null = null;
  private initialized = false;
  /** BACKLOG-390: Store Supabase Auth session for RLS-enabled queries */
  private authSession: SupabaseAuthSession | null = null;

  /**
   * Initialize Supabase client
   * Uses SUPABASE_ANON_KEY (public/publishable key) for client operations.
   * This is safe to include in packaged builds as it's meant for public use.
   * RLS policies provide security at the database level.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    // Use anon key (public/publishable) - safe for packaged builds
    // Falls back to service key for backward compatibility during development
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logService.error(
        "[Supabase] Missing credentials. Check .env.development or .env.production file.",
        "Supabase"
      );
      throw new Error("Supabase credentials not configured");
    }

    logService.info("[Supabase] Initializing with URL:", "Supabase", { supabaseUrl });

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.initialized = true;
    logService.debug("[Supabase] Initialized successfully", "Supabase");
  }

  // ============================================
  // SUPABASE AUTH (BACKLOG-390: B2B Portal)
  // ============================================

  /**
   * Sign in with ID token from direct OAuth (Google/Microsoft)
   *
   * BACKLOG-390: After existing OAuth completes, call this to create a Supabase
   * Auth session so RLS policies work correctly with auth.uid().
   *
   * This method is "additive" - it doesn't change the existing OAuth flow,
   * just tells Supabase about the authenticated user.
   *
   * @param provider - OAuth provider ('google' or 'azure' for Microsoft)
   * @param idToken - The ID token from the OAuth flow
   * @returns Session info or null if auth failed (graceful fallback)
   */
  async signInWithIdToken(
    provider: "google" | "azure",
    idToken: string
  ): Promise<SupabaseAuthSession | null> {
    const client = this._ensureClient();

    try {
      logService.info(
        `[Supabase] Signing in with ID token (provider: ${provider})`,
        "Supabase"
      );

      const { data, error } = await client.auth.signInWithIdToken({
        provider,
        token: idToken,
      });

      if (error) {
        // Log but don't throw - graceful fallback to service key
        logService.warn(
          `[Supabase] signInWithIdToken failed: ${error.message}`,
          "Supabase",
          { provider, error: error.message }
        );
        return null;
      }

      if (!data.session || !data.user) {
        logService.warn(
          "[Supabase] signInWithIdToken returned no session/user",
          "Supabase"
        );
        return null;
      }

      // Store session for RLS queries
      this.authSession = {
        userId: data.user.id,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at
          ? new Date(data.session.expires_at * 1000)
          : undefined,
      };

      logService.info(
        "[Supabase] Successfully signed in with ID token",
        "Supabase",
        { userId: data.user.id, provider }
      );

      return this.authSession;
    } catch (error) {
      // Graceful fallback - log warning and continue with service key
      logService.warn(
        "[Supabase] signInWithIdToken exception (falling back to service key)",
        "Supabase",
        { error: error instanceof Error ? error.message : "Unknown error" }
      );
      return null;
    }
  }

  /**
   * Sign out from Supabase Auth
   * Clears the auth session (service key still works for admin operations)
   */
  async signOut(): Promise<void> {
    const client = this._ensureClient();

    try {
      const { error } = await client.auth.signOut();
      if (error) {
        logService.warn(
          `[Supabase] signOut failed: ${error.message}`,
          "Supabase"
        );
      }
      this.authSession = null;
      logService.info("[Supabase] Signed out from Supabase Auth", "Supabase");
    } catch (error) {
      this.authSession = null;
      logService.warn("[Supabase] signOut exception", "Supabase", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get current Supabase Auth session
   * @returns The auth session or null if not authenticated
   */
  getAuthSession(): SupabaseAuthSession | null {
    return this.authSession;
  }

  /**
   * Get current authenticated user ID from Supabase Auth
   * @returns User UUID or null if not authenticated
   */
  getAuthUserId(): string | null {
    return this.authSession?.userId ?? null;
  }

  /**
   * Check if authenticated with Supabase Auth (not just service key)
   * @returns true if signed in with user credentials
   */
  isAuthenticated(): boolean {
    return this.authSession !== null;
  }

  /**
   * Get active organization membership for a user
   * Used to determine team license status
   * @param userId - User UUID to check
   * @returns Organization membership data or null if not a team member
   */
  async getActiveOrganizationMembership(
    userId: string
  ): Promise<{ organization_id: string; organization_name?: string } | null> {
    try {
      const client = this._ensureClient();
      const { data, error } = await client
        .from("organization_members")
        .select("organization_id, organizations(name)")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        logService.warn(
          `[Supabase] Failed to get org membership: ${error.message}`,
          "SupabaseService"
        );
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        organization_id: data.organization_id,
        organization_name: (data.organizations as { name?: string } | null)?.name,
      };
    } catch (err) {
      logService.error("[Supabase] Error checking org membership", "SupabaseService", { err });
      return null;
    }
  }

  /**
   * Get the Supabase client (public access for storage service)
   * BACKLOG-393: Needed by supabaseStorageService for file uploads
   * @returns Initialized Supabase client
   * @throws {Error} If client cannot be initialized
   */
  getClient(): SupabaseClient {
    return this._ensureClient();
  }

  /**
   * Ensure client is initialized and return it
   * @private
   * @throws {Error} If client cannot be initialized
   */
  private _ensureClient(): SupabaseClient {
    if (!this.initialized || !this.client) {
      this.initialize();
    }
    if (!this.client) {
      throw new Error("Supabase client is not initialized");
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
  async syncUser(userData: UserSyncData): Promise<User> {
    const client = this._ensureClient();

    try {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await client
        .from("users")
        .select("*")
        .eq("oauth_provider", userData.oauth_provider)
        .eq("oauth_id", userData.oauth_id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 = not found, which is OK
        throw fetchError;
      }

      let result: User;

      if (existingUser) {
        // Update existing user
        const { data, error } = await client
          .from("users")
          .update({
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            display_name: userData.display_name,
            avatar_url: userData.avatar_url,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingUser.id)
          .select()
          .single();

        if (error) throw error;

        // Increment login count
        await client.rpc("increment", {
          row_id: existingUser.id,
          x: 1,
          table_name: "users",
          column_name: "login_count",
        });

        result = data as User;
        logService.info("[Supabase] User updated:", "Supabase", { userId: result.id });
      } else {
        // Create new user
        const { data, error } = await client
          .from("users")
          .insert({
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            display_name: userData.display_name,
            avatar_url: userData.avatar_url,
            oauth_provider: userData.oauth_provider,
            oauth_id: userData.oauth_id,
            subscription_tier: userData.subscription_tier || "free",
            subscription_status: "trial",
            trial_ends_at: new Date(
              Date.now() + 14 * 24 * 60 * 60 * 1000,
            ).toISOString(), // 14 days from now
            login_count: 1,
            last_login_at: new Date().toISOString(),
            signup_source: "desktop_app",
          })
          .select()
          .single();

        if (error) throw error;
        result = data as User;
        logService.info("[Supabase] New user created:", "Supabase", { userId: result.id });
      }

      return result;
    } catch (error) {
      logService.error("[Supabase] Failed to sync user:", "Supabase", { error });
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param userId - User UUID
   * @returns User data
   */
  async getUserById(userId: string): Promise<User> {
    const client = this._ensureClient();

    try {
      const { data, error } = await client
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data as User;
    } catch (error) {
      logService.error("[Supabase] Failed to get user:", "Supabase", { error });
      throw error;
    }
  }

  /**
   * Sync terms acceptance to cloud
   * @param userId - User UUID
   * @param termsVersion - Version of Terms of Service accepted
   * @param privacyVersion - Version of Privacy Policy accepted
   */
  async syncTermsAcceptance(
    userId: string,
    termsVersion: string,
    privacyVersion: string,
  ): Promise<User> {
    const client = this._ensureClient();

    try {
      const { data, error } = await client
        .from("users")
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version_accepted: termsVersion,
          privacy_policy_accepted_at: new Date().toISOString(),
          privacy_policy_version_accepted: privacyVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      logService.info("[Supabase] Terms acceptance synced for user:", "Supabase", { userId });
      return data as User;
    } catch (error) {
      logService.error("[Supabase] Failed to sync terms acceptance:", "Supabase", { error });
      throw error;
    }
  }

  /**
   * Sync email onboarding completion to cloud
   * @param userId - User UUID
   */
  async completeEmailOnboarding(userId: string): Promise<void> {
    const client = this._ensureClient();

    try {
      const { error } = await client
        .from("users")
        .update({
          email_onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;
      logService.info(
        "[Supabase] Email onboarding completion synced for user:",
        "Supabase",
        { userId }
      );
    } catch (error) {
      logService.error(
        "[Supabase] Failed to sync email onboarding completion:",
        "Supabase",
        { error }
      );
      throw error;
    }
  }

  /**
   * Validate user's subscription status
   * @param userId - User UUID
   * @returns Subscription status
   */
  async validateSubscription(userId: string): Promise<Subscription> {
    const client = this._ensureClient();

    try {
      const user = await this.getUserById(userId);

      const now = new Date();
      const trialEndsAt = user.trial_ends_at
        ? new Date(user.trial_ends_at)
        : null;

      const subscription: Subscription = {
        tier: user.subscription_tier,
        status: user.subscription_status,
        isActive: user.subscription_status === "active",
        isTrial: user.subscription_status === "trial",
        trialEnded: trialEndsAt ? trialEndsAt < now : false,
        trialDaysRemaining: trialEndsAt
          ? Math.max(
              0,
              Math.ceil(
                (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
              ),
            )
          : 0,
      };

      // If trial has ended, update status
      if (subscription.isTrial && subscription.trialEnded) {
        await client
          .from("users")
          .update({ subscription_status: "expired" })
          .eq("id", userId);

        subscription.status = "expired";
        subscription.isActive = false;
      }

      return subscription;
    } catch (error) {
      logService.error("[Supabase] Failed to validate subscription:", "Supabase", { error });
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
  async registerDevice(
    userId: string,
    deviceInfo: DeviceInfo,
  ): Promise<DeviceRecord> {
    const client = this._ensureClient();

    try {
      // Check if device already registered
      const { data: existing, error: fetchError } = await client
        .from("devices")
        .select("*")
        .eq("user_id", userId)
        .eq("device_id", deviceInfo.device_id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      if (existing) {
        // Update last_seen_at
        const { data, error } = await client
          .from("devices")
          .update({
            device_name: deviceInfo.device_name,
            os: deviceInfo.os,
            app_version: deviceInfo.app_version,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        logService.info("[Supabase] Device updated:", "Supabase", { deviceId: data.id });
        return data as DeviceRecord;
      } else {
        // Create new device
        const { data, error } = await client
          .from("devices")
          .insert({
            user_id: userId,
            device_id: deviceInfo.device_id,
            device_name: deviceInfo.device_name,
            os: deviceInfo.os,
            app_version: deviceInfo.app_version,
          })
          .select()
          .single();

        if (error) throw error;
        logService.info("[Supabase] Device registered:", "Supabase", { deviceId: data.id });
        return data as DeviceRecord;
      }
    } catch (error) {
      logService.error("[Supabase] Failed to register device:", "Supabase", { error });
      throw error;
    }
  }

  /**
   * Check if user has reached device limit
   * @param userId - User UUID
   * @param deviceId - Current device ID
   * @returns Device limit check result
   */
  async checkDeviceLimit(
    userId: string,
    deviceId: string,
  ): Promise<DeviceLimitCheck> {
    const client = this._ensureClient();

    try {
      // Get user's active license
      const { data: license } = await client
        .from("licenses")
        .select("max_devices")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      const maxDevices = license?.max_devices || 2; // Default to 2 devices

      // Count active devices
      const { data: devices, error: devicesError } = await client
        .from("devices")
        .select("device_id")
        .eq("user_id", userId);

      if (devicesError) throw devicesError;

      const deviceCount = devices?.length || 0;
      const isCurrentDevice =
        devices?.some((d: { device_id: string }) => d.device_id === deviceId) ||
        false;

      return {
        allowed: isCurrentDevice || deviceCount < maxDevices,
        current: deviceCount,
        max: maxDevices,
        isCurrentDevice,
      };
    } catch (error) {
      logService.error("[Supabase] Failed to check device limit:", "Supabase", { error });
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
  async trackEvent(
    userId: string,
    eventName: string,
    eventData: Record<string, any> = {},
    deviceId: string | null = null,
    appVersion: string | null = null,
  ): Promise<void> {
    const client = this._ensureClient();

    try {
      await client.from("analytics_events").insert({
        user_id: userId,
        event_name: eventName,
        event_data: eventData,
        device_id: deviceId,
        app_version: appVersion,
      });

      logService.info("[Supabase] Event tracked:", "Supabase", { eventName });
    } catch (error) {
      // Don't throw - analytics failures shouldn't break the app
      logService.error("[Supabase] Failed to track event:", "Supabase", { error });
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
  async trackApiUsage(
    userId: string,
    apiName: string,
    endpoint: string,
    estimatedCost: number = 0,
  ): Promise<void> {
    const client = this._ensureClient();

    try {
      await client.from("api_usage").insert({
        user_id: userId,
        api_name: apiName,
        endpoint: endpoint,
        estimated_cost: estimatedCost,
      });

      logService.info("[Supabase] API usage tracked:", "Supabase", { apiName, endpoint });
    } catch (error) {
      // Don't throw - tracking failures shouldn't break the app
      logService.error("[Supabase] Failed to track API usage:", "Supabase", { error });
    }
  }

  /**
   * Check API usage limit for current month
   * @param userId - User UUID
   * @param apiName - API name
   * @param tierLimits - Limits by subscription tier
   * @returns Usage check result
   */
  async checkApiLimit(
    userId: string,
    apiName: string,
    tierLimits: TierLimits = { free: 10, pro: 100, enterprise: 1000 },
  ): Promise<ApiUsageCheck> {
    const client = this._ensureClient();

    try {
      // Get start of current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Count API calls this month
      const { count, error } = await client
        .from("api_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("api_name", apiName)
        .gte("created_at", startOfMonth.toISOString());

      if (error) throw error;

      // Get user's subscription tier
      const user = await this.getUserById(userId);
      const limit = tierLimits[user.subscription_tier] || tierLimits.free;

      return {
        allowed: (count || 0) < limit,
        current: count || 0,
        limit: limit,
        remaining: Math.max(0, limit - (count || 0)),
      };
    } catch (error) {
      logService.error("[Supabase] Failed to check API limit:", "Supabase", { error });
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
  async syncPreferences(
    userId: string,
    preferences: Record<string, any>,
  ): Promise<void> {
    const client = this._ensureClient();

    try {
      const { error } = await client.from("user_preferences").upsert({
        user_id: userId,
        preferences: preferences,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      logService.info("[Supabase] Preferences synced", "Supabase");
    } catch (error) {
      logService.error("[Supabase] Failed to sync preferences:", "Supabase", { error });
      throw error;
    }
  }

  /**
   * Get user preferences from cloud
   * @param userId - User UUID
   * @returns User preferences (empty object if not found)
   * @throws Error if there's a database error (not including "not found")
   */
  async getPreferences(userId: string): Promise<Record<string, any>> {
    const client = this._ensureClient();

    const { data, error } = await client
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .single();

    // PGRST116 = "not found" - this is expected for new users
    if (error && error.code !== "PGRST116") {
      logService.error("[Supabase] Failed to get preferences:", "Supabase", { error });
      throw error;
    }

    return data?.preferences || {};
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
  async callEdgeFunction(
    functionName: string,
    payload: Record<string, any>,
  ): Promise<any> {
    const client = this._ensureClient();

    try {
      const { data, error } = await client.functions.invoke(functionName, {
        body: payload,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      logService.error(
        `[Supabase] Edge function '${functionName}' failed:`,
        "Supabase",
        { error }
      );
      throw error;
    }
  }

  // ============================================
  // AUDIT LOG OPERATIONS
  // ============================================

  /**
   * Batch insert audit logs to cloud
   * @param entries - Array of audit log entries to sync
   */
  async batchInsertAuditLogs(entries: AuditLogEntry[]): Promise<void> {
    const client = this._ensureClient();

    if (entries.length === 0) {
      return;
    }

    try {
      // Map entries to database format
      const rows = entries.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp.toISOString(),
        user_id: entry.userId,
        session_id: entry.sessionId || null,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId || null,
        metadata: entry.metadata || null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
        success: entry.success,
        error_message: entry.errorMessage || null,
      }));

      const { error } = await client.from("audit_logs").upsert(rows, {
        onConflict: "id",
        ignoreDuplicates: true,
      });

      if (error) throw error;

      logService.info(`[Supabase] Synced ${entries.length} audit logs to cloud`, "Supabase");
    } catch (error) {
      logService.error("[Supabase] Failed to sync audit logs:", "Supabase", { error });
      throw error;
    }
  }

  /**
   * Get audit logs from cloud for a user
   * @param userId - User UUID
   * @param options - Query options
   * @returns Array of audit log entries
   */
  async getAuditLogs(
    userId: string,
    options?: {
      action?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<AuditLogEntry[]> {
    const client = this._ensureClient();

    try {
      let query = client
        .from("audit_logs")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false });

      if (options?.action) {
        query = query.eq("action", options.action);
      }

      if (options?.resourceType) {
        query = query.eq("resource_type", options.resourceType);
      }

      if (options?.startDate) {
        query = query.gte("timestamp", options.startDate.toISOString());
      }

      if (options?.endDate) {
        query = query.lte("timestamp", options.endDate.toISOString());
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(
          options.offset,
          options.offset + (options.limit || 50) - 1,
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map database rows to AuditLogEntry
      return (data || []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        timestamp: new Date(row.timestamp as string),
        userId: row.user_id as string,
        sessionId: row.session_id as string | undefined,
        action: row.action as AuditLogEntry["action"],
        resourceType: row.resource_type as AuditLogEntry["resourceType"],
        resourceId: row.resource_id as string | undefined,
        metadata: row.metadata as Record<string, unknown> | undefined,
        ipAddress: row.ip_address as string | undefined,
        userAgent: row.user_agent as string | undefined,
        success: row.success as boolean,
        errorMessage: row.error_message as string | undefined,
      }));
    } catch (error) {
      logService.error("[Supabase] Failed to get audit logs:", "Supabase", { error });
      throw error;
    }
  }
}

// Export singleton instance
export default new SupabaseService();
