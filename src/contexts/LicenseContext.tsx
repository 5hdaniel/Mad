/**
 * License Context
 * Centralizes license state management for the application.
 * Provides license type, AI addon status, and computed permission flags.
 *
 * License Model (BACKLOG-426):
 *   license_type: 'individual' | 'team' | 'enterprise' (base license)
 *   ai_detection_enabled: boolean (add-on, works with ANY base license)
 *
 * SPRINT-062: Added license validation with trial tracking, transaction limits,
 * and device limits. LicenseProvider now accepts userId prop for validation.
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
  useRef,
} from "react";
import type { LicenseType } from "../../electron/types/models";
import type { LicenseValidationResult } from "../../shared/types/license";
import { licenseService } from "../services";

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
  /** True after first successful license load - used to prevent loading UI on refresh */
  hasInitialized: boolean;

  // Actions
  refresh: () => Promise<void>;

  // SPRINT-062: License validation status
  /** Full validation result from license service */
  validationStatus: LicenseValidationResult | null;
  /** Whether the license is valid (not blocked) */
  isValid: boolean;
  /** Reason for block if license is invalid */
  blockReason: LicenseValidationResult["blockReason"] | null;
  /** Days remaining in trial (null if not on trial) */
  trialDaysRemaining: number | null;
  /** Current transaction count */
  transactionCount: number;
  /** Maximum transactions allowed */
  transactionLimit: number;
  /** Whether user can create a new transaction */
  canCreateTransaction: boolean;
}

// License state interface (internal)
interface LicenseState {
  licenseType: LicenseType;
  hasAIAddon: boolean;
  organizationId: string | null;
  isLoading: boolean;
  /** True after first successful load - prevents loading screen on refresh */
  hasInitialized: boolean;
  // SPRINT-062: Validation status
  validationStatus: LicenseValidationResult | null;
}

// Default license state (individual with no AI)
const defaultLicenseState: LicenseState = {
  licenseType: "individual",
  hasAIAddon: false,
  organizationId: null,
  isLoading: true,
  hasInitialized: false,
  validationStatus: null,
};

// Create context with undefined default to ensure provider is used
const LicenseContext = createContext<LicenseContextValue | undefined>(
  undefined
);

// Provider props - SPRINT-062: Added userId prop for validation
interface LicenseProviderProps {
  children: React.ReactNode;
  /** User ID for license validation (null if not authenticated) */
  userId?: string | null;
}

/**
 * LicenseProvider component
 * Wraps the application and provides license state and computed permissions
 *
 * SPRINT-062: Now accepts userId prop for license validation. When userId is
 * provided, validates license and tracks trial status, transaction limits, etc.
 */
