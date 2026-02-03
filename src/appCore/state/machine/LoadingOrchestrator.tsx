/**
 * Loading Orchestrator Component
 *
 * Coordinates the app initialization sequence by orchestrating
 * loading phases in order and dispatching actions to the state machine.
 *
 * Initialization sequence:
 * 1. Check storage - Verify encryption key store exists
 * 2. Initialize DB - Set up secure database
 * 3. Load auth - Check authentication state
 * 4. Load user data - Load user preferences
 *
 * @module appCore/state/machine/LoadingOrchestrator
 */

import React, { useEffect, useRef } from "react";
import { useAppState } from "./useAppState";
import { LoadingScreen } from "./components/LoadingScreen";
import { ErrorScreen } from "./components/ErrorScreen";
import {
  detectPlatform,
  autoInitializesStorage,
} from "./utils/platformInit";
import { useAuth } from "../../../contexts";
import type { PlatformInfo, User, UserData } from "./types";

interface LoadingOrchestratorProps {
  children: React.ReactNode;
}

/**
 * Orchestrates the app initialization sequence.
 * Coordinates: storage check -> DB init -> auth -> user data
 *
 * Each phase runs in a useEffect that checks BOTH status AND phase
 * to prevent duplicate calls and race conditions.
 */
export function LoadingOrchestrator({
  children,
}: LoadingOrchestratorProps): React.ReactElement {
  const { state, dispatch, loadingPhase } = useAppState();
  const { login } = useAuth();

  // Track auth data across phases (needed for USER_DATA_LOADED context)
  const authDataRef = useRef<{
    user: User | null;
    platform: PlatformInfo;
  } | null>(null);

  // Detect platform once at startup (cached in ref to avoid re-detection)
  const platformRef = useRef(detectPlatform());

  // Get full platform info including hasIPhone (determined during onboarding)
  const getPlatformInfo = (): PlatformInfo => ({
    ...platformRef.current,
    hasIPhone: false, // Determined during onboarding
  });

  // ============================================
  // PHASE 1: Check storage
  // ============================================
  useEffect(() => {
    // Guard: only run in the correct phase
    if (state.status !== "loading" || loadingPhase !== "checking-storage") {
      return;
    }

    let cancelled = false;

    const platform = platformRef.current;

    window.api.system
      .hasEncryptionKeyStore()
      .then((result) => {
        if (cancelled) return;
        dispatch({
          type: "STORAGE_CHECKED",
          hasKeyStore: result.hasKeyStore,
          isMacOS: platform.isMacOS,
        });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        dispatch({
          type: "ERROR",
          error: {
            code: "STORAGE_CHECK_FAILED",
            message: error.message || "Failed to check storage",
          },
          recoverable: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [state.status, loadingPhase, dispatch]);

  // ============================================
  // PHASE 2: Initialize database (platform-specific)
  // ============================================
  useEffect(() => {
    // Guard: only run in the correct phase
    if (state.status !== "loading" || loadingPhase !== "initializing-db") {
      return;
    }

    // Guard: respect deferredDbInit flag - let onboarding SecureStorageStep handle DB init
    // This prevents the Keychain prompt from appearing before the login screen on fresh macOS installs
    const loadingState = state as import("./types").LoadingState;
    if (loadingState.deferredDbInit) {
      return;
    }

    const platform = platformRef.current;

    // Windows: Auto-initialize (DPAPI is silent, no user interaction needed)
    // macOS: Also auto-initialize for now, but may show Keychain prompt
    // Future: macOS may wait for user to click Continue before triggering init
    if (autoInitializesStorage(platform)) {
      // Windows path: Silent auto-initialization
      let cancelled = false;

      dispatch({ type: "DB_INIT_STARTED" });

      window.api.system
        .initializeSecureStorage()
        .then((result) => {
          if (cancelled) return;
          dispatch({
            type: "DB_INIT_COMPLETE",
            success: result.success,
            error: result.error,
          });
        })
        .catch((error: Error) => {
          if (cancelled) return;
          dispatch({
            type: "DB_INIT_COMPLETE",
            success: false,
            error: error.message || "Database initialization failed",
          });
        });

      return () => {
        cancelled = true;
      };
    } else {
      // macOS path: Auto-initialize but may trigger Keychain prompt
      // Note: For new users, the UI may show a keychain explanation first,
      // but the actual initialization happens here. The Keychain prompt
      // is a system-level dialog that appears during initializeSecureStorage.
      let cancelled = false;

      dispatch({ type: "DB_INIT_STARTED" });

      window.api.system
        .initializeSecureStorage()
        .then((result) => {
          if (cancelled) return;
          dispatch({
            type: "DB_INIT_COMPLETE",
            success: result.success,
            error: result.error,
          });
        })
        .catch((error: Error) => {
          if (cancelled) return;
          dispatch({
            type: "DB_INIT_COMPLETE",
            success: false,
            error: error.message || "Database initialization failed",
          });
        });

      return () => {
        cancelled = true;
      };
    }
  }, [state.status, loadingPhase, dispatch]);

  // ============================================
  // PHASE 3: Load auth state
  // ============================================
  useEffect(() => {
    // Guard: only run in the correct phase
    if (state.status !== "loading" || loadingPhase !== "loading-auth") {
      return;
    }

    let cancelled = false;

    const platform = getPlatformInfo();

    window.api.auth
      .getCurrentUser()
      .then((result) => {
        if (cancelled) return;

        if (result.success && result.user) {
          // Type the user from the API response
          const apiUser = result.user as {
            id: string;
            email: string;
            display_name?: string;
            avatar_url?: string;
          };

          const user: User = {
            id: apiUser.id,
            email: apiUser.email,
            displayName: apiUser.display_name,
            avatarUrl: apiUser.avatar_url,
          };

          // Store for USER_DATA_LOADED phase
          authDataRef.current = { user, platform };

          // Sync to AuthContext so currentUser is available in UI
          const authContextUser = {
            id: apiUser.id,
            email: apiUser.email,
            display_name: apiUser.display_name,
            avatar_url: apiUser.avatar_url,
          };
          login(
            authContextUser,
            result.sessionToken ?? "",
            result.provider ?? "",
            result.subscription,
            result.isNewUser ?? false,
          );

          dispatch({
            type: "AUTH_LOADED",
            user,
            isNewUser: result.isNewUser ?? false,
            platform,
          });
        } else {
          // No session - user needs to login
          dispatch({
            type: "AUTH_LOADED",
            user: null,
            isNewUser: false,
            platform,
          });
        }
      })
      .catch((error: Error) => {
        if (cancelled) return;
        // No session is not necessarily an error - just means user needs to login
        console.warn("[LoadingOrchestrator] Auth check failed:", error);
        dispatch({
          type: "AUTH_LOADED",
          user: null,
          isNewUser: false,
          platform: getPlatformInfo(),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [state.status, loadingPhase, dispatch, getPlatformInfo, login]);

  // ============================================
  // PHASE 4: Load user data (if authenticated)
  // ============================================
  useEffect(() => {
    // Guard: only run in the correct phase
    if (state.status !== "loading" || loadingPhase !== "loading-user-data") {
      return;
    }

    // User/platform context can come from:
    // 1. authDataRef (app restart flow - set during AUTH_LOADED phase)
    // 2. state.user/state.platform (fresh login flow - set by LOGIN_SUCCESS action)
    const loadingState = state as import("./types").LoadingState;
    const authData = authDataRef.current;

    // Prefer state (LOGIN_SUCCESS flow), fall back to ref (app restart flow)
    const user = loadingState.user || authData?.user;
    const platform = loadingState.platform || authData?.platform;

    if (!user || !platform) {
      // This shouldn't happen - loading-user-data phase means we had a user
      dispatch({
        type: "ERROR",
        error: {
          code: "USER_DATA_FAILED",
          message: "Missing user context for loading user data",
        },
        recoverable: true,
      });
      return;
    }

    let cancelled = false;

    // Load actual user data from database APIs
    const loadUserData = async (): Promise<UserData> => {
      const userId = user.id;

      // Load all user data in parallel for faster loading
      const [phoneTypeResult, emailOnboardingResult, connectionsResult, permissionsResult] =
        await Promise.all([
          // Get phone type from database
          window.api.user.getPhoneType(userId).catch(() => ({
            success: false,
            phoneType: null as "iphone" | "android" | null,
          })),

          // Check if email onboarding is completed
          window.api.auth
            .checkEmailOnboarding(userId)
            .catch(() => ({
              success: false,
              completed: false,
            })),

          // Check if email is connected (any provider)
          window.api.system.checkAllConnections(userId).catch(() => ({
            success: false,
            google: { connected: false },
            microsoft: { connected: false },
          })),

          // Check permissions (macOS only)
          platform.isMacOS
            ? window.api.system.checkPermissions().catch(() => ({
                hasPermission: false,
                fullDiskAccess: false,
              }))
            : Promise.resolve({ hasPermission: true, fullDiskAccess: true }),
        ]);

      // Determine phone type
      const phoneType =
        phoneTypeResult.success && phoneTypeResult.phoneType
          ? phoneTypeResult.phoneType
          : null;

      // Determine if any email provider is connected
      const hasEmailConnected =
        connectionsResult.success &&
        (connectionsResult.google?.connected === true ||
          connectionsResult.microsoft?.connected === true);

      // Determine if email onboarding is completed
      // If email is connected, consider onboarding complete (for returning users
      // who connected email before the hasCompletedEmailOnboarding flag existed)
      const hasCompletedEmailOnboarding =
        (emailOnboardingResult.success && emailOnboardingResult.completed) ||
        hasEmailConnected;

      // Determine permissions status (macOS only)
      const hasPermissions = platform.isMacOS
        ? permissionsResult.hasPermission === true ||
          permissionsResult.fullDiskAccess === true
        : true; // Windows doesn't require permissions

      // Determine if driver setup is needed (Windows + iPhone only)
      let needsDriverSetup = false;
      if (platform.isWindows && phoneType === "iphone") {
        try {
          // Check if Apple drivers are installed
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const drivers = (window.api as any)?.drivers;
          if (drivers) {
            const driverStatus = await drivers.checkApple();
            // Only check isInstalled - service might not be running after fresh install
            needsDriverSetup = !driverStatus.isInstalled;
          } else {
            needsDriverSetup = true;
          }
        } catch {
          // Assume drivers needed if check fails
          needsDriverSetup = true;
        }
      }

      return {
        phoneType,
        hasCompletedEmailOnboarding,
        hasEmailConnected,
        needsDriverSetup,
        hasPermissions,
      };
    };

    loadUserData()
      .then((userData) => {
        if (cancelled) return;

        // Dispatch with required context (user and platform from state or ref)
        dispatch({
          type: "USER_DATA_LOADED",
          data: userData,
          // These are required by the reducer for state transition
          user,
          platform,
        } as {
          type: "USER_DATA_LOADED";
          data: UserData;
          user: User;
          platform: PlatformInfo;
        });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        console.error("[LoadingOrchestrator] Failed to load user data:", error);

        // Fallback to empty user data - will trigger onboarding
        const fallbackData: UserData = {
          phoneType: null,
          hasCompletedEmailOnboarding: false,
          hasEmailConnected: false,
          needsDriverSetup: platform.isWindows,
          hasPermissions: !platform.isMacOS,
        };

        dispatch({
          type: "USER_DATA_LOADED",
          data: fallbackData,
          user,
          platform,
        } as {
          type: "USER_DATA_LOADED";
          data: UserData;
          user: User;
          platform: PlatformInfo;
        });
      });

    return () => {
      cancelled = true;
    };
    // Note: We read state.user and state.platform for LOGIN_SUCCESS flow,
    // but those are set atomically with loadingPhase, so state.status and loadingPhase
    // are sufficient dependencies.
  }, [state.status, loadingPhase, dispatch]);

  // ============================================
  // RENDER BASED ON STATE
  // ============================================

  // Loading states - show loading screen with platform-specific messages
  if (state.status === "loading" && loadingPhase) {
    return (
      <LoadingScreen
        phase={loadingPhase}
        progress={state.progress}
        platform={platformRef.current}
      />
    );
  }

  // Non-recoverable error - show error screen
  if (state.status === "error" && !state.recoverable) {
    return (
      <ErrorScreen error={state.error} onRetry={() => dispatch({ type: "RETRY" })} />
    );
  }

  // Recoverable error or other states - render children
  // (error recovery UI can be shown as overlay in children)
  return <>{children}</>;
}
