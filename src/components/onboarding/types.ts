/**
 * Onboarding Step Architecture Type Definitions
 *
 * This file contains all type definitions for the unified onboarding step system.
 * These types enable a declarative, configuration-driven approach to onboarding flows.
 *
 * @module onboarding/types
 */

import type { ComponentType } from "react";
import type { PhoneType } from "../../appCore/state/types";

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Supported platform identifiers for the application.
 * Used to determine which onboarding steps are relevant for the current platform.
 */
export type Platform = "macos" | "windows" | "linux";

/**
 * Unique identifiers for each onboarding step.
 * These IDs are used for step navigation, persistence, and configuration lookup.
 */
export type OnboardingStepId =
  | "welcome"
  | "terms"
  | "phone-type"
  | "android-coming-soon"
  | "secure-storage"
  | "driver-setup"
  | "apple-driver"
  | "email-connect"
  | "permissions"
  | "complete";

// =============================================================================
// STEP CONFIGURATION
// =============================================================================

/**
 * Configuration for skippable onboarding steps.
 * Defines whether a step can be skipped and the associated UI text.
 */
export interface SkipConfig {
  /**
   * Whether the skip option is enabled for this step.
   * When true, users can bypass this step in the onboarding flow.
   */
  enabled: boolean;

  /**
   * Label text for the skip button.
   * @example "Skip for now"
   */
  label: string;

  /**
   * Optional description explaining the implications of skipping.
   * Displayed below the skip button to inform users of what they'll miss.
   * @example "You can connect your email later from Settings"
   */
  description?: string;
}

/**
 * Navigation configuration for an onboarding step.
 * Controls how users move through the onboarding flow.
 */
export interface StepNavigationConfig {
  /**
   * Whether a back button should be displayed.
   * @default true
   */
  showBack?: boolean;

  /**
   * Custom label for the back button.
   * @default "Back"
   */
  backLabel?: string;

  /**
   * Custom label for the continue/next button.
   * @default "Continue"
   */
  continueLabel?: string;

  /**
   * Whether the continue button should be hidden.
   * Useful for steps that auto-advance or have custom navigation.
   * @default false
   */
  hideContinue?: boolean;
}

/**
 * Metadata describing an onboarding step's configuration and behavior.
 * This is the primary configuration object for defining onboarding steps.
 */
export interface OnboardingStepMeta {
  /**
   * Unique identifier for this step.
   * Used for step lookup, navigation, and state persistence.
   */
  id: OnboardingStepId;

  /**
   * Human-readable label displayed in the progress indicator.
   * @example "Phone Type", "Connect Email"
   */
  progressLabel: string;

  /**
   * List of platforms where this step should be displayed.
   * If empty or undefined, the step is shown on all platforms.
   * @example ["macos"] - Only shown on macOS
   * @example ["macos", "windows"] - Shown on macOS and Windows
   */
  platforms?: Platform[];

  /**
   * Navigation configuration for this step.
   * Controls back/continue button visibility and labels.
   */
  navigation?: StepNavigationConfig;

  /**
   * Skip configuration for this step.
   * If undefined, the step cannot be skipped.
   */
  skip?: SkipConfig;

  /**
   * Function to determine if this step should be considered complete.
   * Used for progress tracking and determining the initial step on resume.
   *
   * @param context - The current onboarding context
   * @returns true if the step is complete, false otherwise
   *
   * @example
   * isStepComplete: (ctx) => ctx.phoneType !== null
   */
  isStepComplete?: (context: OnboardingContext) => boolean;

  /**
   * Function to determine if this step should be shown.
   * Allows dynamic step visibility based on previous selections.
   *
   * @param context - The current onboarding context
   * @returns true if the step should be shown, false to skip it
   *
   * @example
   * // Only show driver setup for iPhone users on macOS
   * shouldShow: (ctx) => ctx.phoneType === 'iphone' && ctx.platform === 'macos'
   */
  shouldShow?: (context: OnboardingContext) => boolean;

  /**
   * Optional custom validation before allowing progression.
   * If provided, the step won't advance until this returns true.
   *
   * @param context - The current onboarding context
   * @returns true if the step can be completed, false to prevent advancement
   */
  canProceed?: (context: OnboardingContext) => boolean;
}

// =============================================================================
// CONTEXT & STATE
// =============================================================================

/**
 * Onboarding context containing all state needed during the onboarding flow.
 * This context is passed to step components and used for conditional logic.
 */
export interface OnboardingContext {
  /**
   * The current platform the application is running on.
   */
  platform: Platform;

  /**
   * The user's selected phone type.
   * null if not yet selected.
   */
  phoneType: PhoneType;

  /**
   * Whether an email account has been connected.
   */
  emailConnected: boolean;

  /**
   * The email address of the connected account.
   * null if no email is connected.
   */
  connectedEmail: string | null;