export function LicenseProvider({
  children,
  userId,
}: LicenseProviderProps): React.ReactElement {
  const [state, setState] = useState<LicenseState>(defaultLicenseState);

  // Track last license check to throttle focus refresh (60 second minimum between checks)
  const lastCheckRef = useRef<number>(0);
  const FOCUS_THROTTLE_MS = 60000; // 60 seconds

  /**
   * Fetch license from main process (original method for backward compatibility)
   * Note: This is a silent fetch that doesn't set isLoading to true,
   * so it won't trigger the loading screen on background refreshes.
   */
  const fetchLicense = useCallback(async () => {
    try {
      const result = await licenseService.get();
      if (result.success && result.data) {
        const license = result.data;
        setState((prev) => ({
          ...prev,
          licenseType: license.license_type || "individual",
          hasAIAddon: license.ai_detection_enabled || false,
          organizationId: license.organization_id || null,
          isLoading: false,
          hasInitialized: true,
        }));
      } else {
        // No license found - use defaults
        setState((prev) => ({ ...prev, isLoading: false, hasInitialized: true }));
      }
    } catch {
      // License fetch failed silently - use defaults
      setState((prev) => ({ ...prev, isLoading: false, hasInitialized: true }));
    }
  }, []);

  /**
   * SPRINT-062: Validate license for a specific user
   * Handles trial status, transaction limits, and auto-creates license if needed
   *
   * SPRINT-066: Added hasInitialized tracking to prevent showing "Checking license..."
   * screen on background refreshes. Only shows loading UI before first successful load.
   */
  const validateLicense = useCallback(async () => {
    if (!userId) {
      setState((prev) => ({ ...prev, validationStatus: null, isLoading: false }));
      return;
    }

    try {
      // Only set isLoading: true if we haven't initialized yet
      // This prevents showing "Checking license..." on background refreshes
      setState((prev) => ({
        ...prev,
        isLoading: prev.hasInitialized ? prev.isLoading : true,
      }));

      // Validate license through service (returns ApiResult<LicenseValidationResult>)
      const validationResponse = await licenseService.validate(userId);
      let validationResult = validationResponse.success ? validationResponse.data : null;

      // If no license exists, create a trial license
      if (!validationResult || validationResult.blockReason === "no_license") {
        const createResponse = await licenseService.create(userId);
        if (createResponse.success && createResponse.data) {
          validationResult = createResponse.data;
        }
      }

      // Update state with validation result
      if (validationResult) {
        setState((prev) => ({
          ...prev,
          validationStatus: validationResult,
          // Map validation result to existing fields for backward compatibility
          licenseType: validationResult.licenseType as LicenseType,
          hasAIAddon: validationResult.aiEnabled,
          isLoading: false,
          hasInitialized: true, // Mark as initialized after first successful load
        }));
      } else {
        // Fallback if both validate and create failed
        setState((prev) => ({ ...prev, isLoading: false, hasInitialized: true }));
      }
    } catch (error) {
      console.error("Failed to validate license:", error);
      // Set a fallback status that allows app to function with limited features
      const fallbackStatus: LicenseValidationResult = {
        isValid: false,
        licenseType: "trial",
        transactionCount: 0,
        transactionLimit: 5,
        canCreateTransaction: false,
        deviceCount: 0,
        deviceLimit: 1,
        aiEnabled: false,
        blockReason: "no_license",
      };
      setState((prev) => ({
        ...prev,
        validationStatus: fallbackStatus,
        isLoading: false,
        hasInitialized: true, // Mark as initialized even on error to prevent loading loop
      }));
    }
  }, [userId]);

  // Fetch license on mount (original behavior)
  useEffect(() => {
    fetchLicense();
  }, [fetchLicense]);

  // SPRINT-062: Validate license when userId changes
  useEffect(() => {
    if (userId) {
      validateLicense();
    } else {
      // Clear validation status when user logs out
      setState((prev) => ({ ...prev, validationStatus: null }));
    }
  }, [userId, validateLicense]);

  // Refresh on app focus (to catch license changes from other sources)
  // Throttled to prevent constant "checking license" on every focus
  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      // Skip if checked recently (within 60 seconds)
      if (now - lastCheckRef.current < FOCUS_THROTTLE_MS) {
        return;
      }
      lastCheckRef.current = now;

      // Do a silent background check - don't set isLoading to avoid UI disruption
      fetchLicense();
      // Skip validateLicense on focus - it sets isLoading which closes modals
      // License validation happens on mount and userId change anyway
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
    if (userId) {
      await validateLicense();
    }
  }, [fetchLicense, validateLicense, userId]);

  // Compute convenience flags
  const canExport = state.licenseType === "individual";
  const canSubmit =
    state.licenseType === "team" || state.licenseType === "enterprise";
  const canAutoDetect = state.hasAIAddon;

  // SPRINT-062: Extract validation status fields
  const validationStatus = state.validationStatus;
  const isValid = validationStatus?.isValid ?? true; // Default to true if no validation
  const blockReason = validationStatus?.blockReason ?? null;
  const trialDaysRemaining = validationStatus?.trialDaysRemaining ?? null;
  const transactionCount = validationStatus?.transactionCount ?? 0;
  const transactionLimit = validationStatus?.transactionLimit ?? Infinity;
  const canCreateTransaction = validationStatus?.canCreateTransaction ?? true;

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
      hasInitialized: state.hasInitialized,
      refresh,
      // SPRINT-062: Validation status fields
      validationStatus,
      isValid,
      blockReason,
      trialDaysRemaining,
      transactionCount,
      transactionLimit,
      canCreateTransaction,
    }),
    [
      state,
      canExport,
      canSubmit,
      canAutoDetect,
      refresh,
      validationStatus,
      isValid,
      blockReason,
      trialDaysRemaining,
      transactionCount,
      transactionLimit,
      canCreateTransaction,
    ]
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
