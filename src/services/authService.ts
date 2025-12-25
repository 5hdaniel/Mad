/**
 * Auth Service
 *
 * Service abstraction for authentication-related API calls.
 * Centralizes all window.api.auth calls and provides type-safe wrappers.
 */

import type { User, Subscription } from "@/types";
import { type ApiResult, getErrorMessage } from "./index";

/**
 * Login result containing user and session info
 */
export interface LoginResult {
  user: User;
  sessionToken: string;
  subscription?: Subscription;
  isNewUser?: boolean;
}

/**
 * Pending login result (OAuth succeeded but DB not initialized)
 */
export interface PendingLoginResult {
  pendingLogin: boolean;
  oauthData: unknown;
}

/**
 * Session validation result
 */
export interface SessionValidation {
  valid: boolean;
  user?: User;
}

/**
 * Current user result
 */
export interface CurrentUserResult {
  user: User;
  sessionToken: string;
  subscription?: Subscription;
  provider?: string;
  isNewUser?: boolean;
}

/**
 * Mailbox token data for pending connections
 */
export interface PendingMailboxTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scopes: string;
}

/**
 * Auth Service
 * Provides a clean abstraction over window.api.auth
 */
export const authService = {
  // ============================================
  // LOGIN METHODS
  // ============================================

  /**
   * Initiate Google login flow
   */
  async googleLogin(): Promise<ApiResult<{ authUrl?: string }>> {
    try {
      const result = await window.api.auth.googleLogin();
      if (result.success) {
        return { success: true, data: { authUrl: result.authUrl } };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Complete Google login with authorization code
   */
  async googleCompleteLogin(code: string): Promise<ApiResult<LoginResult>> {
    try {
      const result = await window.api.auth.googleCompleteLogin(code);
      if (result.success && result.user && result.sessionToken) {
        return {
          success: true,
          data: {
            user: result.user,
            sessionToken: result.sessionToken,
            subscription: result.subscription,
            isNewUser: result.isNewUser,
          },
        };
      }
      return { success: false, error: result.error || "Login failed" };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Initiate Microsoft login flow
   */
  async microsoftLogin(): Promise<ApiResult<{ authUrl?: string }>> {
    try {
      const result = await window.api.auth.microsoftLogin();
      if (result.success) {
        return { success: true, data: { authUrl: result.authUrl } };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Complete Microsoft login with authorization code
   */
  async microsoftCompleteLogin(code: string): Promise<ApiResult<LoginResult>> {
    try {
      const result = await window.api.auth.microsoftCompleteLogin(code);
      if (result.success && result.user && result.sessionToken) {
        return {
          success: true,
          data: {
            user: result.user,
            sessionToken: result.sessionToken,
            subscription: result.subscription,
            isNewUser: result.isNewUser,
          },
        };
      }
      return { success: false, error: result.error || "Login failed" };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Complete pending login after keychain setup (login-first flow)
   */
  async completePendingLogin(oauthData: unknown): Promise<ApiResult<LoginResult>> {
    try {
      const result = await window.api.auth.completePendingLogin(oauthData);
      if (result.success && result.user && result.sessionToken) {
        return {
          success: true,
          data: {
            user: result.user,
            sessionToken: result.sessionToken,
            subscription: result.subscription,
            isNewUser: result.isNewUser,
          },
        };
      }
      return { success: false, error: result.error || "Login failed" };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ============================================
  // SESSION METHODS
  // ============================================

  /**
   * Logout the current session
   */
  async logout(sessionToken: string): Promise<ApiResult> {
    try {
      const result = await window.api.auth.logout(sessionToken);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Validate a session token
   */
  async validateSession(sessionToken: string): Promise<ApiResult<SessionValidation>> {
    try {
      const result = await window.api.auth.validateSession(sessionToken);
      return {
        success: true,
        data: {
          valid: result.valid,
          user: result.user,
        },
      };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Get the current authenticated user
   */
  async getCurrentUser(): Promise<ApiResult<CurrentUserResult>> {
    try {
      const result = await window.api.auth.getCurrentUser();
      if (result.success && result.user && result.sessionToken) {
        return {
          success: true,
          data: {
            user: result.user,
            sessionToken: result.sessionToken,
            subscription: result.subscription,
            provider: result.provider,
            isNewUser: result.isNewUser,
          },
        };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Accept terms of service
   */
  async acceptTerms(userId: string): Promise<ApiResult> {
    try {
      const result = await window.api.auth.acceptTerms(userId);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ============================================
  // MAILBOX CONNECTION METHODS
  // ============================================

  /**
   * Connect Google mailbox for an authenticated user
   */
  async googleConnectMailbox(userId: string): Promise<ApiResult> {
    try {
      const result = await window.api.auth.googleConnectMailbox(userId);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Connect Microsoft mailbox for an authenticated user
   */
  async microsoftConnectMailbox(userId: string): Promise<ApiResult> {
    try {
      const result = await window.api.auth.microsoftConnectMailbox(userId);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Disconnect Google mailbox
   */
  async googleDisconnectMailbox(userId: string): Promise<ApiResult> {
    try {
      const result = await window.api.auth.googleDisconnectMailbox(userId);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Disconnect Microsoft mailbox
   */
  async microsoftDisconnectMailbox(userId: string): Promise<ApiResult> {
    try {
      const result = await window.api.auth.microsoftDisconnectMailbox(userId);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  // ============================================
  // PENDING MAILBOX METHODS (Pre-DB)
  // ============================================

  /**
   * Connect Google mailbox before DB initialization (returns tokens)
   */
  async googleConnectMailboxPending(emailHint?: string): Promise<ApiResult> {
    try {
      const result = await window.api.auth.googleConnectMailboxPending(emailHint);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Connect Microsoft mailbox before DB initialization (returns tokens)
   */
  async microsoftConnectMailboxPending(emailHint?: string): Promise<ApiResult> {
    try {
      const result = await window.api.auth.microsoftConnectMailboxPending(emailHint);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Save pending mailbox tokens after DB initialization
   */
  async savePendingMailboxTokens(data: {
    userId: string;
    provider: "google" | "microsoft";
    email: string;
    tokens: PendingMailboxTokens;
  }): Promise<ApiResult> {
    try {
      const result = await window.api.auth.savePendingMailboxTokens(data);
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};

export default authService;
