/**
 * Type definitions for fake iOS backup fixtures
 * Used for testing iOS backup parsing, message extraction, and contact lookup
 *
 * @module fake-ios-backup/types
 */

/**
 * Message service type (iMessage vs SMS)
 */
export type MessageService = 'iMessage' | 'SMS';

/**
 * Message category for test classification
 */
export type MessageCategory = 'transaction' | 'normal' | 'spam' | 'edge_case';

/**
 * Difficulty level for test classification
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/**
 * Chat type classification
 */
export type ChatType = 'individual' | 'group';

/**
 * Expected classification results for a fake message
 */
export interface ExpectedClassification {
  /** Whether the message is related to a real estate transaction */
  isTransactionRelated: boolean;
  /** Keywords expected to be detected */
  expectedKeywords?: string[];
  /** Transaction stage if applicable */
  transactionStage?: 'intro' | 'showing' | 'offer' | 'inspections' | 'escrow' | 'closing' | 'post_closing';
}

/**
 * A fake attachment for testing purposes
 */
export interface FakeAttachment {
  /** Attachment ID */
  id: number;
  /** Globally unique identifier */
  guid: string;
  /** File path (simulated) */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Transfer name (original filename) */
  transferName: string;
}

/**
 * A fake message for testing purposes
 * Designed to match the structure expected by iOSMessagesParser
 */
export interface FakeMessage {
  /** Message ID (ROWID in sms.db) */
  id: number;
  /** Globally unique identifier */
  guid: string;
  /** Message text content (null for attachment-only messages) */
  text: string | null;
  /** Handle ID - references the sender/recipient */
  handleId: number;
  /** Whether the message was sent by the device owner */
  isFromMe: boolean;
  /** Apple epoch timestamp (nanoseconds since 2001-01-01) */
  date: number;
  /** Apple epoch timestamp when message was read (null if unread) */
  dateRead: number | null;
  /** Apple epoch timestamp when message was delivered (null for incoming) */
  dateDelivered: number | null;
  /** Message service type */
  service: MessageService;
  /** Chat IDs this message belongs to */
  chatIds: number[];
  /** Attachment IDs for this message */
  attachmentIds: number[];

  // Test metadata
  /** Category for test filtering */
  category: MessageCategory;
  /** Difficulty level for classification */
  difficulty: DifficultyLevel;
  /** Expected classification results */
  expected: ExpectedClassification;
  /** Test notes or description */
  notes?: string;
}

/**
 * A fake handle (contact reference) for testing
 */
export interface FakeHandle {
  /** Handle ID (ROWID in sms.db) */
  id: number;
  /** Phone number or email address */
  identifier: string;
  /** Service type */
  service: MessageService;
}

/**
 * A fake chat (conversation) for testing
 */
export interface FakeChat {
  /** Chat ID (ROWID in sms.db) */
  id: number;
  /** Globally unique identifier */
  guid: string;
  /** Chat identifier (phone number for individual, group ID for groups) */
  chatIdentifier: string;
  /** Display name (for group chats) */
  displayName: string | null;
  /** Chat style: 43 = group, 45 = individual (in iOS) */
  style: number;
  /** Handle IDs in this chat */
  handleIds: number[];
  /** Chat type classification */
  chatType: ChatType;
}

/**
 * A fake contact for testing purposes
 * Designed to match the structure expected by iOSContactsParser
 */
export interface FakeContact {
  /** Contact ID (ROWID in ABPerson) */
  id: number;
  /** First name */
  firstName: string | null;
  /** Last name */
  lastName: string | null;
  /** Organization name */
  organization: string | null;
  /** Phone numbers with labels */
  phoneNumbers: FakeContactPhone[];
  /** Email addresses with labels */
  emails: FakeContactEmail[];
  /** Computed display name */
  displayName: string;
  /** Contact role in real estate context */
  role?: 'agent' | 'buyer' | 'seller' | 'lender' | 'title' | 'inspector' | 'attorney' | 'other';
  /** Test notes */
  notes?: string;
}

/**
 * Phone number entry for a fake contact
 */
export interface FakeContactPhone {
  /** Label (e.g., "mobile", "home", "work") */
  label: string;
  /** Raw phone number as stored */
  number: string;
  /** Normalized phone number for matching */
  normalizedNumber: string;
}

