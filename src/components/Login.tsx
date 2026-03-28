/**
 * Login Component
 * Handles user authentication via Google or Microsoft OAuth
 * Two-step flow: Login first, connect mailboxes later
 *
 * When database is not initialized (no keychain access yet), the login handlers
 * will emit a "pending" event instead of "complete". This allows the parent
 * to show the keychain explanation screen before completing the login.
 */

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import type { User, Subscription } from "../../electron/types/models";
import logger from '../utils/logger';
import { authService } from '../services/authService';

// TASK-2044: Login retry configuration
const LOGIN_RETRY_CONFIG = {
  maxRetries: 0,
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
  const [provider, setProvider] = useState<"google" | "microsoft" | "browser" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // TASK-1507: Track when browser auth is in progress
  const [browserAuthInProgress, setBrowserAuthInProgress] = useState(false);

  // TASK-2044: Retry state for browser auth
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retriesExhausted, setRetriesExhausted] = useState(false);
  const callbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // TASK-1337: OTP login state
  const [otpStep, setOtpStep] = useState<"hidden" | "email" | "code" | "verifying">("hidden");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
   * Called when browser OAuth completes and returns via keepr://callback
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
    setProvider(null);
    setError(null);
    setBrowserAuthInProgress(false);
  };

  // ==========================================
  // TASK-1337: OTP Login Handlers
  // ==========================================

  /**
   * Start the resend cooldown timer (60 seconds)
   */
  const startResendCooldown = useCallback(() => {
    setResendCooldown(60);
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
    }
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) {
            clearInterval(resendTimerRef.current);
            resendTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Clean up resend timer on unmount
  useEffect(() => {
    return () => {
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
      }
    };
  }, []);

  /**
   * Show the OTP email input form
   */
  const handleShowOtpForm = () => {
    setOtpStep("email");
    setOtpEmail("");
    setOtpCode("");
    setOtpError(null);
    setError(null);
  };

  /**
   * Send OTP code to the entered email
   */
  const handleOtpSendCode = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (!otpEmail.trim()) {
      setOtpError("Please enter your email address");
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    try {
      const result = await authService.otpSendCode(otpEmail.trim());
      if (result.success) {
        logger.info("[Login] OTP code sent successfully");
        setOtpStep("code");
        setOtpCode("");
        startResendCooldown();
      } else {
        setOtpError(result.error || "Failed to send verification code");
      }
    } catch (err) {
      logger.error("[Login] OTP send code error:", err);
      setOtpError("Failed to send verification code. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  /**
   * Verify the entered OTP code
   */
  const handleOtpVerifyCode = async (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (!otpCode.trim()) {
      setOtpError("Please enter the verification code");
      return;
    }

    setOtpLoading(true);
    setOtpError(null);
    setOtpStep("verifying");

    try {
      const result = await authService.otpVerifyCode(otpEmail.trim(), otpCode.trim());
      if (result.success && result.data) {
        logger.info("[Login] OTP verification successful");
        const { user, sessionToken, subscription, isNewUser } = result.data;
        onLoginSuccess(
          user,
          sessionToken,
          "email",
          subscription || { tier: "free", status: "trial" } as Subscription,
          isNewUser ?? true,
        );
      } else {
        setOtpStep("code");
        setOtpError(result.error || "Verification failed");
      }
    } catch (err) {
      logger.error("[Login] OTP verify code error:", err);
      setOtpStep("code");
      setOtpError("Verification failed. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  /**
   * Resend the OTP code (if cooldown has elapsed)
   */
  const handleOtpResend = async () => {
    if (resendCooldown > 0) return;
    await handleOtpSendCode();
  };

  /**
   * Go back from OTP flow to main login options
   */
  const handleOtpBack = () => {
    setOtpStep("hidden");
    setOtpEmail("");
    setOtpCode("");
    setOtpError(null);
    setResendCooldown(0);
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Keepr.</h1>
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

        {/* TASK-1337: OTP Email Login Form */}
        {otpStep === "email" && (
          <div className="mb-6">
            <form onSubmit={handleOtpSendCode}>
              <label htmlFor="otp-email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="otp-email"
                type="email"
                value={otpEmail}
                onChange={(e) => setOtpEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                disabled={otpLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {otpError && (
                <p className="mt-2 text-sm text-red-600">{otpError}</p>
              )}
              <button
                type="submit"
                disabled={otpLoading || !otpEmail.trim()}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {otpLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  "Send Code"
                )}
              </button>
            </form>
            <button
              onClick={handleOtpBack}
              disabled={otpLoading}
              className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Back to login options
            </button>
          </div>
        )}

        {/* TASK-1337: OTP Code Entry Form */}
        {(otpStep === "code" || otpStep === "verifying") && (
          <div className="mb-6">
            {otpStep === "verifying" ? (
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm text-blue-900 font-semibold">Verifying...</p>
                <p className="text-xs text-blue-700 mt-1">Checking your code and setting up your account</p>
              </div>
            ) : (
              <form onSubmit={handleOtpVerifyCode}>
                <p className="text-sm text-gray-600 mb-4">
                  We sent a 6-digit code to <span className="font-medium text-gray-900">{otpEmail}</span>
                </p>
                <label htmlFor="otp-code" className="block text-sm font-medium text-gray-700 mb-2">
                  Verification code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="000000"
                  autoFocus
                  autoComplete="one-time-code"
                  disabled={otpLoading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white text-center text-2xl font-mono tracking-widest placeholder-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {otpError && (
                  <p className="mt-2 text-sm text-red-600">{otpError}</p>
                )}
                <button
                  type="submit"
                  disabled={otpLoading || otpCode.length < 6}
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {otpLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifying...
                    </>
                  ) : (
                    "Verify"
                  )}
                </button>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleOtpResend}
                    disabled={resendCooldown > 0 || otpLoading}
                    className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleOtpBack}
                    disabled={otpLoading}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Initial Login Buttons */}
        {!((provider === "microsoft" || provider === "google" || provider === "browser") && loading) && otpStep === "hidden" && (
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

              {/* TASK-1337: OTP Email Sign In */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <button
                onClick={handleShowOtpForm}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:border-blue-400 hover:text-blue-700 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-medium">Sign in with Email Code</span>
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
