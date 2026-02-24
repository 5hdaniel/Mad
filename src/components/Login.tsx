/**
 * Login Component
 * Handles user authentication via Google or Microsoft OAuth
 * Two-step flow: Login first, connect mailboxes later
 *
 * When database is not initialized (no keychain access yet), the login handlers
 * will emit a "pending" event instead of "complete". This allows the parent
 * to show the keychain explanation screen before completing the login.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { User, Subscription } from "../../electron/types/models";
import logger from '../utils/logger';

// TASK-2044: Login retry configuration
const LOGIN_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  /** Timeout for waiting for deep link callback (ms) */
  callbackTimeoutMs: 60000,
  /** Error codes from deep link that should NOT trigger retry */
  nonRetryableCodes: ["MISSING_TOKENS", "INVALID_TOKENS", "INVALID_URL"],
} as const;

// Type for pending OAuth data
export interface PendingOAuthData {
  provider: "google" | "microsoft";
  userInfo: { id: string; email: string; name?: string; picture?: string };
  tokens: {
    access_token: string;
    refresh_token: string | null;
    expires_at: string;
    scopes: string[];
  };
  cloudUser: {
    id: string;
    subscription_tier?: string;
    trial_ends_at?: string;
    email?: string;
    terms_accepted_at?: string;
    privacy_policy_accepted_at?: string;
  };
  subscription?: { tier?: string; status?: string; trial_ends_at?: string };
}

// TASK-1507: Deep link auth callback data types
export interface DeepLinkAuthData {
  accessToken: string;
  refreshToken: string;
  userId?: string;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
  provider?: string; // "google" | "azure" | etc from Supabase app_metadata
  licenseStatus?: {
    isValid: boolean;
    licenseType: "trial" | "individual" | "team";
    trialDaysRemaining?: number;
    transactionCount: number;
    transactionLimit: number;
    canCreateTransaction: boolean;
    deviceCount: number;
    deviceLimit: number;
    aiEnabled: boolean;
    blockReason?: string;
  };
  isNewUser?: boolean; // BACKLOG-546: Based on terms acceptance, not transaction count
}

interface LoginProps {
  onLoginSuccess: (
    user: User,
    sessionToken: string,
    provider: string,
    subscription: Subscription,
    isNewUser: boolean,
  ) => void;
  onLoginPending?: (oauthData: PendingOAuthData) => void;
  /** TASK-1507: Called when deep link auth succeeds with license/device validation */
  onDeepLinkAuthSuccess?: (data: DeepLinkAuthData) => void;
  /** TASK-1507: Called when license is blocked (expired/suspended) */
  onLicenseBlocked?: (data: { userId: string; blockReason: string }) => void;
  /** TASK-1507: Called when device limit is reached */
  onDeviceLimitReached?: (data: { userId: string; deviceCount: number; deviceLimit: number }) => void;
}