/**
 * Email entry for a fake contact
 */
export interface FakeContactEmail {
  /** Label (e.g., "home", "work") */
  label: string;
  /** Email address */
  email: string;
}

/**
 * Metadata for the message fixture collection
 */
export interface MessageFixtureMetadata {
  /** Description of the fixture collection */
  description: string;
  /** Fixture version for compatibility tracking */
  version: string;
  /** Total number of messages */
  totalMessages: number;
  /** Number of conversations (chats) */
  conversations: number;
  /** Number of handles (unique contacts) */
  handles: number;
  /** Number of attachments */
  attachments: number;
  /** Number of transaction-related messages */
  transactionMessages: number;
  /** Number of group chats */
  groupChats: number;
  /** Number of individual chats */
  individualChats: number;
  /** Number of iMessage messages */
  iMessages: number;
  /** Number of SMS messages */
  smsMessages: number;
  /** Additional notes */
  notes?: string;
}

/**
 * Root structure for the messages fixture JSON file
 */
export interface MessageFixtureData {
  /** Fixture metadata */
  metadata: MessageFixtureMetadata;
  /** Array of fake handles */
  handles: FakeHandle[];
  /** Array of fake chats */
  chats: FakeChat[];
  /** Array of fake messages */
  messages: FakeMessage[];
  /** Array of fake attachments */
  attachments: FakeAttachment[];
}

/**
 * Metadata for the contact fixture collection
 */
export interface ContactFixtureMetadata {
  /** Description of the fixture collection */
  description: string;
  /** Fixture version for compatibility tracking */
  version: string;
  /** Total number of contacts */
  totalContacts: number;
  /** Number of contacts with phone numbers */
  contactsWithPhones: number;
  /** Number of contacts with emails */
  contactsWithEmails: number;
  /** Number of real estate professionals */
  realEstateProfessionals: number;
  /** Additional notes */
  notes?: string;
}

/**
 * Root structure for the contacts fixture JSON file
 */
export interface ContactFixtureData {
  /** Fixture metadata */
  metadata: ContactFixtureMetadata;
  /** Array of fake contacts */
  contacts: FakeContact[];
}

/**
 * Filter options for selecting messages from fixtures
 */
export interface MessageFixtureFilter {
  /** Filter by service type */
  service?: MessageService;
  /** Filter by category */
  category?: MessageCategory;
  /** Filter by difficulty */
  difficulty?: DifficultyLevel;
  /** Filter by chat ID */
  chatId?: number;
  /** Filter by handle ID */
  handleId?: number;
  /** Filter by expected transaction status */
  isTransactionRelated?: boolean;
  /** Filter by from me status */
  isFromMe?: boolean;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Filter options for selecting contacts from fixtures
 */
export interface ContactFixtureFilter {
  /** Filter by role */
  role?: FakeContact['role'];
  /** Filter by having phone number */
  hasPhone?: boolean;
  /** Filter by having email */
  hasEmail?: boolean;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Statistics about the loaded message fixtures
 */
export interface MessageFixtureStats {
  /** Total messages */
  total: number;
  /** Messages by category */
  byCategory: Record<MessageCategory, number>;
  /** Messages by service */
  byService: Record<MessageService, number>;
  /** Messages by difficulty */
  byDifficulty: Record<DifficultyLevel, number>;
  /** Number of conversations */
  conversations: number;
  /** Number of group conversations */
  groupConversations: number;
}

/**
 * Statistics about the loaded contact fixtures
 */
export interface ContactFixtureStats {
  /** Total contacts */
  total: number;
  /** Contacts by role */
  byRole: Record<NonNullable<FakeContact['role']> | 'none', number>;
  /** Contacts with phone numbers */
  withPhones: number;
  /** Contacts with emails */
  withEmails: number;
}

/**
 * Apple timestamp conversion utilities
 */
export interface AppleTimestampUtils {
  /** Convert Date to Apple timestamp (nanoseconds since 2001-01-01) */
  toAppleTimestamp: (date: Date) => number;
  /** Convert Apple timestamp to Date */
  fromAppleTimestamp: (timestamp: number) => Date;
}

/**
 * Apple epoch constant: milliseconds since Unix epoch for 2001-01-01 00:00:00 UTC
 */
export const APPLE_EPOCH_MS = 978307200000;
