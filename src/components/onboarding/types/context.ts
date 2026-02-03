/**
 * Onboarding Context Type Definitions
 *
 * State context types for the onboarding flow.
 *
 * @module onboarding/types/context
 */

import type { PhoneType } from "../../../appCore/state/types";
import type { Platform } from "./steps";

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

  /**
   * The current user's ID.
   * null if not logged in yet.
   */
  userId: string | null;

  /**
   * Whether the current user exists in the local database.
   * BACKLOG-611: False when a new user logs in on a machine with a previous install.
   * Used to determine if secure-storage step should be shown even when DB is initialized.
   */
  currentUserInLocalDb: boolean;
}
