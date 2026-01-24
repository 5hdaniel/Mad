/**
 * Authentication Bridge
 * Handles user authentication, OAuth flows, and session management
 */

import { ipcRenderer } from "electron";

export const authBridge = {
  /**
   * Initiates Google OAuth login flow
   * @returns Login initiation result
   */
  googleLogin: () => ipcRenderer.invoke("auth:google:login"),

  /**
   * Completes Google OAuth login with authorization code
   * @param code - OAuth authorization code from Google
   * @returns Login completion result
   */
  googleCompleteLogin: (code: string) =>
    ipcRenderer.invoke("auth:google:complete-login", code),

  /**
   * Initiates Microsoft OAuth login flow
   * @returns Login initiation result
   */
  microsoftLogin: () => ipcRenderer.invoke("auth:microsoft:login"),

  /**
   * Completes Microsoft OAuth login with authorization code
   * @param code - OAuth authorization code from Microsoft
   * @returns Login completion result
   */
  microsoftCompleteLogin: (code: string) =>
    ipcRenderer.invoke("auth:microsoft:complete-login", code),

  /**
   * Connects Google mailbox for a logged-in user
   * @param userId - User ID to connect mailbox for
   * @returns Connection result
   */
  googleConnectMailbox: (userId: string) =>
    ipcRenderer.invoke("auth:google:connect-mailbox", userId),

  /**
   * Connects Microsoft mailbox for a logged-in user
   * @param userId - User ID to connect mailbox for
   * @returns Connection result
   */
  microsoftConnectMailbox: (userId: string) =>
    ipcRenderer.invoke("auth:microsoft:connect-mailbox", userId),

  /**
   * Disconnects Google mailbox for a logged-in user
   * @param userId - User ID to disconnect mailbox for
   * @returns Disconnection result
   */
  googleDisconnectMailbox: (userId: string) =>
    ipcRenderer.invoke("auth:google:disconnect-mailbox", userId),

  /**
   * Disconnects Microsoft mailbox for a logged-in user
   * @param userId - User ID to disconnect mailbox for
   * @returns Disconnection result
   */
  microsoftDisconnectMailbox: (userId: string) =>
    ipcRenderer.invoke("auth:microsoft:disconnect-mailbox", userId),

  /**
   * Logs out the current user and invalidates session
   * @param sessionToken - Session token to invalidate
   * @returns Logout result
   */
  logout: (sessionToken: string) =>
    ipcRenderer.invoke("auth:logout", sessionToken),

  /**
   * Validates an existing session token
   * @param sessionToken - Session token to validate
   * @returns Validation result
   */
  validateSession: (sessionToken: string) =>
    ipcRenderer.invoke("auth:validate-session", sessionToken),

  /**
   * Gets the currently authenticated user
   * @returns Current user data
   */
  getCurrentUser: () => ipcRenderer.invoke("auth:get-current-user"),

  /**
   * Records user's acceptance of terms and conditions
   * @param userId - User ID accepting terms
   * @returns Acceptance result
   */
  acceptTerms: (userId: string) =>
    ipcRenderer.invoke("auth:accept-terms", userId),

  /**
   * Accept terms directly to Supabase (pre-DB onboarding flow)
   * Used when user accepts terms before local database is initialized
   * @param userId - User ID accepting terms
   * @returns Acceptance result
   */
  acceptTermsToSupabase: (userId: string) =>
    ipcRenderer.invoke("auth:accept-terms-to-supabase", userId),

  /**
   * Marks email onboarding as completed for a user
   * @param userId - User ID completing email onboarding
   * @returns Completion result
   */
  completeEmailOnboarding: (userId: string) =>
    ipcRenderer.invoke("auth:complete-email-onboarding", userId),

  /**
   * Checks if user has completed email onboarding
   * @param userId - User ID to check
   * @returns Onboarding status
   */
  checkEmailOnboarding: (userId: string) =>
    ipcRenderer.invoke("auth:check-email-onboarding", userId),

  /**
   * Completes a pending login after keychain/database setup
   * Called when OAuth succeeded but database wasn't initialized yet
   * @param oauthData - The pending OAuth data from login-pending event
   * @returns Login completion result
   */
  completePendingLogin: (oauthData: unknown) =>
    ipcRenderer.invoke("auth:complete-pending-login", oauthData),

  /**
   * Pre-DB Google mailbox connection (returns tokens instead of saving to DB)
   * Used during onboarding before database is initialized
   * @param emailHint - Optional email hint for pre-filling the login
   * @returns Connection initiation result
   */
  googleConnectMailboxPending: (emailHint?: string) =>
    ipcRenderer.invoke("auth:google:connect-mailbox-pending", emailHint),

  /**
   * Pre-DB Microsoft mailbox connection (returns tokens instead of saving to DB)
   * Used during onboarding before database is initialized
   * @param emailHint - Optional email hint for pre-filling the login
   * @returns Connection initiation result
   */
  microsoftConnectMailboxPending: (emailHint?: string) =>
    ipcRenderer.invoke("auth:microsoft:connect-mailbox-pending", emailHint),

  /**
   * Saves pending mailbox tokens after database is initialized
   * @param data - Token data including userId, provider, email, and tokens
   * @returns Save result
   */
  savePendingMailboxTokens: (data: {
    userId: string;
    provider: "google" | "microsoft";
    email: string;
    tokens: {
      access_token: string;
      refresh_token: string | null;
      expires_at: string;
      scopes: string;
    };
  }) => ipcRenderer.invoke("auth:save-pending-mailbox-tokens", data),

  /**
   * DEV ONLY: Expire a mailbox token for testing Connection Issue state
   * @param userId - User ID
   * @param provider - OAuth provider (google | microsoft)
   */
  devExpireMailboxToken: (userId: string, provider: "google" | "microsoft") =>
    ipcRenderer.invoke("auth:dev:expire-mailbox-token", userId, provider),
};
