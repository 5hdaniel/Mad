/**
 * OTP Authentication Handlers
 * Handles passwordless login via email OTP (one-time password) code
 *
 * TASK-1337: Magic Link / OTP Login - Direct OTP entry in Electron app
 *
 * Flow:
 * 1. User enters email -> signInWithOtp sends 6-digit code
 * 2. User enters code -> verifyOtp validates and returns session
 * 3. Post-auth pipeline: license validation, device registration, session creation
 */

import { ipcMain, BrowserWindow, app } from "electron";

// Import services
import databaseService from "../services/databaseService";
import supabaseService from "../services/supabaseService";
import sessionService from "../services/sessionService";
import rateLimitService from "../services/rateLimitService";
import auditService from "../services/auditService";
import logService from "../services/logService";
import { validateLicense, createUserLicense } from "../services/licenseService";
import { registerDevice, getDeviceId } from "../services/deviceService";

// Import validation utilities
import { ValidationError, validateEmail } from "../utils/validation";

// Import constants
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_POLICY_VERSION,
} from "../constants/legalVersions";

// Import types
import type { User } from "../types/models";

// Type definitions
interface OtpSendCodeResponse {
  success: boolean;
  error?: string;
}

interface OtpVerifyCodeResponse {
  success: boolean;
  user?: User;
  sessionToken?: string;
  subscription?: import("../types/models").Subscription;
  isNewUser?: boolean;
  error?: string;
}

/**
 * Check if user needs to accept or re-accept terms
 * Returns true if user hasn't accepted OR if the accepted versions are outdated
 */