  /**
   * Whether the user explicitly skipped email connection.
   * Used to distinguish between "not yet done" and "intentionally skipped".
   */
  emailSkipped: boolean;

  /**
   * Whether the user explicitly skipped driver setup.
   * Used to determine if driver setup should be prompted again.
   */
  driverSkipped: boolean;

  /**
   * Whether the Apple driver has been set up (macOS iPhone users only).
   */
  driverSetupComplete: boolean;

  /**
   * Whether required permissions have been granted.
   */
  permissionsGranted: boolean;

  /**
   * Whether terms of service have been accepted.
   */
  termsAccepted: boolean;

  /**
   * Email provider for the connected account.
   * null if no email is connected.
   */
  emailProvider: "google" | "microsoft" | null;

  /**
   * Authentication provider the user logged in with.
   * Used to determine primary email provider recommendation.
   */
  authProvider: "google" | "microsoft";

  /**
   * Whether this is a new user going through initial onboarding.
   * Affects which steps are shown and default behaviors.
   */
  isNewUser: boolean;

  /**
   * Whether the database has been initialized.
   * Some steps may be blocked until database setup is complete.
   */
  isDatabaseInitialized: boolean;
}

// =============================================================================
// STEP ACTIONS
// =============================================================================

/**
 * Base interface for all step actions.
 * All actions must have a type discriminator.
 */
interface BaseStepAction {
  type: string;
}

/**
 * Action dispatched when user selects their phone type.
 */
export interface SelectPhoneAction extends BaseStepAction {
  type: "SELECT_PHONE";
  payload: {
    phoneType: NonNullable<PhoneType>;
  };
}

/**
 * Action dispatched when user initiates email connection.
 * The orchestrator handles the actual OAuth flow.
 */
export interface ConnectEmailStartAction extends BaseStepAction {
  type: "CONNECT_EMAIL_START";
  payload: {
    provider: "google" | "microsoft";
  };
}

/**
 * Action dispatched when email connection is completed.
 */
export interface EmailConnectedAction extends BaseStepAction {
  type: "EMAIL_CONNECTED";
  payload: {
    email: string;
    provider: "google" | "microsoft";
  };
}

/**
 * Action dispatched when email connection is skipped.
 */
export interface EmailSkippedAction extends BaseStepAction {
  type: "EMAIL_SKIPPED";
}

/**
 * Action dispatched when required permissions are granted.
 */
export interface PermissionGrantedAction extends BaseStepAction {
  type: "PERMISSION_GRANTED";
}

/**
 * Action dispatched when driver setup is completed.
 */
export interface DriverSetupCompleteAction extends BaseStepAction {
  type: "DRIVER_SETUP_COMPLETE";
}

/**
 * Action dispatched when driver setup is skipped.
 */
export interface DriverSkippedAction extends BaseStepAction {
  type: "DRIVER_SKIPPED";
}

/**
 * Action dispatched when terms are accepted.
 */
export interface TermsAcceptedAction extends BaseStepAction {
  type: "TERMS_ACCEPTED";
}

/**
 * Action dispatched when terms are declined.
 */
export interface TermsDeclinedAction extends BaseStepAction {
  type: "TERMS_DECLINED";
}

/**
 * Action dispatched when secure storage setup is confirmed.
 * Includes the user's preference for skipping the explanation in the future.
 */
export interface SecureStorageSetupAction extends BaseStepAction {
  type: "SECURE_STORAGE_SETUP";
  /**
   * Whether the user wants to skip the explanation screen in the future.
   */
  dontShowAgain: boolean;
}

/**
 * Action dispatched to navigate to the next step.
 */
export interface NavigateNextAction extends BaseStepAction {
  type: "NAVIGATE_NEXT";
}

/**
 * Action dispatched to navigate to the previous step.
 */
export interface NavigateBackAction extends BaseStepAction {
  type: "NAVIGATE_BACK";
}

/**
 * Action dispatched when onboarding is fully completed.
 */
export interface OnboardingCompleteAction extends BaseStepAction {
  type: "ONBOARDING_COMPLETE";
}

/**
 * Action dispatched from Android Coming Soon screen to go back and select iPhone.
 */
export interface GoBackSelectIphoneAction extends BaseStepAction {
  type: "GO_BACK_SELECT_IPHONE";
}

/**
 * Action dispatched from Android Coming Soon screen to continue with email only.
 */
export interface ContinueEmailOnlyAction extends BaseStepAction {
  type: "CONTINUE_EMAIL_ONLY";
}

/**
 * Union type of all possible step actions.
 * Used for type-safe action handling in step components.
 */
export type StepAction =
  | SelectPhoneAction
  | ConnectEmailStartAction
  | EmailConnectedAction
  | EmailSkippedAction
  | PermissionGrantedAction
  | DriverSetupCompleteAction
  | DriverSkippedAction
  | TermsAcceptedAction
  | TermsDeclinedAction
  | SecureStorageSetupAction
  | NavigateNextAction
  | NavigateBackAction
  | OnboardingCompleteAction
  | GoBackSelectIphoneAction
  | ContinueEmailOnlyAction;

