/**
 * Contact Types (Android Companion)
 * Type definitions for contacts synced from the Android device to the desktop.
 *
 * BACKLOG-1449: Sync Android contacts to desktop via companion app
 */

// ============================================
// CONTACT TYPES
// ============================================

/**
 * A phone number entry from the Android contacts provider.
 */
export interface ContactPhone {
  /** Phone number as stored on the device */
  number: string;
  /** Android label (e.g., "mobile", "home", "work") */
  label?: string;
}

/**
 * An email address entry from the Android contacts provider.
 */
export interface ContactEmail {
  /** Email address */
  address: string;
  /** Android label (e.g., "home", "work") */
  label?: string;
}

/**
 * A single contact to sync from Android to the desktop.
 * Contains the core fields needed for contact matching and display.
 */
export interface SyncContact {
  /** Stable contact ID from the Android contacts provider */
  id: string;
  /** Display name (first + last or organization fallback) */
  displayName: string;
  /** Phone numbers associated with the contact */
  phones: ContactPhone[];
  /** Email addresses associated with the contact */
  emails: ContactEmail[];
  /** Company / organization name */
  company?: string;
  /** Job title */
  title?: string;
}