function needsToAcceptTerms(user: User): boolean {
  if (!user.terms_accepted_at) {
    return true;
  }

  // Backward compatibility: old system had no version tracking
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
 * OTP Auth: Send verification code to email
 *
 * Calls Supabase signInWithOtp without emailRedirectTo, which causes
 * Supabase to send a 6-digit code instead of a magic link URL.
 */
export async function handleOtpSendCode(
  _event: Electron.IpcMainInvokeEvent,
  email: string,
): Promise<OtpSendCodeResponse> {
  try {
    await logService.info("Starting OTP send code flow", "OtpAuthHandlers");

    // Validate email input
    const validatedEmail = validateEmail(email);
    if (!validatedEmail) {
      return {
        success: false,
        error: "Invalid email address",
      };
    }

    // Check rate limit
    const rateCheck = await rateLimitService.checkRateLimit(validatedEmail);
    if (!rateCheck.allowed) {
      await logService.warn("OTP send code rate limited", "OtpAuthHandlers", {
        email: validatedEmail,
      });
      return {
        success: false,
        error: "Too many attempts. Please try again later.",
      };
    }

    // Call Supabase signInWithOtp - omit emailRedirectTo to get 6-digit code
    const { error: otpError } = await supabaseService
      .getClient()
      .auth.signInWithOtp({
        email: validatedEmail,
      });

    if (otpError) {
      await logService.error("Supabase signInWithOtp failed", "OtpAuthHandlers", {
        error: otpError.message,
      });

      // Supabase rate limit error
      if (otpError.message?.includes("rate") || otpError.status === 429) {
        return {
          success: false,
          error: "Too many requests. Please wait before requesting another code.",
        };
      }

      return {
        success: false,
        error: otpError.message || "Failed to send verification code",
      };
    }

    await logService.info("OTP code sent successfully", "OtpAuthHandlers", {
      email: validatedEmail,
    });

    return { success: true };
  } catch (error) {
    await logService.error("OTP send code failed", "OtpAuthHandlers", {
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
      error: error instanceof Error ? error.message : "Failed to send code",
    };
  }
}

/**
 * OTP Auth: Verify the 6-digit code and complete login
 *
 * After successful verification, runs the full post-auth pipeline:
 * - Sync/create user in Supabase and local DB
 * - Validate license (create trial if new user)
 * - Register device
 * - Create session
 * - Track login event
 * - Audit log
 */
export async function handleOtpVerifyCode(
  _event: Electron.IpcMainInvokeEvent,
  email: string,
  token: string,
): Promise<OtpVerifyCodeResponse> {
  try {
    await logService.info("Starting OTP verify code flow", "OtpAuthHandlers");

    // Validate inputs
    const validatedEmail = validateEmail(email);
    if (!validatedEmail) {
      return {
        success: false,
        error: "Invalid email address",
      };
    }

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return {
        success: false,
        error: "Verification code is required",
      };
    }

    const trimmedToken = token.trim();

    // Validate OTP code format before API call
    if (!/^\d{6}$/.test(trimmedToken)) {
      return { success: false, error: "Verification code must be 6 digits" };
    }

    // Verify OTP with Supabase
    const { data: verifyData, error: verifyError } = await supabaseService
      .getClient()
      .auth.verifyOtp({
        email: validatedEmail,
        token: trimmedToken,
        type: "email",
      });

    if (verifyError || !verifyData?.session || !verifyData?.user) {
      await logService.error("Supabase verifyOtp failed", "OtpAuthHandlers", {
        error: verifyError?.message || "No session returned",
      });

      // Record failed attempt
      await rateLimitService.recordAttempt(validatedEmail, false);

      // Provide user-friendly error messages
      if (verifyError?.message?.includes("expired")) {
        return {
          success: false,
          error: "Code has expired. Please request a new one.",
        };
      }

      if (verifyError?.message?.includes("invalid") || verifyError?.message?.includes("Token")) {
        return {
          success: false,
          error: "Invalid verification code. Please try again.",
        };
      }

      return {
        success: false,
        error: verifyError?.message || "Verification failed",
      };
    }

    const supabaseUser = verifyData.user;
    const session = verifyData.session;

    await logService.info("OTP verification successful, running post-auth pipeline", "OtpAuthHandlers", {
      userId: supabaseUser.id,
    });

    // ==========================================
    // POST-AUTH PIPELINE
    // Order matches googleAuthHandlers.ts handleGoogleCompleteLogin:
    // sync user -> create/find local user -> validate license -> register device -> create session -> track event
    // ==========================================

    // Step 1: Sync user to Supabase cloud users table
    const userEmail = supabaseUser.email || validatedEmail;
    const cloudUser = await supabaseService.syncUser({
      email: userEmail,
      first_name: supabaseUser.user_metadata?.first_name,
      last_name: supabaseUser.user_metadata?.last_name,
      display_name: supabaseUser.user_metadata?.full_name || userEmail,
      avatar_url: supabaseUser.user_metadata?.avatar_url,
      oauth_provider: "email",
      oauth_id: supabaseUser.id,
    });

    // Step 2: Check if database is initialized
    if (!databaseService.isInitialized()) {
      await logService.info(
        "Database not initialized - OTP login deferred",
        "OtpAuthHandlers",
      );
      // Return minimal success so renderer can handle the pending state
      const pendingSubscription = await supabaseService.validateSubscription(cloudUser.id);
      return {
        success: true,
        subscription: pendingSubscription ?? undefined,
        isNewUser: true,
      };
    }

    // Step 3: Create or find user in local database
    let localUser = await databaseService.getUserByEmail(userEmail);
    const isNewUser = !localUser;

    if (!localUser) {
      // Use Supabase Auth UUID as local user ID (TASK-1507G pattern)
      localUser = await databaseService.createUser({
        id: cloudUser.id,
        email: userEmail,
        first_name: supabaseUser.user_metadata?.first_name,
        last_name: supabaseUser.user_metadata?.last_name,
        display_name: supabaseUser.user_metadata?.full_name || userEmail,
        avatar_url: supabaseUser.user_metadata?.avatar_url,
        oauth_provider: "email",
        oauth_id: supabaseUser.id,
        subscription_tier: cloudUser.subscription_tier,
        subscription_status: cloudUser.subscription_status,
        trial_ends_at: cloudUser.trial_ends_at,
        is_active: true,
      });
    } else {
      // Update existing user with cloud data
      await databaseService.updateUser(localUser.id, {
        email: userEmail,
        display_name: supabaseUser.user_metadata?.full_name || userEmail,
        avatar_url: supabaseUser.user_metadata?.avatar_url,
        subscription_tier: cloudUser.subscription_tier,
        subscription_status: cloudUser.subscription_status,
      });
    }

    if (!localUser) {
      throw new Error("Local user is unexpectedly null after creation/update");
    }

    // Step 4: Update last login
    await databaseService.updateLastLogin(localUser.id);
    const refreshedUser = await databaseService.getUserById(localUser.id);
    if (!refreshedUser) {
      throw new Error("Failed to retrieve user after update");
    }
    localUser = refreshedUser;

    // Step 5: Validate license
    let licenseStatus = await validateLicense(supabaseUser.id);

    // Create trial license if new user
    if (licenseStatus.blockReason === "no_license") {
      await logService.info("Creating trial license for new OTP user", "OtpAuthHandlers", {
        userId: supabaseUser.id,
      });
      licenseStatus = await createUserLicense(supabaseUser.id);
    }

    // Check if license blocks access
    if (!licenseStatus.isValid && licenseStatus.blockReason !== "no_license") {
      await logService.warn("License blocked for OTP user", "OtpAuthHandlers", {
        userId: supabaseUser.id,
        blockReason: licenseStatus.blockReason,
      });
      return {
        success: false,
        error: `Your license is ${licenseStatus.blockReason}. Please contact support.`,
      };
    }

    // Step 6: Register device
    const deviceResult = await registerDevice(supabaseUser.id);
    if (!deviceResult.success && deviceResult.error === "device_limit_reached") {
      await logService.warn("Device limit reached for OTP user", "OtpAuthHandlers", {
        userId: supabaseUser.id,
      });
      return {
        success: false,
        error: "Device limit reached. Please deactivate a device first.",
      };
    }

    // Step 7: Create session
    const sessionToken = await databaseService.createSession(localUser.id);

    // Save session to disk for persistence across app restarts
    await sessionService.saveSession({
      user: localUser,
      sessionToken,
      provider: "email",
      expiresAt: Date.now() + sessionService.getSessionExpirationMs(),
      createdAt: Date.now(),
      supabaseTokens: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
    });

    // Step 8: Validate subscription
    const subscription = await supabaseService.validateSubscription(cloudUser.id);

    // Step 9: Register device for event tracking (use stable machine ID)
    const stableDeviceId = getDeviceId();
    await supabaseService.trackEvent(
      cloudUser.id,
      "user_login",
      { provider: "email_otp" },
      stableDeviceId,
      app.getVersion(),
    );

    // Check if user needs to accept terms
    const needsTerms = isNewUser ? false : needsToAcceptTerms(localUser);

    await logService.info("OTP login completed successfully", "OtpAuthHandlers", {
      userId: localUser.id,
      isNewUser,
      provider: "email_otp",
    });

    // Step 10: Record successful login for rate limiting
    await rateLimitService.recordAttempt(validatedEmail, true);

    // Step 11: Audit log
    await auditService.log({
      userId: localUser.id,
      sessionId: sessionToken,
      action: "LOGIN",
      resourceType: "SESSION",
      resourceId: sessionToken,
      metadata: { provider: "email_otp", isNewUser },
      success: true,
    });

    return {
      success: true,
      user: localUser,
      sessionToken,
      subscription,
      isNewUser: isNewUser || needsTerms,
    };
  } catch (error) {
    await logService.error("OTP verify code failed", "OtpAuthHandlers", {
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
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Register all OTP authentication handlers
 */
export function registerOtpAuthHandlers(
  _mainWindow: BrowserWindow | null,
): void {
  // OTP Auth - Send code
  ipcMain.handle("auth:otp:send-code", handleOtpSendCode);

  // OTP Auth - Verify code
  ipcMain.handle(
    "auth:otp:verify-code",
    (event: Electron.IpcMainInvokeEvent, email: string, token: string) =>
      handleOtpVerifyCode(event, email, token),
  );
}
