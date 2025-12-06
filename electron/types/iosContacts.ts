/**
 * iOS Contacts Database Types
 *
 * Type definitions for parsing iOS AddressBook.sqlitedb contacts
 * from iTunes-style backups.
 */

/**
 * Phone number entry from a contact
 */
export interface ContactPhone {
  /** Label for the phone number (e.g., "mobile", "home", "work") */
  label: string;
  /** Raw phone number as stored in the database */
  number: string;
  /** Normalized phone number in E.164 format for matching */
  normalizedNumber: string;
}

/**
 * Email address entry from a contact
 */
export interface ContactEmail {
  /** Label for the email address (e.g., "home", "work") */
  label: string;
  /** Email address */
  email: string;
}

/**
 * Parsed iOS contact with all associated data
 */
export interface iOSContact {
  /** Contact ID (ROWID from ABPerson table) */
  id: number;
  /** First name, or null if not set */
  firstName: string | null;
  /** Last name, or null if not set */
  lastName: string | null;
  /** Organization name, or null if not set */
  organization: string | null;
  /** All phone numbers associated with this contact */
  phoneNumbers: ContactPhone[];
  /** All email addresses associated with this contact */
  emails: ContactEmail[];
  /** Computed display name: "First Last", Organization, or "Unknown" */
  displayName: string;
}

/**
 * Result of looking up a contact by phone or email
 */
export interface ContactLookupResult {
  /** The matched contact, or null if not found */
  contact: iOSContact | null;
  /** How the contact was matched, or null if not found */
  matchedOn: "phone" | "email" | null;
}

/**
 * Raw contact row from ABPerson table
 */
export interface RawContactRow {
  ROWID: number;
  First: string | null;
  Last: string | null;
  Organization: string | null;
}

/**
 * Raw multi-value row from ABMultiValue table
 */
export interface RawMultiValueRow {
  record_id: number;
  property: number;
  label: string | null;
  value: string;
}

/**
 * Property types in ABMultiValue table
 */
export const ABMultiValuePropertyType = {
  PHONE: 3,
  EMAIL: 4,
} as const;

export type ABMultiValuePropertyType =
  (typeof ABMultiValuePropertyType)[keyof typeof ABMultiValuePropertyType];
