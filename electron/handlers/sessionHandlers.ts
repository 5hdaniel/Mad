/**
 * Session Handlers
 * Handles session management, validation, logout, terms acceptance, and email onboarding
 */

import { ipcMain, IpcMainInvokeEvent, shell } from "electron";
import type { User } from "../types/models";

// Import services
import databaseService from "../services/databaseService";
import supabaseService from "../services/supabaseService";
import sessionService from "../services/sessionService";
import sessionSecurityService from "../services/sessionSecurityService";
import auditService from "../services/auditService";
import logService from "../services/logService";
import { setSyncUserId } from "../sync-handlers";

// Import validation utilities
import { ValidationError, validateUserId, validateSessionToken } from "../utils/validation";

// Import constants
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_POLICY_VERSION,
} from "../constants/legalVersions";

// Type definitions
interface AuthResponse {
  success: boolean;
  error?: string;
}

interface TermsAcceptanceResponse extends AuthResponse {
  user?: User;
}

interface SessionValidationResponse extends AuthResponse {
  valid: boolean;
  user?: User;
}

interface CurrentUserResponse extends AuthResponse {
  user?: User;
  sessionToken?: string;
  subscription?: import("../types/models").Subscription;
  provider?: string;
  isNewUser?: boolean;
}

/**
 * TASK-1809: Fetch cloud user with retry logic and exponential backoff
 * Used to reliably get terms data from Supabase
 * @param userId - Supabase user ID
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Cloud user data or null if all retries fail
 */
async function fetchCloudUserWithRetry(
  userId: string,
  maxRetries: number = 3
): Promise<User | null> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await logService.debug(
        `[TermsSync] Fetching cloud user (attempt ${attempt}/${maxRetries})`,
        "SessionHandlers",
        { userId: userId.substring(0, 8) + "..." }
      );

      const user = await supabaseService.getUserById(userId);
      return user;
    } catch (error) {
      lastError = error as Error;
      await logService.warn(
        `[TermsSync] Supabase fetch attempt ${attempt}/${maxRetries} failed`,
        "SessionHandlers",
        { error: lastError.message }
      );

      if (attempt < maxRetries) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  await logService.error(
    "[TermsSync] All Supabase fetch retries failed",
    "SessionHandlers",
    { error: lastError?.message || "Unknown error" }
  );
  return null; // Fall back to local data
}

/**
 * TASK-1809: Sync terms from cloud to local user if needed
 * This ensures users who accepted terms on cloud (before local DB init) get synced
 * @param localUser - The local user to potentially update
 * @param cloudUser - The cloud user with potential terms data
 * @returns Updated local user if sync was performed, original user otherwise
 */
async function syncTermsFromCloudToLocal(
  localUser: User,
  cloudUser: User | null
): Promise<User> {
  // Nothing to sync if no cloud user or cloud has no terms
  if (!cloudUser?.terms_accepted_at) {
    await logService.debug(
      "[TermsSync] No cloud terms to sync",
      "SessionHandlers",
      { cloudTerms: !!cloudUser?.terms_accepted_at }
    );
    return localUser;
  }

  // Already synced if local has terms
  if (localUser.terms_accepted_at) {
    await logService.debug(
      "[TermsSync] Local already has terms, no sync needed",
      "SessionHandlers"
    );
    return localUser;
  }

  // Sync terms from cloud to local
  await logService.info(
    "[TermsSync] Syncing terms from Supabase to local",
    "SessionHandlers",
    {
      userId: localUser.id.substring(0, 8) + "...",
      cloudTermsAt: cloudUser.terms_accepted_at,
    }
  );

  try {
    await databaseService.updateUser(localUser.id, {
      terms_accepted_at: cloudUser.terms_accepted_at,
      terms_version_accepted: cloudUser.terms_version_accepted,
      privacy_policy_accepted_at: cloudUser.privacy_policy_accepted_at,
      privacy_policy_version_accepted: cloudUser.privacy_policy_version_accepted,
    });

    // Re-fetch to get updated user
    const updatedUser = await databaseService.getUserById(localUser.id);
    if (updatedUser) {
      await logService.info(
        "[TermsSync] Successfully synced terms from cloud",
        "SessionHandlers",
        { userId: localUser.id.substring(0, 8) + "..." }
      );
      return updatedUser;
    }
  } catch (syncError) {
    await logService.error(
      "[TermsSync] Failed to sync terms to local",
      "SessionHandlers",
      { error: syncError instanceof Error ? syncError.message : "Unknown error" }
    );
  }

  return localUser;
}

