/**
 * State Machine Types
 *
 * Comprehensive TypeScript types for the unified state machine that replaces
 * fragmented hook-based state coordination. These types form the foundation
 * for the state coordination layer (BACKLOG-142).
 *
 * @module appCore/state/machine/types
 */

// ============================================
// LOADING PHASES
// ============================================

/**
 * Loading phases in initialization sequence.
 * MUST execute in this order.
 */
export type LoadingPhase =
  | "checking-storage" // Check if encryption key store exists
  | "initializing-db" // Initialize secure storage (may prompt on macOS)
  | "loading-auth" // Check authentication state
  | "loading-user-data"; // Load phone type, email status, etc.

// ============================================
// ONBOARDING STEPS
// ============================================

/**
 * Onboarding steps - MUST match existing OnboardingFlow registry.
 * See: src/components/onboarding/types/steps.ts
 * See: src/components/onboarding/steps/index.ts
 *
 * Note: 'terms' is handled as a modal in AppRouter, not as an onboarding step.
 */
export type OnboardingStep =
  | "phone-type" // Phone type selection screen
  | "secure-storage" // macOS keychain explanation (keychain-explanation route)
  | "email-connect" // Email onboarding screen
  | "permissions" // macOS permissions
  | "apple-driver" // Windows + iPhone driver setup
  | "android-coming-soon"; // Android placeholder

// ============================================
// PLATFORM INFO
// ============================================

/**
 * Platform-specific information used for conditional onboarding flows
 * and feature availability.
 */
export interface PlatformInfo {
  /** True if running on macOS */
  isMacOS: boolean;
  /** True if running on Windows */
  isWindows: boolean;
  /** True if user selected iPhone (affects driver setup on Windows) */
  hasIPhone: boolean;
}

// ============================================
// USER DATA
// ============================================

/**
 * Authenticated user information from Supabase.
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name (optional) */
  displayName?: string;
  /** URL to user's avatar image (optional) */
  avatarUrl?: string;
}

/**
 * User preferences and onboarding completion state.
 * Persisted to database after initialization.
 */
export interface UserData {
  /** Selected phone type during onboarding */
  phoneType: "iphone" | "android" | null;
  /** True if user completed email onboarding (connected or skipped) */
  hasCompletedEmailOnboarding: boolean;
  /** True if user has connected an email account */
  hasEmailConnected: boolean;
  /** True if Windows + iPhone user needs Apple Mobile Device driver */
  needsDriverSetup: boolean;
  /** True if macOS user has granted Full Disk Access */
  hasPermissions: boolean;
}

// ============================================
// ERRORS
// ============================================

/**
 * Structured error information for error states.
 */
export interface AppError {
  /** Error code for programmatic handling */
  code: AppErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details (e.g., stack trace, context) */
  details?: unknown;
}

/**
 * Error codes for different failure scenarios.
 */
export type AppErrorCode =
  | "STORAGE_CHECK_FAILED" // Failed to check secure storage
  | "DB_INIT_FAILED" // Failed to initialize database
  | "AUTH_FAILED" // Failed to authenticate user
  | "USER_DATA_FAILED" // Failed to load user data
  | "NETWORK_ERROR" // Network connectivity issue
  | "UNKNOWN_ERROR"; // Catch-all for unexpected errors

// ============================================
// APP STATES (Discriminated Union)
// ============================================

/**
 * All possible application states.
 * Uses discriminated union pattern with 'status' as discriminant.
 */
export type AppState =
  | LoadingState
  | UnauthenticatedState
  | OnboardingState
  | ReadyState
  | ErrorState;

/**
 * Application is loading and initializing.
 * Progresses through phases in order.
 */
export interface LoadingState {
  status: "loading";
  /** Current phase in the loading sequence */
  phase: LoadingPhase;
  /** Optional progress 0-100 for long phases */
  progress?: number;
  /**
   * User info from LOGIN_SUCCESS action.
   * Only present when entering loading-user-data from fresh login.
   */
  user?: User;
  /**
   * Platform info from LOGIN_SUCCESS action.
   * Only present when entering loading-user-data from fresh login.
   */
  platform?: PlatformInfo;
}

/**
 * User is not authenticated.
 * Show login screen.
 */
export interface UnauthenticatedState {
  status: "unauthenticated";
}

/**
 * User is authenticated but needs to complete onboarding.
 * Progress through onboarding steps.
 */
export interface OnboardingState {
  status: "onboarding";
  /** Current onboarding step */
  step: OnboardingStep;
  /** Authenticated user */
  user: User;
  /** Platform information */
  platform: PlatformInfo;
  /** Track which steps are complete */
  completedSteps: OnboardingStep[];
}

/**
 * Application is fully initialized and ready to use.
 * User has completed authentication and onboarding.
 */