/**
 * Type guard to extract the action type string literal.
 */
export type StepActionType = StepAction["type"];

// =============================================================================
// STEP COMPONENTS
// =============================================================================

/**
 * Props passed to all onboarding step content components.
 * Provides access to context and action dispatch.
 */
export interface OnboardingStepContentProps {
  /**
   * The current onboarding context with all state.
   * Use this to conditionally render UI based on previous selections.
   */
  context: OnboardingContext;

  /**
   * Dispatch function to trigger step actions.
   * Call this when user interactions require state changes or navigation.
   *
   * @param action - The action to dispatch
   *
   * @example
   * onAction({ type: 'SELECT_PHONE', payload: { phoneType: 'iphone' } })
   */
  onAction: (action: StepAction) => void;
}

/**
 * Complete onboarding step definition.
 * Combines metadata configuration with the content component.
 */
export interface OnboardingStep {
  /**
   * Step metadata defining behavior and configuration.
   */
  meta: OnboardingStepMeta;

  /**
   * React component that renders the step content.
   * Receives context and action dispatch as props.
   */
  Content: ComponentType<OnboardingStepContentProps>;
}

// =============================================================================
// REGISTRY & CONFIGURATION
// =============================================================================

/**
 * Registry of all onboarding steps keyed by their ID.
 * Used for step lookup and iteration.
 */
export type OnboardingStepRegistry = Record<OnboardingStepId, OnboardingStep>;

/**
 * Ordered list of step IDs defining the default flow sequence.
 * The actual steps shown may vary based on platform and context.
 */
export type OnboardingFlowSequence = readonly OnboardingStepId[];

/**
 * Configuration for the entire onboarding flow.
 */
export interface OnboardingFlowConfig {
  /**
   * Registry of all available steps.
   */
  steps: OnboardingStepRegistry;

  /**
   * Default sequence of steps (may be filtered based on context).
   */
  defaultSequence: OnboardingFlowSequence;

  /**
   * Initial context values for new onboarding flows.
   */
  initialContext: Partial<OnboardingContext>;
}

// =============================================================================
// PERSISTENCE
// =============================================================================

/**
 * Serializable onboarding state for persistence.
 * Contains only the fields that should be saved/restored.
 */
export interface OnboardingPersistedState {
  /**
   * ID of the last completed step.
   */
  lastCompletedStepId: OnboardingStepId | null;

  /**
   * ID of the current step (where user left off).
   */
  currentStepId: OnboardingStepId;

  /**
   * The onboarding context at time of persistence.
   */
  context: OnboardingContext;

  /**
   * Timestamp of when state was persisted.
   */
  persistedAt: string;

  /**
   * Version number for migration compatibility.
   */
  version: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract step IDs that match certain criteria.
 * Useful for type-safe step filtering.
 */
export type SkippableStepId = Extract<
  OnboardingStepId,
  "email-connect" | "driver-setup"
>;

/**
 * Props for the main onboarding orchestrator component.
 */
export interface OnboardingOrchestratorProps {
  /**
   * Configuration for the onboarding flow.
   */
  config: OnboardingFlowConfig;

  /**
   * Optional initial context overrides.
   */
  initialContext?: Partial<OnboardingContext>;

  /**
   * Callback when onboarding is fully completed.
   */
  onComplete: () => void;

  /**
   * Optional callback for step changes.
   */
  onStepChange?: (stepId: OnboardingStepId, context: OnboardingContext) => void;

  /**
   * Optional callback to persist state.
   */
  onPersist?: (state: OnboardingPersistedState) => void;
}

/**
 * Return type for the useOnboardingFlow hook.
 */
export interface UseOnboardingFlowReturn {
  /**
   * Current step metadata.
   */
  currentStep: OnboardingStepMeta;

  /**
   * Current step index in the flow sequence.
   */
  currentStepIndex: number;

  /**
   * Total number of steps in the flow.
   */
  totalSteps: number;

  /**
   * The current onboarding context.
   */
  context: OnboardingContext;

  /**
   * Whether currently on the first step.
   */
  isFirstStep: boolean;

  /**
   * Whether currently on the last step.
   */
  isLastStep: boolean;

  /**
   * Navigate to the next step.
   */
  goNext: () => void;

  /**
   * Navigate to the previous step.
   */
  goBack: () => void;

  /**
   * Navigate to a specific step by ID.
   */
  goToStep: (stepId: OnboardingStepId) => void;

  /**
   * Dispatch an action to update context.
   */
  dispatch: (action: StepAction) => void;

  /**
   * List of visible steps based on current context.
   */
  visibleSteps: OnboardingStepMeta[];
}
