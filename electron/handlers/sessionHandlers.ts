/**
 * Session Handlers
 * Handles session management, validation, logout, terms acceptance, and email onboarding
 */

import { ipcMain, IpcMainInvokeEvent } from "electron";
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
 * Check if user needs to accept or re-accept terms
 */
function needsToAcceptTerms(user: User): boolean {
  if (!user.terms_accepted_at) {
    return true;
  }

  if (!user.terms_version_accepted && !user.privacy_policy_version_accepted) {
    return false;
  }

  if (
    user.terms_version_accepted &&
    user.terms_version_accepted !== CURRENT_TERMS_VERSION
  ) {
    return true;
  }

  if (
    user.privacy_policy_version_accepted &&
    user.privacy_policy_version_accepted !== CURRENT_PRIVACY_POLICY_VERSION
  ) {
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
 */
async function handleCheckEmailOnboarding(
  _event: IpcMainInvokeEvent,
  userId: string
): Promise<{ success: boolean; completed: boolean; error?: string }> {
  try {
    const validatedUserId = validateUserId(userId)!;

    const onboardingCompleted =
      await databaseService.hasCompletedEmailOnboarding(validatedUserId);

    let hasValidMailboxToken = false;
    if (onboardingCompleted) {
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
      hasValidMailboxToken = !!(googleToken || microsoftToken);

      if (!hasValidMailboxToken) {
        await logService.info(
          "Email onboarding was completed but no mailbox token found",
          "AuthHandlers",
          { userId: validatedUserId.substring(0, 8) + "..." }
        );
      }
    }

    const completed = onboardingCompleted && hasValidMailboxToken;

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
 * Get current user from saved session
 */
async function handleGetCurrentUser(): Promise<CurrentUserResponse> {
  try {
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

    const freshUser = await databaseService.getUserById(session.user.id);
    const user = freshUser || session.user;

    setSyncUserId(user.id);

    return {
      success: true,
      user,
      sessionToken: session.sessionToken,
      subscription: session.subscription,
      provider: session.provider,
      isNewUser: needsToAcceptTerms(user),
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
 * Register all session handlers
 */
export function registerSessionHandlers(): void {
  ipcMain.handle("auth:logout", handleLogout);
  ipcMain.handle("auth:accept-terms", handleAcceptTerms);
  ipcMain.handle("auth:accept-terms-to-supabase", handleAcceptTermsToSupabase);
  ipcMain.handle("auth:complete-email-onboarding", handleCompleteEmailOnboarding);
  ipcMain.handle("auth:check-email-onboarding", handleCheckEmailOnboarding);
  ipcMain.handle("auth:validate-session", handleValidateSession);
  ipcMain.handle("auth:get-current-user", handleGetCurrentUser);
}
