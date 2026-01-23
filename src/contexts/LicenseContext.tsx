/**
 * License Context
 * Centralizes license state management for the application.
 * Provides license type, AI addon status, and computed permission flags.
 *
 * License Model (BACKLOG-426):
 *   license_type: 'individual' | 'team' | 'enterprise' (base license)
 *   ai_detection_enabled: boolean (add-on, works with ANY base license)
 *
 * Combined Examples:
 *   - Individual + No AI: Export, manual transactions only
 *   - Individual + AI: Export, manual transactions, AI detection features
 *   - Team + No AI: Submit for review, manual transactions only
 *   - Team + AI: Submit for review, manual transactions, AI detection features
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { LicenseType } from "../../electron/types/models";

// License context value interface
interface LicenseContextValue {
  // Core license data
  licenseType: LicenseType;
  hasAIAddon: boolean;
  organizationId: string | null;

  // Computed convenience flags
  /** true for individual license - can export locally */
  canExport: boolean;
  /** true for team/enterprise license - can submit for broker review */
  canSubmit: boolean;
  /** true if AI detection add-on is enabled */
  canAutoDetect: boolean;

  // Loading state
  isLoading: boolean;

  // Actions
  refresh: () => Promise<void>;
}

// License state interface (internal)
interface LicenseState {
  licenseType: LicenseType;
  hasAIAddon: boolean;
  organizationId: string | null;
  isLoading: boolean;
}

// DEV OVERRIDE: Set to 'team' for testing Submit button, 'individual' for Export
// TODO: Remove this after testing - revert to reading from database
const DEV_LICENSE_OVERRIDE: LicenseType | null = "team";

// Default license state (individual with no AI)
const defaultLicenseState: LicenseState = {
  licenseType: DEV_LICENSE_OVERRIDE || "individual",
  hasAIAddon: false,
  organizationId: null,
  isLoading: true,
};

// Create context with undefined default to ensure provider is used
const LicenseContext = createContext<LicenseContextValue | undefined>(
  undefined
);

// Provider props
interface LicenseProviderProps {
  children: React.ReactNode;
}

/**
 * LicenseProvider component
 * Wraps the application and provides license state and computed permissions
 */
export function LicenseProvider({
  children,
}: LicenseProviderProps): React.ReactElement {
  const [state, setState] = useState<LicenseState>(defaultLicenseState);

  /**
   * Fetch license from main process
   */
  const fetchLicense = useCallback(async () => {
    // DEV OVERRIDE: Skip API call if override is set
    if (DEV_LICENSE_OVERRIDE) {
      setState({
        licenseType: DEV_LICENSE_OVERRIDE,
        hasAIAddon: false,
        organizationId: null,
        isLoading: false,
      });
      return;
    }

    if (window.api?.license?.get) {
      try {
        const result = await window.api.license.get();
        if (result.success && result.license) {
          setState({
            licenseType: result.license.license_type || "individual",
            hasAIAddon: result.license.ai_detection_enabled || false,
            organizationId: result.license.organization_id || null,
            isLoading: false,
          });
        } else {
          // No license found - use defaults
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        // License fetch failed silently - use defaults
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      // API not available - use defaults
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Fetch license on mount
  useEffect(() => {
    fetchLicense();
  }, [fetchLicense]);

  // Refresh on app focus (to catch license changes from other sources)
  useEffect(() => {
    const handleFocus = () => {
      fetchLicense();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchLicense]);

  /**
   * Refresh license data
   */
  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await fetchLicense();
  }, [fetchLicense]);

  // Compute convenience flags
  const canExport = state.licenseType === "individual";
  const canSubmit =
    state.licenseType === "team" || state.licenseType === "enterprise";
  const canAutoDetect = state.hasAIAddon;

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<LicenseContextValue>(
    () => ({
      licenseType: state.licenseType,
      hasAIAddon: state.hasAIAddon,
      organizationId: state.organizationId,
      canExport,
      canSubmit,
      canAutoDetect,
      isLoading: state.isLoading,
      refresh,
    }),
    [state, canExport, canSubmit, canAutoDetect, refresh]
  );

  return (
    <LicenseContext.Provider value={contextValue}>
      {children}
    </LicenseContext.Provider>
  );
}

/**
 * Custom hook to use license context
 * Throws if used outside of LicenseProvider
 */
export function useLicense(): LicenseContextValue {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error("useLicense must be used within a LicenseProvider");
  }
  return context;
}

/**
 * Custom hook to check if user can export (individual license)
 * Returns a simpler interface for components that only need export permission
 */
export function useCanExport(): { canExport: boolean; isLoading: boolean } {
  const { canExport, isLoading } = useLicense();
  return { canExport, isLoading };
}

/**
 * Custom hook to check if user can submit (team/enterprise license)
 * Returns a simpler interface for components that only need submit permission
 */
export function useCanSubmit(): { canSubmit: boolean; isLoading: boolean } {
  const { canSubmit, isLoading } = useLicense();
  return { canSubmit, isLoading };
}

/**
 * Custom hook to check if AI detection is available
 * Returns a simpler interface for components that only need AI feature status
 */
export function useCanAutoDetect(): {
  canAutoDetect: boolean;
  isLoading: boolean;
} {
  const { canAutoDetect, isLoading } = useLicense();
  return { canAutoDetect, isLoading };
}

export default LicenseContext;