const Login = ({
  onLoginSuccess,
  onLoginPending,
  onDeepLinkAuthSuccess,
  onLicenseBlocked,
  onDeviceLimitReached,
}: LoginProps) => {
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [provider, setProvider] = useState<"google" | "microsoft" | "browser" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [popupCancelled, setPopupCancelled] = useState(false);
  // TASK-1507: Track when browser auth is in progress
  const [browserAuthInProgress, setBrowserAuthInProgress] = useState(false);

  // TASK-2044: Retry state for browser auth
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retriesExhausted, setRetriesExhausted] = useState(false);
  const callbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==========================================
  // TASK-2044: Retry timer cleanup
  // ==========================================

  /**
   * Clear all retry-related timers to prevent duplicate sessions
   */
  const clearRetryTimers = useCallback(() => {
    if (callbackTimeoutRef.current) {
      clearTimeout(callbackTimeoutRef.current);
      callbackTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  /**
   * Reset all retry state back to initial values
   */
  const resetRetryState = useCallback(() => {
    clearRetryTimers();
    setRetryAttempt(0);
    setIsRetrying(false);
    setRetriesExhausted(false);
  }, [clearRetryTimers]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearRetryTimers();
    };
  }, [clearRetryTimers]);

  // ==========================================
  // TASK-1507: Deep Link Event Handlers
  // ==========================================

  /**
   * Handle successful deep link auth callback
   * Called when browser OAuth completes and returns via magicaudit://callback
   */
  const handleDeepLinkSuccess = useCallback((data: DeepLinkAuthData) => {
    logger.debug("[Login] Deep link auth success:", data.userId);
    clearRetryTimers();
    setBrowserAuthInProgress(false);
    setLoading(false);
    setProvider(null);
    resetRetryState();

    if (onDeepLinkAuthSuccess) {
      onDeepLinkAuthSuccess(data);
    }
  }, [onDeepLinkAuthSuccess, clearRetryTimers, resetRetryState]);

  /**
   * Handle deep link auth error
   * TASK-2044: Enhanced with auto-retry for retryable errors
   * Called when browser OAuth fails or returns invalid tokens
   */
  const handleDeepLinkError = useCallback((data: { error: string; code: string }) => {
    logger.error(`[Login] Deep link auth error (attempt ${retryAttempt + 1}):`, data);
    clearRetryTimers();

    // Check if this is a non-retryable error
    const isNonRetryable = LOGIN_RETRY_CONFIG.nonRetryableCodes.includes(
      data.code as typeof LOGIN_RETRY_CONFIG.nonRetryableCodes[number]
    );

    if (isNonRetryable || retryAttempt >= LOGIN_RETRY_CONFIG.maxRetries) {
      // Non-retryable error or max retries reached: show error + "Try again" button
      logger.warn(
        `[Login] ${isNonRetryable ? "Non-retryable error" : "Max retries reached"} -- stopping auto-retry`
      );
      setBrowserAuthInProgress(false);
      setLoading(false);
      setIsRetrying(false);
      if (!isNonRetryable) {
        setRetriesExhausted(true);
      }
      setError(
        isNonRetryable
          ? data.error || "Browser authentication failed"
          : "Login failed after multiple attempts. Please check your connection and try again."
      );
      return;
    }

    // Retryable error: auto-retry with exponential backoff
    const nextAttempt = retryAttempt + 1;
    const delay = Math.min(
      LOGIN_RETRY_CONFIG.baseDelayMs * Math.pow(2, retryAttempt),
      LOGIN_RETRY_CONFIG.maxDelayMs
    );

    logger.info(
      `[Login] Retrying browser auth (attempt ${nextAttempt + 1}/${LOGIN_RETRY_CONFIG.maxRetries + 1}) in ${delay}ms`
    );

    setRetryAttempt(nextAttempt);
    setIsRetrying(true);
    setError(null);

    // Schedule retry after backoff delay
    retryTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await window.api.auth.openAuthInBrowser();
        if (!result.success) {
          // If opening browser itself fails, treat as exhausted
          setIsRetrying(false);
          setBrowserAuthInProgress(false);
          setLoading(false);
          setRetriesExhausted(true);
          setError(result.error || "Failed to open browser for authentication");
        } else {
          // Browser opened, start callback timeout for this retry attempt
          setIsRetrying(false);
          callbackTimeoutRef.current = setTimeout(() => {
            logger.warn(`[Login] Deep link callback timeout on retry attempt ${nextAttempt + 1}`);
            // Trigger the error handler again (which may retry or give up)
            handleDeepLinkError({ error: "Authentication timed out", code: "UNKNOWN_ERROR" });
          }, LOGIN_RETRY_CONFIG.callbackTimeoutMs);
        }
      } catch (err) {
        logger.error("[Login] Retry browser open failed:", err);
        setIsRetrying(false);
        setBrowserAuthInProgress(false);
        setLoading(false);
        setRetriesExhausted(true);
        setError("Failed to retry authentication");
      }
    }, delay);
  }, [retryAttempt, clearRetryTimers]);

  /**
   * Handle license blocked event
   * Called when user authenticates but license is expired/suspended
   */
  const handleLicenseBlocked = useCallback((data: {
    userId: string;
    blockReason: string;
    licenseStatus: unknown;
  }) => {
    logger.warn("[Login] License blocked:", data.blockReason);
    clearRetryTimers();
    resetRetryState();
    setBrowserAuthInProgress(false);
    setLoading(false);
    setProvider(null);

    if (onLicenseBlocked) {
      onLicenseBlocked({ userId: data.userId, blockReason: data.blockReason });
    } else {
      // Default handling if no callback provided
      setError(`Your license is ${data.blockReason}. Please contact support.`);
    }
  }, [onLicenseBlocked, clearRetryTimers, resetRetryState]);

  /**
   * Handle device limit reached event
   * Called when user authenticates but device registration fails
   */
  const handleDeviceLimit = useCallback((data: {
    userId: string;
    licenseStatus: {
      deviceCount: number;
      deviceLimit: number;
    };
  }) => {
    logger.warn("[Login] Device limit reached");
    clearRetryTimers();
    resetRetryState();
    setBrowserAuthInProgress(false);
    setLoading(false);
    setProvider(null);

    if (onDeviceLimitReached) {
      onDeviceLimitReached({
        userId: data.userId,
        deviceCount: data.licenseStatus.deviceCount,
        deviceLimit: data.licenseStatus.deviceLimit,
      });
    } else {
      // Default handling if no callback provided
      setError(`Device limit reached (${data.licenseStatus.deviceCount}/${data.licenseStatus.deviceLimit}). Please deactivate a device first.`);
    }
  }, [onDeviceLimitReached, clearRetryTimers, resetRetryState]);

  /**
   * Set up deep link event listeners
   * Per SR Engineer review: Add listeners directly to Login.tsx, not a separate hook
   */
  useEffect(() => {
    // Set up listeners for deep link events
    const cleanups: (() => void)[] = [];

    if (window.api.onDeepLinkAuthCallback) {
      cleanups.push(window.api.onDeepLinkAuthCallback(handleDeepLinkSuccess));
    }

    if (window.api.onDeepLinkAuthError) {
      cleanups.push(window.api.onDeepLinkAuthError(handleDeepLinkError));
    }

    if (window.api.onDeepLinkLicenseBlocked) {
      cleanups.push(window.api.onDeepLinkLicenseBlocked(handleLicenseBlocked));
    }

    if (window.api.onDeepLinkDeviceLimit) {
      cleanups.push(window.api.onDeepLinkDeviceLimit(handleDeviceLimit));
    }

    // Cleanup on unmount
    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [handleDeepLinkSuccess, handleDeepLinkError, handleLicenseBlocked, handleDeviceLimit]);

  /**
   * Handle Browser Sign In (Deep Link Flow)
   * TASK-1507: Opens Supabase auth in default browser, returns via deep link
   */
  const handleBrowserLogin = async () => {
    // TASK-2044: Clear any previous retry timers before starting fresh
    clearRetryTimers();

    setLoading(true);
    setError(null);
    setProvider("browser");
    setBrowserAuthInProgress(true);
    setPopupCancelled(false);
    setRetriesExhausted(false);

    try {
      const result = await window.api.auth.openAuthInBrowser();

      if (!result.success) {
        setError(result.error || "Failed to open browser for authentication");
        setLoading(false);
        setProvider(null);
        setBrowserAuthInProgress(false);
      } else {
        // TASK-2044: Start callback timeout -- if deep link never fires, trigger retry
        callbackTimeoutRef.current = setTimeout(() => {
          logger.warn("[Login] Deep link callback timeout -- triggering retry logic");
          handleDeepLinkError({ error: "Authentication timed out", code: "UNKNOWN_ERROR" });
        }, LOGIN_RETRY_CONFIG.callbackTimeoutMs);
      }
    } catch (err) {
      logger.error("Browser login error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start browser login";
      setError(errorMessage);
      setLoading(false);
      setProvider(null);
      setBrowserAuthInProgress(false);
    }
  };

  /**
   * Handle Google Sign In (Redirect Flow)
   * Popup window opens, user logs in, redirects to local server, app handles automatically
   *
   * Two possible outcomes:
   * 1. login-complete: Database was initialized, user was saved locally
   * 2. login-pending: Database not initialized, need keychain setup first
   */
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setProvider("google");
    setPopupCancelled(false);

    // Listen for login completion from main process
    let cleanupComplete: (() => void) | undefined;
    let cleanupPending: (() => void) | undefined;
    let cleanupCancelled: (() => void) | undefined;

    const cleanup = () => {
      if (cleanupComplete) cleanupComplete();
      if (cleanupPending) cleanupPending();
      if (cleanupCancelled) cleanupCancelled();
    };

    if (window.api.onGoogleLoginComplete) {
      cleanupComplete = window.api.onGoogleLoginComplete((result) => {
        if (
          result.success &&
          result.user &&
          result.sessionToken &&
          result.subscription &&
          onLoginSuccess
        ) {
          onLoginSuccess(
            result.user,
            result.sessionToken,
            "google",
            result.subscription,
            result.isNewUser || false,
          );
        } else if (!result.pendingLogin) {
          // Only show error if this isn't a pending login (handled by pending listener)
          setError(result.error || "Failed to complete Google login");
          setLoading(false);
          setProvider(null);
        }

        // Clean up listeners after handling the event
        cleanup();
      });
    }

    // Listen for pending login (OAuth succeeded but database not initialized)
    if (window.api.onGoogleLoginPending && onLoginPending) {
      cleanupPending = window.api.onGoogleLoginPending((result) => {
        if (result.success && result.pendingLogin && result.oauthData) {
          // OAuth succeeded but need keychain setup - pass data to parent
          onLoginPending(result.oauthData as PendingOAuthData);
        } else {
          setError(result.error || "Failed to complete Google login");
          setLoading(false);
          setProvider(null);
        }

        // Clean up listeners
        cleanup();
      });
    }

    // Listen for popup cancelled (user closed popup window)
    if (window.api.onGoogleLoginCancelled) {
      cleanupCancelled = window.api.onGoogleLoginCancelled(() => {
        setPopupCancelled(true);
        cleanup();
      });
    }

    try {
      // Start login - auth popup window will open automatically
      const result = await window.api.auth.googleLogin();

      if (result.success) {
        // Auth popup is already open - keep loading=true while waiting for redirect
        // The popup will close automatically after successful authentication
      } else {
        setError(result.error || "Failed to start Google login");
        setLoading(false);
        setProvider(null);
        cleanup();
      }
    } catch (err) {
      logger.error("Google login error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start Google login";
      setError(errorMessage);
      setLoading(false);
      setProvider(null);
      cleanup();
    }
  };

  /**
   * Handle Microsoft Sign In (Redirect Flow)
   * Browser opens, user logs in, redirects to local server, app handles automatically
   *
   * Two possible outcomes:
   * 1. login-complete: Database was initialized, user was saved locally
   * 2. login-pending: Database not initialized, need keychain setup first
   */
  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError(null);
    setProvider("microsoft");
    setPopupCancelled(false);

    // Listen for login completion from main process
    let cleanupComplete: (() => void) | undefined;
    let cleanupPending: (() => void) | undefined;
    let cleanupCancelled: (() => void) | undefined;

    const cleanup = () => {
      if (cleanupComplete) cleanupComplete();
      if (cleanupPending) cleanupPending();
      if (cleanupCancelled) cleanupCancelled();
    };

    if (window.api.onMicrosoftLoginComplete) {
      cleanupComplete = window.api.onMicrosoftLoginComplete((result) => {
        if (
          result.success &&
          result.user &&
          result.sessionToken &&
          result.subscription &&
          onLoginSuccess
        ) {
          onLoginSuccess(
            result.user,
            result.sessionToken,
            "microsoft",
            result.subscription,
            result.isNewUser || false,
          );
        } else if (!result.pendingLogin) {
          // Only show error if this isn't a pending login (handled by pending listener)
          setError(result.error || "Failed to complete Microsoft login");
          setLoading(false);
          setProvider(null);
        }

        // Clean up listeners after handling the event
        cleanup();
      });
    }

    // Listen for pending login (OAuth succeeded but database not initialized)
    if (window.api.onMicrosoftLoginPending && onLoginPending) {
      cleanupPending = window.api.onMicrosoftLoginPending((result) => {
        if (result.success && result.pendingLogin && result.oauthData) {
          // OAuth succeeded but need keychain setup - pass data to parent
          onLoginPending(result.oauthData as PendingOAuthData);
        } else {
          setError(result.error || "Failed to complete Microsoft login");
          setLoading(false);
          setProvider(null);
        }

        // Clean up listeners
        cleanup();
      });
    }

    // Listen for popup cancelled (user closed popup window)
    if (window.api.onMicrosoftLoginCancelled) {
      cleanupCancelled = window.api.onMicrosoftLoginCancelled(() => {
        setPopupCancelled(true);
        cleanup();
      });
    }

    try {
      // Start login - auth popup window will open automatically
      const result = await window.api.auth.microsoftLogin();

      if (result.success) {
        // Auth popup is already open - keep loading=true while waiting for redirect
        // The popup will close automatically after successful authentication
      } else {
        setError(result.error || "Failed to start Microsoft login");
        setLoading(false);
        setProvider(null);
        cleanup();
      }
    } catch (err) {
      logger.error("Microsoft login error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start Microsoft login";
      setError(errorMessage);
      setLoading(false);
      setProvider(null);
      cleanup();
    }
  };

  /**
   * Handle authorization code submission
   */
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authCode.trim()) {
      setError("Please enter the authorization code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      if (provider === "google") {
        result = await window.api.auth.googleCompleteLogin(authCode.trim());
      } else if (provider === "microsoft") {
        result = await window.api.auth.microsoftCompleteLogin(authCode.trim());
      }

      if (
        result &&
        result.success &&
        result.user &&
        result.sessionToken &&
        provider &&
        result.subscription &&
        onLoginSuccess
      ) {
        // Call parent callback with user, session token, provider, subscription, and isNewUser flag
        onLoginSuccess(
          result.user,
          result.sessionToken,
          provider,
          result.subscription,
          result.isNewUser || false,
        );
      } else if (result && !result.success) {
        setError(result.error || "Login failed");
        setLoading(false);
      }
    } catch (err) {
      logger.error("Code exchange error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to complete login";
      setError(errorMessage);
      setLoading(false);
    }
  };

  /**
   * TASK-2044: Fresh retry -- resets all retry state and starts a brand new login attempt
   * This is called by the "Try again" button after all retries are exhausted.
   */
  const handleTryAgain = () => {
    clearRetryTimers();
    resetRetryState();
    setError(null);
    // Start a completely fresh login flow
    handleBrowserLogin();
  };

  /**
   * Cancel login flow
   * TASK-2044: Also clears retry state and timers
   */
  const handleCancel = () => {
    clearRetryTimers();
    resetRetryState();
    setLoading(false);
    setAuthUrl(null);
    setAuthCode("");
    setProvider(null);
    setError(null);
    setPopupCancelled(false);
    setBrowserAuthInProgress(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Keepr</h1>
          <p className="text-gray-600">Real Estate Compliance Made Simple</p>
        </div>

        {/* Error Message -- TASK-2044: includes "Try again" button when retries exhausted */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
            {retriesExhausted && (
              <button
                onClick={handleTryAgain}
                className="mt-3 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Google Authentication in Progress - HIDDEN: Old auth flow deprecated in SPRINT-062 */}
        {false && provider === "google" && loading && (
          <div className="mb-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg text-center">
              <div className="flex flex-col items-center">
                {!popupCancelled && (
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                )}
                <p className="text-sm text-blue-900 font-semibold mb-2">
                  {popupCancelled
                    ? "Sign-in window was closed"
                    : "Authenticating with Google..."}
                </p>
                <p className="text-xs text-blue-700 mb-4">
                  {popupCancelled
                    ? "Click Retry to open the sign-in window again, or choose a different account."
                    : "A popup window will open. Complete sign-in there and it will close automatically."}
                </p>
                {/* Retry and Back buttons - only shown when popup is cancelled */}
                {popupCancelled && (
                  <div className="flex gap-3 w-full max-w-xs">
                    <button
                      onClick={handleGoogleLogin}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Retry
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Use different account
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Microsoft Authentication in Progress - HIDDEN: Old auth flow deprecated in SPRINT-062 */}
        {false && provider === "microsoft" && loading && (
          <div className="mb-6">
            <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg text-center">
              <div className="flex flex-col items-center">
                {!popupCancelled && (
                  <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                )}
                <p className="text-sm text-purple-900 font-semibold mb-2">
                  {popupCancelled
                    ? "Sign-in window was closed"
                    : "Authenticating with Microsoft..."}
                </p>
                <p className="text-xs text-purple-700 mb-4">
                  {popupCancelled
                    ? "Click Retry to open the sign-in window again, or choose a different account."
                    : "A popup window will open. Complete sign-in there and it will close automatically."}
                </p>
                {/* Retry and Back buttons - only shown when popup is cancelled */}
                {popupCancelled && (
                  <div className="flex gap-3 w-full max-w-xs">
                    <button
                      onClick={handleMicrosoftLogin}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Retry
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Use different account
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Auth URL Display - HIDDEN: Old auth flow deprecated in SPRINT-062 */}
        {false && authUrl && !loading && provider === "google" && (
          <div className="mb-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-sm text-blue-900 mb-2 font-semibold">
                Step 1: Sign in with{" "}
                {provider === "google" ? "Google" : "Microsoft"}
              </p>
              <p className="text-xs text-blue-700 mb-3">
                A browser window has been opened. After signing in, copy the
                authorization code and paste it below.
              </p>
              <button
                onClick={() => authUrl && window.api.shell.openExternal(authUrl)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Click here if the browser didn't open
              </button>
            </div>

            <form onSubmit={handleCodeSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="authCode"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Authorization Code
                </label>
                <input
                  type="text"
                  id="authCode"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Paste code here"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading || !authCode.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Completing..." : "Complete Sign In"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Browser Authentication in Progress (TASK-1507, enhanced TASK-2044) */}
        {provider === "browser" && browserAuthInProgress && (
          <div className="mb-6">
            <div className="p-6 bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-lg text-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm text-green-900 font-semibold mb-2">
                  {isRetrying
                    ? `Retrying (attempt ${retryAttempt + 1}/${LOGIN_RETRY_CONFIG.maxRetries + 1})...`
                    : retryAttempt > 0
                      ? `Authenticating in Browser (attempt ${retryAttempt + 1}/${LOGIN_RETRY_CONFIG.maxRetries + 1})...`
                      : "Authenticating in Browser..."}
                </p>
                <p className="text-xs text-green-700 mb-4">
                  {isRetrying
                    ? "Reconnecting... Please wait."
                    : "Complete sign-in in your default browser. The app will update automatically when finished."}
                </p>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Initial Login Buttons */}
        {!authUrl &&
          !((provider === "microsoft" || provider === "google" || provider === "browser") && loading) && (
            <div>
              {/* SPRINT-062: Browser Sign In (Deep Link Flow) - Primary login method */}
              <button
                onClick={handleBrowserLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-teal-500 text-white py-3 px-4 rounded-lg hover:from-green-600 hover:to-teal-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
                <span className="font-medium">Sign in with Browser</span>
              </button>

              {/* Trial Info */}
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                  Start your 14-day free trial
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default Login;