export interface ReadyState {
  status: "ready";
  /** Authenticated user */
  user: User;
  /** Platform information */
  platform: PlatformInfo;
  /** User preferences and completion state */
  userData: UserData;
}

/**
 * Application encountered an error.
 * May be recoverable or require restart.
 */
export interface ErrorState {
  status: "error";
  /** Error details */
  error: AppError;
  /** If true, user can retry/recover */
  recoverable: boolean;
  /** Previous state to return to on retry */
  previousState?: AppState;
}

// ============================================
// ACTIONS (Discriminated Union)
// ============================================

/**
 * All possible actions that can be dispatched to the state machine.
 * Uses discriminated union pattern with 'type' as discriminant.
 */
export type AppAction =
  | StorageCheckedAction
  | DbInitStartedAction
  | DbInitCompleteAction
  | AuthLoadedAction
  | LoginSuccessAction
  | UserDataLoadedAction
  | OnboardingStepCompleteAction
  | OnboardingSkipAction
  | AppReadyAction
  | LogoutAction
  | ErrorAction
  | RetryAction;

/**
 * Storage check completed - determined if key store exists.
 */
export interface StorageCheckedAction {
  type: "STORAGE_CHECKED";
  /** True if encryption key store exists */
  hasKeyStore: boolean;
}

/**
 * Database initialization has started.
 * May trigger OS prompt on macOS for keychain access.
 */
export interface DbInitStartedAction {
  type: "DB_INIT_STARTED";
}

/**
 * Database initialization completed.
 */
export interface DbInitCompleteAction {
  type: "DB_INIT_COMPLETE";
  /** True if initialization succeeded */
  success: boolean;
  /** Error message if initialization failed */
  error?: string;
}

/**
 * Authentication state loaded.
 */
export interface AuthLoadedAction {
  type: "AUTH_LOADED";
  /** Authenticated user or null if not authenticated */
  user: User | null;
  /** True if this is a new user (needs full onboarding) */
  isNewUser: boolean;
  /** Platform information */
  platform: PlatformInfo;
}

/**
 * Fresh login completed successfully.
 * Dispatched when a user logs in (not during app restart).
 * Transitions state machine from unauthenticated to loading-user-data.
 */
export interface LoginSuccessAction {
  type: "LOGIN_SUCCESS";
  /** Authenticated user */
  user: User;
  /** Platform information */
  platform: PlatformInfo;
  /** True if this is a new user (needs full onboarding) */
  isNewUser: boolean;
}

/**
 * User data loaded from database.
 */
export interface UserDataLoadedAction {
  type: "USER_DATA_LOADED";
  /** User preferences and completion state */
  data: UserData;
}

/**
 * User completed an onboarding step.
 */
export interface OnboardingStepCompleteAction {
  type: "ONBOARDING_STEP_COMPLETE";
  /** The step that was completed */
  step: OnboardingStep;
}

/**
 * User skipped an onboarding step.
 */
export interface OnboardingSkipAction {
  type: "ONBOARDING_SKIP";
  /** The step that was skipped */
  step: OnboardingStep;
}

/**
 * Application is ready - all initialization and onboarding complete.
 */
export interface AppReadyAction {
  type: "APP_READY";
}

/**
 * User logged out.
 */
export interface LogoutAction {
  type: "LOGOUT";
}

/**
 * An error occurred.
 */
export interface ErrorAction {
  type: "ERROR";
  /** Error details */
  error: AppError;
  /** True if error is recoverable (default: false) */
  recoverable?: boolean;
}

/**
 * User is retrying after an error.
 */
export interface RetryAction {
  type: "RETRY";
}

// ============================================
// CONTEXT VALUE
// ============================================

/**
 * Context value provided by AppStateProvider.
 * Includes state, dispatch, and derived selectors for convenience.
 */
export interface AppStateContextValue {
  /** Current state */
  state: AppState;
  /** Dispatch action to update state */
  dispatch: React.Dispatch<AppAction>;

  // ============================================
  // DERIVED SELECTORS (for convenience)
  // ============================================

  /** True when status is 'loading' */
  isLoading: boolean;
  /** True when status is 'ready' */
  isReady: boolean;
  /** Current user or null */
  currentUser: User | null;
  /** Platform info or null (only available after auth loaded) */
  platform: PlatformInfo | null;
  /** Current loading phase or null */
  loadingPhase: LoadingPhase | null;
  /** Current onboarding step or null */
  onboardingStep: OnboardingStep | null;
  /** Current error or null */
  error: AppError | null;
}

// ============================================
// INITIAL STATE
// ============================================

/**
 * Initial state for the application.
 * Starts in loading state, checking storage.
 */
export const INITIAL_APP_STATE: LoadingState = {
  status: "loading",
  phase: "checking-storage",
};