/**
 * Check if user needs to accept or re-accept terms
 * TASK-1809: Now accepts optional cloud user to check cloud terms as fallback
 */
function needsToAcceptTerms(user: User, cloudUser?: User | null): boolean {
  // Check local user first
  const localTermsAccepted = user.terms_accepted_at;
  // Fall back to cloud terms if local is missing
  const termsAcceptedAt = localTermsAccepted || cloudUser?.terms_accepted_at;

  if (!termsAcceptedAt) {
    return true;
  }

  // Use local versions if available, otherwise check cloud
  const termsVersion = user.terms_version_accepted || cloudUser?.terms_version_accepted;
  const privacyVersion = user.privacy_policy_version_accepted || cloudUser?.privacy_policy_version_accepted;

  if (!termsVersion && !privacyVersion) {
    return false;
  }

  if (termsVersion && termsVersion !== CURRENT_TERMS_VERSION) {
    return true;
  }

  if (privacyVersion && privacyVersion !== CURRENT_PRIVACY_POLICY_VERSION) {
    return true;
  }

  return false;
}

/**
 * Handle logout
 */
async function handleLogout(
  _event: IpcMainInvokeEvent,
  sessionToken: string
): Promise<AuthResponse> {
  try {
    const validatedSessionToken = validateSessionToken(sessionToken);

    const session = await databaseService.validateSession(validatedSessionToken);
    const userId = session?.id || "unknown";

    await databaseService.deleteSession(validatedSessionToken);
    await sessionService.clearSession();
    sessionSecurityService.cleanupSession(validatedSessionToken);

    setSyncUserId(null);

    await auditService.log({
      userId,
      sessionId: validatedSessionToken,
      action: "LOGOUT",
      resourceType: "SESSION",
      resourceId: validatedSessionToken,
      success: true,
    });

    await logService.info("User logged out successfully", "AuthHandlers", {
      userId,
    });

    return { success: true };
  } catch (error) {
    await logService.error("Logout failed", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Accept terms and privacy policy
 */
async function handleAcceptTerms(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<TermsAcceptanceResponse> {
  try {
    const validatedUserId = validateUserId(userId)!;

    const updatedUser = await databaseService.acceptTerms(
      validatedUserId,
      CURRENT_TERMS_VERSION,
      CURRENT_PRIVACY_POLICY_VERSION
    );

    await logService.info("Terms accepted", "AuthHandlers", {
      version: CURRENT_TERMS_VERSION,
    });

    try {
      await supabaseService.syncTermsAcceptance(
        userId,
        CURRENT_TERMS_VERSION,
        CURRENT_PRIVACY_POLICY_VERSION
      );
    } catch (syncError) {
      await logService.warn(
        "Failed to sync terms to Supabase",
        "AuthHandlers",
        {
          error:
            syncError instanceof Error ? syncError.message : "Unknown error",
        }
      );
    }

    return { success: true, user: updatedUser };
  } catch (error) {
    await logService.error("Accept terms failed", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Accept terms directly to Supabase (pre-DB onboarding flow)
 */
async function handleAcceptTermsToSupabase(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validatedUserId = validateUserId(userId)!;

    await supabaseService.syncTermsAcceptance(
      validatedUserId,
      CURRENT_TERMS_VERSION,
      CURRENT_PRIVACY_POLICY_VERSION
    );

    await logService.info(
      "Terms accepted to Supabase (pre-DB flow)",
      "AuthHandlers",
      { version: CURRENT_TERMS_VERSION, userId: validatedUserId }
    );

    return { success: true };
  } catch (error) {
    await logService.error(
      "Accept terms to Supabase failed",
      "AuthHandlers",
      { error: error instanceof Error ? error.message : "Unknown error" }
    );
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Complete email onboarding
 */
async function handleCompleteEmailOnboarding(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validatedUserId = validateUserId(userId)!;

    await databaseService.completeEmailOnboarding(validatedUserId);

    await logService.info("Email onboarding completed", "AuthHandlers", {
      userId: validatedUserId,
    });

    try {
      await supabaseService.completeEmailOnboarding(userId);
    } catch (syncError) {
      await logService.warn(
        "Failed to sync email onboarding to Supabase",
        "AuthHandlers",
        {
          error:
            syncError instanceof Error ? syncError.message : "Unknown error",
        }
      );
    }

    return { success: true };
  } catch (error) {
    await logService.error(
      "Complete email onboarding failed",
      "AuthHandlers",
      { error: error instanceof Error ? error.message : "Unknown error" }
    );
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check email onboarding status
 *
 * IMPORTANT: This checks for a valid mailbox token FIRST, regardless of the
 * email_onboarding_completed flag. This fixes a state mismatch bug (TASK-1039)
 * where users could have a valid token but the flag not set (race condition,
 * error, or interrupted flow), causing confusing UI states.
 *
 * If a token exists but the flag is false, we auto-correct the flag.
 */
async function handleCheckEmailOnboarding(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<{ success: boolean; completed: boolean; error?: string }> {
  try {
    const validatedUserId = validateUserId(userId)!;

    // Check for valid mailbox token FIRST, regardless of flag
    // This is the source of truth for whether email is actually connected
    const googleToken = await databaseService.getOAuthToken(
      validatedUserId,
      "google",
      "mailbox"
    );
    const microsoftToken = await databaseService.getOAuthToken(
      validatedUserId,
      "microsoft",
      "mailbox"
    );
    const hasValidMailboxToken = !!(googleToken || microsoftToken);

    // Check the flag for comparison/logging
    const onboardingCompleted =
      await databaseService.hasCompletedEmailOnboarding(validatedUserId);

    // Auto-correct inconsistent state: token exists but flag is false
    if (hasValidMailboxToken && !onboardingCompleted) {
      await logService.info(
        "Auto-correcting inconsistent email onboarding state: token exists but flag was false",
        "AuthHandlers",
        { userId: validatedUserId.substring(0, 8) + "..." }
      );
      await databaseService.completeEmailOnboarding(validatedUserId);
    }

    // Also handle the reverse: flag is true but no token
    if (onboardingCompleted && !hasValidMailboxToken) {
      await logService.info(
        "Email onboarding flag is true but no valid mailbox token found",
        "AuthHandlers",
        { userId: validatedUserId.substring(0, 8) + "..." }
      );
    }

    // The completed status is based on having a valid token
    // (token is the source of truth, not the flag)
    const completed = hasValidMailboxToken;

    await logService.info("Email onboarding check", "AuthHandlers", {
      userId: validatedUserId.substring(0, 8) + "...",
      completed,
      onboardingCompleted,
      hasValidMailboxToken,
    });

    return { success: true, completed };
  } catch (error) {
    await logService.error(
      "Check email onboarding status failed",
      "AuthHandlers",
      { error: error instanceof Error ? error.message : "Unknown error" }
    );
    if (error instanceof ValidationError) {
      return {
        success: false,
        completed: false,
        error: `Validation error: ${error.message}`,
      };
    }
    return {
      success: false,
      completed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate session
 */
async function handleValidateSession(
  _event: IpcMainInvokeEvent,
  sessionToken: string
): Promise<SessionValidationResponse> {
  try {
    const validatedSessionToken = validateSessionToken(sessionToken);

    const session = await databaseService.validateSession(validatedSessionToken);

    if (!session) {
      return { success: false, valid: false };
    }

    const createdAt =
      session.created_at instanceof Date
        ? session.created_at.toISOString()
        : session.created_at;
    const lastAccessedAt =
      session.last_login_at instanceof Date
        ? session.last_login_at.toISOString()
        : session.last_login_at;
    const securityCheck = await sessionSecurityService.checkSessionValidity(
      { created_at: createdAt, last_accessed_at: lastAccessedAt as string },
      validatedSessionToken
    );

    if (!securityCheck.valid) {
      await databaseService.deleteSession(validatedSessionToken);
      sessionSecurityService.cleanupSession(validatedSessionToken);
      return {
        success: false,
        valid: false,
        error: `Session ${securityCheck.reason}`,
      };
    }

    sessionSecurityService.recordActivity(validatedSessionToken);

    return { success: true, valid: true, user: session };
  } catch (error) {
    await logService.error("Session validation failed", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof ValidationError) {
      return {
        success: false,
        valid: false,
        error: `Validation error: ${error.message}`,
      };
    }
    return {
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * TASK-1507G: Migrate user from old random ID to Supabase Auth ID
 * Updates all FK references in child tables
 * @param oldUser - The user with the incorrect local ID
 * @param newSupabaseId - The correct Supabase Auth UUID
 * @returns The migrated user with the new ID
 */
async function migrateUserToSupabaseId(
  oldUser: User,
  newSupabaseId: string
): Promise<User> {
  // Check if user with Supabase ID already exists (edge case: concurrent migration)
  const existingUser = await databaseService.getUserById(newSupabaseId);
  if (existingUser) {
    // User already migrated or created correctly - just return existing
    await logService.info(
      "TASK-1507G: User with Supabase ID already exists, skipping migration",
      "SessionHandlers",
      { supabaseId: newSupabaseId.substring(0, 8) + "..." }
    );
    return existingUser;
  }

  const db = databaseService.getRawDatabase();

  // Transaction to ensure atomicity
  const migrate = db.transaction(() => {
    // 1. Create new user with Supabase ID (copy all data)
    db.prepare(`
      INSERT INTO users_local (
        id, email, first_name, last_name, display_name, avatar_url,
        oauth_provider, oauth_id, subscription_tier, subscription_status,
        trial_ends_at, terms_accepted_at, terms_version_accepted,
        privacy_policy_accepted_at, privacy_policy_version_accepted,
        email_onboarding_completed_at, mobile_phone_type, timezone, theme,
        license_type, ai_detection_enabled, organization_id,
        created_at, updated_at
      )
      SELECT
        ?, email, first_name, last_name, display_name, avatar_url,
        oauth_provider, oauth_id, subscription_tier, subscription_status,
        trial_ends_at, terms_accepted_at, terms_version_accepted,
        privacy_policy_accepted_at, privacy_policy_version_accepted,
        email_onboarding_completed_at, mobile_phone_type, timezone, theme,
        license_type, ai_detection_enabled, organization_id,
        created_at, CURRENT_TIMESTAMP
      FROM users_local WHERE id = ?
    `).run(newSupabaseId, oldUser.id);

    // 2. Update FK references in all child tables (SR Engineer verified complete list)
    const tables = [
      'sessions',
      'oauth_tokens',
      'contacts',
      'transactions',
      'communications',
      'emails',
      'messages',
      'llm_settings',
      'audit_logs',
      'classification_feedback',
      'audit_packages',
      'ignored_communications',
    ];

    for (const table of tables) {
      try {
        db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`)
          .run(newSupabaseId, oldUser.id);
      } catch {
        // Table may not exist or have user_id column - ignore
      }
    }

    // 3. Delete old user record
    db.prepare('DELETE FROM users_local WHERE id = ?').run(oldUser.id);
  });

  migrate();

  // Return the migrated user
  const migratedUser = await databaseService.getUserById(newSupabaseId);
  if (!migratedUser) {
    throw new Error('User migration failed - could not find migrated user');
  }

  await logService.info(
    "TASK-1507G: User migration complete",
    "SessionHandlers",
    { newId: newSupabaseId.substring(0, 8) + "..." }
  );

  return migratedUser;
}

/**
 * Get current user from saved session
 */
async function handleGetCurrentUser(): Promise<CurrentUserResponse> {
  try {
    // Check if database is initialized first - early return if not
    // This prevents race conditions where AuthContext calls this before
    // LoadingOrchestrator has finished initializing the database
    if (!databaseService.isInitialized()) {
      return { success: false, error: "Database not initialized" };
    }

    const session = await sessionService.loadSession();

    if (!session) {
      return { success: false, error: "No active session" };
    }

    const dbSession = await databaseService.validateSession(session.sessionToken);

    if (!dbSession) {
      await sessionService.clearSession();
      sessionSecurityService.cleanupSession(session.sessionToken);
      return { success: false, error: "Session expired or invalid" };
    }

    const dbCreatedAt =
      dbSession.created_at instanceof Date
        ? dbSession.created_at.toISOString()
        : dbSession.created_at;
    const dbLastAccessedAt =
      dbSession.last_login_at instanceof Date
        ? dbSession.last_login_at.toISOString()
        : dbSession.last_login_at;
    const securityCheck = await sessionSecurityService.checkSessionValidity(
      { created_at: dbCreatedAt, last_accessed_at: dbLastAccessedAt as string },
      session.sessionToken
    );

    if (!securityCheck.valid) {
      await databaseService.deleteSession(session.sessionToken);
      await sessionService.clearSession();
      sessionSecurityService.cleanupSession(session.sessionToken);
      return { success: false, error: `Session ${securityCheck.reason}` };
    }

    sessionSecurityService.recordActivity(session.sessionToken);

    // TASK-1507E: Ensure local SQLite user exists for existing sessions
    // Users who authenticated before TASK-1507D have valid sessions but no local user,
    // which causes FK constraint failures on mailbox connection, messages import, etc.
    let freshUser = await databaseService.getUserById(session.user.id);

    if (!freshUser && session.user.email) {
      // Try to find user by email (handles case where session.user.id is Supabase UUID)
      freshUser = await databaseService.getUserByEmail(session.user.email);
    }

    if (!freshUser && session.user.oauth_id && session.provider) {
      // Try to find user by OAuth ID
      freshUser = await databaseService.getUserByOAuthId(
        session.provider,
        session.user.oauth_id
      );
    }

    // TASK-1507G: Check for ID mismatch - user exists but with wrong ID
    // Get the authoritative Supabase UUID (session.user.id should be it, but verify via auth service)
    const supabaseUserId = supabaseService.getAuthUserId() || session.user.id;

    if (freshUser && freshUser.id !== supabaseUserId) {
      await logService.info(
        "TASK-1507G: ID mismatch detected, migrating user",
        "SessionHandlers",
        {
          localId: freshUser.id.substring(0, 8) + "...",
          supabaseId: supabaseUserId.substring(0, 8) + "...",
        }
      );

      // Migrate user to Supabase ID
      freshUser = await migrateUserToSupabaseId(freshUser, supabaseUserId);
    }

    // TASK-1809: Always fetch cloud user with retry to reliably check terms state
    // This is critical for users who accepted terms before local DB was initialized
    await logService.debug(
      "[TermsSync] Fetching cloud user for terms check",
      "SessionHandlers",
      { userId: supabaseUserId.substring(0, 8) + "..." }
    );
    const cloudUser = await fetchCloudUserWithRetry(supabaseUserId);

    await logService.debug(
      "[TermsSync] Cloud user fetch result",
      "SessionHandlers",
      {
        cloudUserFound: !!cloudUser,
        cloudTermsAt: cloudUser?.terms_accepted_at || null,
      }
    );

    if (!freshUser && session.user.email) {
      // No local user exists - create one from session data
      // This syncs existing Supabase users to local SQLite (retroactive TASK-1507D fix)
      await logService.info(
        "Creating local user from existing session (TASK-1507E)",
        "SessionHandlers",
        { email: session.user.email }
      );

      try {
        // TASK-1507G: Pass Supabase Auth UUID as the user ID
        // This ensures local SQLite user ID matches Supabase for FK integrity
        freshUser = await databaseService.createUser({
          id: supabaseUserId,  // Use Supabase's authoritative UUID
          email: session.user.email,
          first_name: session.user.first_name,
          last_name: session.user.last_name,
          display_name:
            session.user.display_name ||
            session.user.email.split("@")[0],
          avatar_url: session.user.avatar_url,
          oauth_provider: session.provider || "google",
          oauth_id: session.user.oauth_id || session.user.id,
          subscription_tier: session.user.subscription_tier || "free",
          subscription_status: session.user.subscription_status || "trial",
          trial_ends_at: session.user.trial_ends_at,
          is_active: true,
        });

        await logService.info(
          "Local user created successfully from existing session",
          "SessionHandlers",
          { userId: freshUser.id }
        );

        // TASK-1809: Sync terms from cloud user (already fetched with retry)
        freshUser = await syncTermsFromCloudToLocal(freshUser, cloudUser);
      } catch (createError) {
        // Log but don't fail - auth should succeed even if local user creation fails
        await logService.error(
          "Failed to create local user from session",
          "SessionHandlers",
          {
            error: createError instanceof Error ? createError.message : "Unknown error",
          }
        );
      }
    } else if (freshUser && !freshUser.terms_accepted_at && cloudUser?.terms_accepted_at) {
      // TASK-1809: Existing local user missing terms, but cloud has them
      // This happens when user accepted terms to Supabase before local DB was initialized
      await logService.info(
        "[TermsSync] Existing user missing local terms, syncing from cloud",
        "SessionHandlers",
        {
          userId: freshUser.id.substring(0, 8) + "...",
          localTerms: !!freshUser.terms_accepted_at,
          cloudTerms: !!cloudUser.terms_accepted_at,
        }
      );
      freshUser = await syncTermsFromCloudToLocal(freshUser, cloudUser);
    }

    const user = freshUser || session.user;

    setSyncUserId(user.id);

    // TASK-1809: Pass cloud user to needsToAcceptTerms for fallback check
    // Even if local sync failed, we can still check cloud terms state
    const requiresTerms = needsToAcceptTerms(user, cloudUser);

    await logService.debug(
      "[TermsSync] Final terms check result",
      "SessionHandlers",
      {
        localTermsAt: user.terms_accepted_at || null,
        cloudTermsAt: cloudUser?.terms_accepted_at || null,
        requiresTerms,
      }
    );

    return {
      success: true,
      user,
      sessionToken: session.sessionToken,
      subscription: session.subscription,
      provider: session.provider,
      isNewUser: requiresTerms,
    };
  } catch (error) {
    await logService.error("Get current user failed", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Force logout - clears all sessions without requiring a session token
 * Used when the user is stuck (e.g., license blocked during login, can't switch accounts)
 *
 * Security note: This only clears LOCAL sessions on this device.
 * It cannot be used to log out other users or affect other devices.
 */
async function handleForceLogout(): Promise<AuthResponse> {
  try {
    await logService.info("Force logout initiated", "AuthHandlers");

    // 1. Clear Supabase session
    try {
      await supabaseService.signOut();
    } catch (supabaseError) {
      await logService.warn("Supabase signOut failed during force logout", "AuthHandlers", {
        error: supabaseError instanceof Error ? supabaseError.message : "Unknown error",
      });
      // Continue - local cleanup is still important
    }

    // 2. Clear local session file
    try {
      await sessionService.clearSession();
    } catch (sessionError) {
      await logService.warn("Session file clear failed during force logout", "AuthHandlers", {
        error: sessionError instanceof Error ? sessionError.message : "Unknown error",
      });
    }

    // 3. Clear database sessions (if database is initialized)
    try {
      if (databaseService.isInitialized()) {
        await databaseService.clearAllSessions();
      }
    } catch (dbError) {
      await logService.warn("Database session clear failed during force logout", "AuthHandlers", {
        error: dbError instanceof Error ? dbError.message : "Unknown error",
      });
    }

    // 4. Clear sync user ID
    setSyncUserId(null);

    await logService.info("Force logout completed successfully", "AuthHandlers");
    return { success: true };
  } catch (error) {
    await logService.error("Force logout failed", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Open broker portal auth page in the default browser
 * TASK-1507: Used for deep-link authentication flow
 * TASK-1510: Redirects to broker portal for provider selection (Google/Microsoft)
 */
async function handleOpenAuthInBrowser(): Promise<{ success: boolean; error?: string }> {
  try {
    // Use broker portal for provider selection page
    // Production: broker-portal-two.vercel.app, Dev: localhost:3001 (via .env.development)
    const brokerPortalUrl = process.env.BROKER_PORTAL_URL || 'https://broker-portal-two.vercel.app';
    const authUrl = `${brokerPortalUrl}/auth/desktop`;

    await logService.info("Opening auth URL in browser", "AuthHandlers", {
      url: authUrl,
    });

    await shell.openExternal(authUrl);
    return { success: true };
  } catch (error) {
    await logService.error("Failed to open auth in browser", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Register all session handlers
 */
export function registerSessionHandlers(): void {
  ipcMain.handle("auth:logout", handleLogout);
  ipcMain.handle("auth:force-logout", handleForceLogout);
  ipcMain.handle("auth:accept-terms", handleAcceptTerms);
  ipcMain.handle("auth:accept-terms-to-supabase", handleAcceptTermsToSupabase);
  ipcMain.handle("auth:complete-email-onboarding", handleCompleteEmailOnboarding);
  ipcMain.handle("auth:check-email-onboarding", handleCheckEmailOnboarding);
  ipcMain.handle("auth:validate-session", handleValidateSession);
  ipcMain.handle("auth:get-current-user", handleGetCurrentUser);
  // TASK-1507: Open browser for Supabase OAuth with deep-link callback
  ipcMain.handle("auth:open-in-browser", handleOpenAuthInBrowser);
}
