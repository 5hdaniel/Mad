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

import React, { useEffect, useRef, useCallback } from "react";
import { useAppState } from "./useAppState";
import { LoadingScreen } from "./components/LoadingScreen";
import { ErrorScreen } from "./components/ErrorScreen";
import type { PlatformInfo, User, UserData, LoadingPhase } from "./types";

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

  // Track auth data across phases (needed for USER_DATA_LOADED context)
  const authDataRef = useRef<{
    user: User | null;
    platform: PlatformInfo;
  } | null>(null);

  // Detect platform once at startup
  const getPlatformInfo = useCallback((): PlatformInfo => {
    const platform = window.navigator.platform;
    return {
      isMacOS: platform.includes("Mac"),
      isWindows: platform.includes("Win"),
      hasIPhone: false, // Determined during onboarding
    };
  }, []);

  // Helper to check if we're in a specific loading phase
  const isLoadingPhase = (phase: LoadingPhase): boolean =>
    state.status === "loading" && loadingPhase === phase;

  // ============================================
  // PHASE 1: Check storage
  // ============================================
  useEffect(() => {
    if (!isLoadingPhase("checking-storage")) {
      return;
    }

    let cancelled = false;

    window.api.system
      .hasEncryptionKeyStore()
      .then((result) => {
        if (cancelled) return;
        dispatch({
          type: "STORAGE_CHECKED",
          hasKeyStore: result.hasKeyStore,
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
  }, [state.status, loadingPhase, dispatch, isLoadingPhase]);

  // ============================================
  // PHASE 2: Initialize database
  // ============================================
  useEffect(() => {
    if (!isLoadingPhase("initializing-db")) {
      return;
    }

    let cancelled = false;

    // Signal that init has started (for progress indicator)
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
  }, [state.status, loadingPhase, dispatch, isLoadingPhase]);

  // ============================================
  // PHASE 3: Load auth state
  // ============================================
  useEffect(() => {
    if (!isLoadingPhase("loading-auth")) {
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
  }, [state.status, loadingPhase, dispatch, getPlatformInfo, isLoadingPhase]);

  // ============================================
  // PHASE 4: Load user data (if authenticated)
  // ============================================
  useEffect(() => {
    if (!isLoadingPhase("loading-user-data")) {
      return;
    }

    // Get auth context from ref (set during AUTH_LOADED phase)
    const authData = authDataRef.current;

    if (!authData || !authData.user) {
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

    // TODO: Load actual user data from database
    // For now, dispatch placeholder data that will trigger onboarding
    // if the user hasn't completed it yet
    const userData: UserData = {
      phoneType: null, // Will be set during onboarding
      hasCompletedEmailOnboarding: false,
      hasEmailConnected: false,
      needsDriverSetup: authData.platform.isWindows, // Assume needed on Windows
      hasPermissions: false, // Will be checked/set during onboarding
    };

    // Dispatch with required context (user and platform from AUTH_LOADED)
    dispatch({
      type: "USER_DATA_LOADED",
      data: userData,
      // These are required by the reducer for state transition
      user: authData.user,
      platform: authData.platform,
    } as {
      type: "USER_DATA_LOADED";
      data: UserData;
      user: User;
      platform: PlatformInfo;
    });
  }, [state.status, loadingPhase, dispatch, isLoadingPhase]);

  // ============================================
  // RENDER BASED ON STATE
  // ============================================

  // Loading states - show loading screen
  if (state.status === "loading") {
    return <LoadingScreen phase={state.phase} progress={state.progress} />;
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
