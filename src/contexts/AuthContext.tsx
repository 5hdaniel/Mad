/**
 * Authentication Context
 * Centralizes auth state management to reduce prop drilling and simplify component testing.
 * Handles user authentication, session management, and subscription state.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { OAuthProvider, Subscription } from "../../electron/types/models";

// User interface
export interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  terms_accepted_at?: string;
}

// Auth state interface
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: User | null;
  sessionToken: string | null;
  authProvider: OAuthProvider | null;
  subscription: Subscription | undefined;
  needsTermsAcceptance: boolean;
}

// Auth context value interface
interface AuthContextValue extends AuthState {
  // Actions
  login: (
    user: User,
    token: string,
    provider: string,
    subscription: Subscription | undefined,
    isNewUser: boolean,
  ) => void;
  logout: () => Promise<void>;
  acceptTerms: () => Promise<void>;
  declineTerms: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearTermsRequirement: () => void;
}

// Default auth state
const defaultAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  currentUser: null,
  sessionToken: null,
  authProvider: null,
  subscription: undefined,
  needsTermsAcceptance: false,
};

// Create context with undefined default to ensure provider is used
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider component
 * Wraps the application and provides authentication state and actions
 */
export function AuthProvider({
  children,
}: AuthProviderProps): React.ReactElement {
  const [state, setState] = useState<AuthState>(defaultAuthState);

  /**
   * Check for existing session on mount
   */
  const checkSession = useCallback(async () => {
    if (window.api?.auth?.getCurrentUser) {
      try {
        const result = await window.api.auth.getCurrentUser();
        if (result.success && result.user) {
          // Convert user to ensure terms_accepted_at is string or undefined
          const user: User = {
            id: result.user.id,
            email: result.user.email,
            display_name: result.user.display_name,
            avatar_url: result.user.avatar_url,
            terms_accepted_at:
              result.user.terms_accepted_at instanceof Date
                ? result.user.terms_accepted_at.toISOString()
                : result.user.terms_accepted_at,
          };
          setState({
            isAuthenticated: true,
            isLoading: false,
            currentUser: user,
            sessionToken: result.sessionToken ?? null,
            authProvider: (result.provider ?? null) as OAuthProvider | null,
            subscription: result.subscription ?? undefined,
            needsTermsAcceptance: result.isNewUser ?? false,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        // Session check failed silently - user will need to log in
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  /**
   * Handle successful login
   */
  const login = useCallback(
    (
      user: User,
      token: string,
      provider: string,
      subscription: Subscription | undefined,
      isNewUser: boolean,
    ) => {
      setState({
        isAuthenticated: true,
        isLoading: false,
        currentUser: user,
        sessionToken: token,
        authProvider: provider as OAuthProvider,
        subscription,
        needsTermsAcceptance: isNewUser,
      });
    },
    [],
  );

  /**
   * Handle logout
   */
  const logout = useCallback(async () => {
    if (state.sessionToken && window.api?.auth?.logout) {
      try {
        await window.api.auth.logout(state.sessionToken);
      } catch {
        // Logout error is handled server-side, continue with local cleanup
      }
    }

    // Clear all auth state
    setState({
      ...defaultAuthState,
      isLoading: false,
    });
  }, [state.sessionToken]);

  /**
   * Accept terms and conditions
   */
  const acceptTerms = useCallback(async () => {
    if (state.currentUser && window.api?.auth?.acceptTerms) {
      try {
        await window.api.auth.acceptTerms(state.currentUser.id);
        setState((prev) => ({ ...prev, needsTermsAcceptance: false }));
      } catch (error) {
        console.error("Failed to accept terms:", error);
        throw error;
      }
    }
  }, [state.currentUser]);

  /**
   * Decline terms - triggers logout
   */
  const declineTerms = useCallback(async () => {
    await logout();
  }, [logout]);

  /**
   * Refresh session - re-check authentication status
   */
  const refreshSession = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await checkSession();
  }, [checkSession]);

  /**
   * Clear terms requirement flag (for use after accepting terms)
   */
  const clearTermsRequirement = useCallback(() => {
    setState((prev) => ({ ...prev, needsTermsAcceptance: false }));
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      acceptTerms,
      declineTerms,
      refreshSession,
      clearTermsRequirement,
    }),
    [
      state,
      login,
      logout,
      acceptTerms,
      declineTerms,
      refreshSession,
      clearTermsRequirement,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

/**
 * Custom hook to use auth context
 * Throws if used outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Custom hook to check if user is authenticated
 * Returns a simpler interface for components that only need auth status
 */
export function useIsAuthenticated(): {
  isAuthenticated: boolean;
  isLoading: boolean;
} {
  const { isAuthenticated, isLoading } = useAuth();
  return { isAuthenticated, isLoading };
}

/**
 * Custom hook to get current user
 * Returns null if not authenticated
 */
export function useCurrentUser(): User | null {
  const { currentUser } = useAuth();
  return currentUser;
}

export default AuthContext;
