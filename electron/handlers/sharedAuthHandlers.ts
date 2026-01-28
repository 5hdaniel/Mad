/**
 * Shared Authentication Handlers
 * Handles cross-provider auth operations like pending login completion,
 * mailbox token management, and disconnection
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from "electron";
import os from "os";
import crypto from "crypto";
import { app } from "electron";
import type {
  User,
  Subscription,
  SubscriptionTier,
  SubscriptionStatus,
} from "../types/models";

// Import services
import databaseService from "../services/databaseService";
import supabaseService from "../services/supabaseService";
import auditService from "../services/auditService";
import logService from "../services/logService";
import sessionService from "../services/sessionService";
import { setSyncUserId } from "../sync-handlers";

// Import validation utilities
import { getValidUserId } from "../utils/userIdHelper";

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

interface LoginCompleteResponse extends AuthResponse {
  user?: User;
  sessionToken?: string;
  subscription?: Subscription;
  isNewUser?: boolean;
}

/**
 * Complete a pending login after keychain setup
 */
export async function handleCompletePendingLogin(
  _event: IpcMainInvokeEvent,
  oauthData: {
    provider: "google" | "microsoft";
    userInfo: {
      id: string;
      email: string;
      given_name?: string;
      family_name?: string;
      name?: string;
      picture?: string;
    };
    tokens: {
      access_token: string;
      refresh_token: string | null;
      expires_at?: string;
      expires_in?: number;
      scopes?: string[];
      scope?: string;
    };
    cloudUser: {
      id: string;
      subscription_tier?: SubscriptionTier;
      subscription_status?: SubscriptionStatus;
      trial_ends_at?: string;
      terms_accepted_at?: string;
      privacy_policy_accepted_at?: string;
      terms_version_accepted?: string;
      privacy_policy_version_accepted?: string;
      email_onboarding_completed_at?: string;
    };
    subscription?: Subscription;
  }
): Promise<LoginCompleteResponse> {
  try {
    await logService.info(
      `Completing pending ${oauthData.provider} login after keychain setup`,
      "AuthHandlers"
    );

    const { provider, userInfo, tokens, cloudUser, subscription } = oauthData;

    let localUser = await databaseService.getUserByOAuthId(
      provider,
      userInfo.id
    );
    const isNewUser = !localUser;

    if (!localUser) {
      // TASK-1507G: Use Supabase Auth UUID as local user ID for unified IDs
      localUser = await databaseService.createUser({
        id: cloudUser.id,
        email: userInfo.email,
        first_name: userInfo.given_name,
        last_name: userInfo.family_name,
        display_name: userInfo.name,
        avatar_url: userInfo.picture,
        oauth_provider: provider,
        oauth_id: userInfo.id,
        subscription_tier: cloudUser.subscription_tier ?? "free",
        subscription_status: cloudUser.subscription_status ?? "trial",
        trial_ends_at: cloudUser.trial_ends_at,
        is_active: true,
      });
    } else {
      await databaseService.updateUser(localUser.id, {
        email: userInfo.email,
        first_name: userInfo.given_name,
        last_name: userInfo.family_name,
        display_name: userInfo.name,
        avatar_url: userInfo.picture,
        ...(cloudUser.terms_accepted_at && {
          terms_accepted_at: cloudUser.terms_accepted_at,
          terms_version_accepted: cloudUser.terms_version_accepted,
        }),
        ...(cloudUser.privacy_policy_accepted_at && {
          privacy_policy_accepted_at: cloudUser.privacy_policy_accepted_at,
          privacy_policy_version_accepted:
            cloudUser.privacy_policy_version_accepted,
        }),
        ...(cloudUser.email_onboarding_completed_at && {
          email_onboarding_completed_at:
            cloudUser.email_onboarding_completed_at,
        }),
        subscription_tier: cloudUser.subscription_tier ?? "free",
        subscription_status: cloudUser.subscription_status ?? "trial",
      });

      // Bidirectional sync
      if (localUser.terms_accepted_at && !cloudUser.terms_accepted_at) {
        try {
          await supabaseService.syncTermsAcceptance(
            cloudUser.id,
            localUser.terms_version_accepted || CURRENT_TERMS_VERSION,
            localUser.privacy_policy_version_accepted ||
              CURRENT_PRIVACY_POLICY_VERSION
          );
        } catch (syncError) {
          await logService.error(
            "Failed to sync local terms to cloud",
            "AuthHandlers",
            {
              error:
                syncError instanceof Error
                  ? syncError.message
                  : "Unknown error",
            }
          );
        }
      }
    }

    if (!localUser) {
      throw new Error("Local user is unexpectedly null");
    }

    await databaseService.updateLastLogin(localUser.id);
    const refreshedUser = await databaseService.getUserById(localUser.id);
    if (!refreshedUser) {
      throw new Error("Failed to retrieve user after update");
    }
    localUser = refreshedUser;

    const expiresAt = tokens.expires_at
      ? tokens.expires_at
      : tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString();

    await databaseService.saveOAuthToken(
      localUser.id,
      provider,
      "authentication",
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? undefined,
        token_expires_at: expiresAt,
        scopes_granted: tokens.scopes
          ? tokens.scopes.join(" ")
          : tokens.scope || "",
      }
    );

    const sessionToken = await databaseService.createSession(localUser.id);

    // Save session to file for persistence across app restarts
    await sessionService.saveSession({
      user: localUser,
      sessionToken,
      provider,
      subscription,
      expiresAt: Date.now() + sessionService.getSessionExpirationMs(),
      createdAt: Date.now(),
    });

    const deviceInfo = {
      device_id: crypto.randomUUID(),
      device_name: os.hostname(),
      os: os.platform() + " " + os.release(),
      app_version: app.getVersion(),
    };
    await supabaseService.registerDevice(cloudUser.id, deviceInfo);

    await supabaseService.trackEvent(
      cloudUser.id,
      "user_login",
      { provider },
      deviceInfo.device_id,
      app.getVersion()
    );

    await auditService.log({
      userId: localUser.id,
      action: "LOGIN",
      resourceType: "SESSION",
      resourceId: sessionToken,
      metadata: { provider, isNewUser, pendingLogin: true },
      success: true,
    });

    await logService.info(
      `Pending ${provider} login completed successfully`,
      "AuthHandlers",
      { userId: localUser.id }
    );

    setSyncUserId(localUser.id);

    return {
      success: true,
      user: localUser,
      sessionToken,
      subscription,
      isNewUser,
    };
  } catch (error) {
    await logService.error("Failed to complete pending login", "AuthHandlers", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Save pending mailbox tokens after database is initialized
 */
export async function handleSavePendingMailboxTokens(
  _event: IpcMainInvokeEvent,
  data: {
    userId: string;
    provider: "google" | "microsoft";
    email: string;
    tokens: {
      access_token: string;
      refresh_token: string | null;
      expires_at: string;
      scopes: string;
    };
  }
): Promise<AuthResponse> {
  try {
    await logService.info(
      `Saving pending ${data.provider} mailbox tokens`,
      "AuthHandlers",
      { userId: data.userId, email: data.email }
    );

    // BACKLOG-551: Validate user ID exists in local DB (handles Supabase auth.uid() mismatch)
    const validatedUserId = await getValidUserId(data.userId, "SharedAuth");
    if (!validatedUserId) {
      return {
        success: false,
        error: "No user found in database. Please log in first.",
      };
    }

    await databaseService.saveOAuthToken(
      validatedUserId,
      data.provider,
      "mailbox",
      {
        access_token: data.tokens.access_token,
        refresh_token: data.tokens.refresh_token ?? undefined,
        token_expires_at: data.tokens.expires_at,
        scopes_granted: data.tokens.scopes,
        connected_email_address: data.email,
        mailbox_connected: true,
      }
    );

    await logService.info(
      `Pending ${data.provider} mailbox tokens saved`,
      "AuthHandlers",
      { userId: validatedUserId }
    );

    await auditService.log({
      userId: validatedUserId,
      action: "MAILBOX_CONNECT",
      resourceType: "MAILBOX",
      metadata: { provider: data.provider, email: data.email, pending: true },
      success: true,
    });

    return { success: true };
  } catch (error) {
    await logService.error(
      "Failed to save pending mailbox tokens",
      "AuthHandlers",
      { error: error instanceof Error ? error.message : "Unknown error" }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Disconnect mailbox (remove OAuth token for mailbox purpose)
 */
export async function handleDisconnectMailbox(
  mainWindow: BrowserWindow | null,
  userId: string,
  provider: "google" | "microsoft"
): Promise<AuthResponse> {
  try {
    await logService.info(
      `Starting ${provider} mailbox disconnect`,
      "AuthHandlers",
      { userId }
    );

    // BACKLOG-551: Validate user ID exists in local DB (handles Supabase auth.uid() mismatch)
    const validatedUserId = await getValidUserId(userId, "SharedAuth");
    if (!validatedUserId) {
      return {
        success: false,
        error: "No user found in database. Please log in first.",
      };
    }

    await databaseService.deleteOAuthToken(
      validatedUserId,
      provider,
      "mailbox"
    );

    await logService.info(
      `${provider} mailbox disconnected successfully`,
      "AuthHandlers",
      { userId: validatedUserId }
    );

    await auditService.log({
      userId: validatedUserId,
      action: "MAILBOX_DISCONNECT",
      resourceType: "MAILBOX",
      metadata: { provider },
      success: true,
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`${provider}:mailbox-disconnected`, {
        success: true,
      });
    }

    return { success: true };
  } catch (error) {
    await logService.error(
      `${provider} mailbox disconnect failed`,
      "AuthHandlers",
      {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );

    // Use original userId for error logging since validatedUserId may not exist
    await auditService.log({
      userId: userId || "unknown",
      action: "MAILBOX_DISCONNECT",
      resourceType: "MAILBOX",
      metadata: { provider },
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Register shared auth handlers
 */
export function registerSharedAuthHandlers(
  mainWindow: BrowserWindow | null
): void {
  ipcMain.handle("auth:complete-pending-login", handleCompletePendingLogin);
  ipcMain.handle("auth:save-pending-mailbox-tokens", handleSavePendingMailboxTokens);

  ipcMain.handle("auth:google:disconnect-mailbox", (event, userId: string) =>
    handleDisconnectMailbox(mainWindow, userId, "google")
  );

  ipcMain.handle("auth:microsoft:disconnect-mailbox", (event, userId: string) =>
    handleDisconnectMailbox(mainWindow, userId, "microsoft")
  );

  // DEV ONLY: Expire a mailbox token for testing Connection Issue state
  // This invalidates both access and refresh tokens to prevent auto-refresh
  ipcMain.handle(
    "auth:dev:expire-mailbox-token",
    async (_event, userId: string, provider: "google" | "microsoft") => {
      try {
        const token = await databaseService.getOAuthToken(userId, provider, "mailbox");
        if (!token) {
          return { success: false, error: "No token found" };
        }
        // Set expiry to 1 hour ago and clear refresh token to prevent auto-refresh
        const expiredTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        await databaseService.updateOAuthToken(token.id, {
          token_expires_at: expiredTime,
          refresh_token: "INVALIDATED_FOR_TESTING",
          access_token: "EXPIRED_FOR_TESTING",
        });
        await logService.info(
          `[DEV] Expired ${provider} mailbox token for testing (refresh invalidated)`,
          "SharedAuthHandlers",
          { userId, expiredTime }
        );
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // DEV ONLY: Reset onboarding for testing the onboarding flow
  // This clears email_onboarding_completed_at and mobile_phone_type
  ipcMain.handle(
    "auth:dev:reset-onboarding",
    async (_event, userId: string) => {
      try {
        await logService.info(
          `[Auth] DEV: Resetting onboarding for user ${userId}`,
          "AuthHandlers"
        );

        // Use raw SQL to set fields to NULL (updateUser doesn't support null values)
        const db = databaseService.getRawDatabase();
        db.prepare(
          "UPDATE users_local SET email_onboarding_completed_at = NULL, mobile_phone_type = NULL WHERE id = ?"
        ).run(userId);

        await logService.info(
          `[Auth] DEV: Onboarding reset complete for user ${userId}`,
          "AuthHandlers"
        );

        return { success: true };
      } catch (error) {
        await logService.error(
          "[Auth] DEV: Failed to reset onboarding",
          "AuthHandlers",
          { error: String(error) }
        );
        return { success: false, error: String(error) };
      }
    }
  );
}
