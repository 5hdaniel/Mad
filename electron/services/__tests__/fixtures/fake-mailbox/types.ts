/**
 * Type definitions for fake email mailbox fixtures
 * Used for testing email sync, AI detection, and transaction extraction features
 *
 * @module fake-mailbox/types
 */

import { TransactionStage, TransactionType } from '../../../../types/models';

/**
 * Email provider type
 */
export type EmailProvider = 'gmail' | 'outlook';

/**
 * Email category for test classification
 */
export type EmailCategory = 'transaction' | 'spam' | 'normal' | 'edge_case';

/**
 * Difficulty level for test classification
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/**
 * Expected classification results for a fake email
 */
export interface ExpectedClassification {
  /** Whether the email is related to a real estate transaction */
  isTransaction: boolean;
  /** The type of transaction (if applicable) */
  transactionType: TransactionType | null;
  /** Whether the email should be classified as spam */
  shouldBeSpam: boolean;
  /** Whether the email contains transaction indicators (even if not a transaction) */
  containsTransactionIndicators?: boolean;
}

/**
 * Attachment metadata for fake emails (not actual files)
 */
export interface FakeAttachment {
  /** Attachment filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes (simulated) */
  sizeBytes: number;
  /** Expected document type classification */
  expectedDocType?: string;
}

/**
 * A fake email for testing purposes
 * Designed to be compatible with ParsedEmail interface from gmailFetchService/outlookFetchService
 */
export interface FakeEmail {
  // Core identifiers (deterministic for reproducibility)
  /** Unique email ID (format: fake-email-XXX) */
  id: string;
  /** Thread ID for grouping related emails */
  thread_id: string;

  // Provider information
  /** Email provider (gmail or outlook) */
  provider: EmailProvider;

  // Email content
  /** Email subject line */
  subject: string;
  /** Plain text email body */
  body: string;
  /** HTML email body (optional) */
  bodyHtml?: string;
  /** Email snippet/preview */
  snippet?: string;

  // Participants
  /** Sender email address */
  sender: string;
  /** Recipient email addresses */
  recipients: string[];
  /** CC recipients (optional) */
  cc?: string[];
  /** BCC recipients (optional) */
  bcc?: string[];

  // Metadata
  /** Email labels/folders (Gmail style: INBOX, SENT, SPAM, etc.) */
  labels: string[];
  /** ISO 8601 timestamp when email was sent */
  sent_at: string;

  // Attachment metadata
  /** Whether the email has attachments */
  hasAttachments: boolean;
  /** Number of attachments */
  attachmentCount: number;
  /** Attachment metadata (not actual files) */
  attachments?: FakeAttachment[];

  // Test metadata
  /** Category for test filtering */
  category: EmailCategory;
  /** Transaction stage (if applicable) */
  stage?: TransactionStage;
  /** Difficulty level for classification */
  difficulty: DifficultyLevel;
  /** Expected classification results */
  expected: ExpectedClassification;

  // Additional test context
  /** Test notes or description */
  notes?: string;
}

/**
 * Metadata for the email fixture collection
 */
export interface EmailFixtureMetadata {
  /** Description of the fixture collection */
  description: string;
  /** Fixture version for compatibility tracking */
  version: string;
  /** Total number of emails in the fixture */
  totalEmails: number;
  /** Number of transaction-related emails */
  transactionEmails: number;
  /** Number of spam emails */
  spamEmails: number;
  /** Number of normal (non-transaction, non-spam) emails */
  normalEmails: number;
  /** Number of edge case emails */
  edgeCaseEmails: number;
  /** Number of unique threads */
  threads: number;
  /** Number of Gmail format emails */
  gmailEmails: number;
  /** Number of Outlook format emails */
  outlookEmails: number;
  /** Additional notes about the fixture */
  notes?: string;
}

/**
 * Root structure for the email fixture JSON file
 */
export interface EmailFixtureData {
  /** Fixture metadata */
  metadata: EmailFixtureMetadata;
  /** Array of fake emails */
  emails: FakeEmail[];
}

/**
 * Filter options for selecting emails from fixtures
 */
export interface EmailFixtureFilter {
  /** Filter by provider */
  provider?: EmailProvider;
  /** Filter by category */
  category?: EmailCategory;
  /** Filter by transaction stage */
  stage?: TransactionStage;
  /** Filter by difficulty */
  difficulty?: DifficultyLevel;
  /** Filter by thread ID */
  threadId?: string;
  /** Filter by expected transaction status */
  isTransaction?: boolean;
  /** Filter by expected spam status */
  isSpam?: boolean;
  /** Filter by expected transaction type */
  transactionType?: TransactionType;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Statistics about the loaded fixtures
 */
export interface EmailFixtureStats {
  /** Total emails loaded */
  total: number;
  /** Emails by category */
  byCategory: Record<EmailCategory, number>;
  /** Emails by provider */
  byProvider: Record<EmailProvider, number>;
  /** Emails by stage */
  byStage: Record<TransactionStage | 'none', number>;
  /** Emails by difficulty */
  byDifficulty: Record<DifficultyLevel, number>;
  /** Number of unique threads */
  uniqueThreads: number;
}
