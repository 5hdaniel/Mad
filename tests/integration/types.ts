/**
 * Integration Test Types
 *
 * Type definitions for the integration testing framework.
 */

import type {
  TransactionType,
  TransactionStage,
  TransactionStatus,
  MessageChannel,
} from '../../electron/types/models';
import type { FakeEmail } from '../../electron/services/__tests__/fixtures/fake-mailbox/types';

/**
 * Options for initializing a TestSandbox
 */
export interface TestSandboxOptions {
  /** Which fixture sets to load */
  fixtures?: 'email' | 'sms' | 'both';
  /** Fixed timestamp for deterministic tests (defaults to setup.ts FIXED_DATE) */
  fixedDate?: Date;
  /** User ID for the test session */
  userId?: string;
}

/**
 * Result of a sync operation (email or SMS)
 */
export interface SyncResult {
  /** Whether the sync completed successfully */
  success: boolean;
  /** Number of items synced */
  itemCount: number;
  /** Number of items that failed to sync */
  errorCount: number;
  /** Error message if sync failed */
  error?: string;
  /** Duration of sync operation in milliseconds */
  durationMs: number;
}

/**
 * Result of a transaction detection/extraction operation
 */
export interface DetectionResult {
  /** Whether detection completed successfully */
  success: boolean;
  /** Number of transactions detected */
  transactionsDetected: number;
  /** Details of detected transactions */
  transactions: DetectedTransaction[];
  /** Duration of detection operation in milliseconds */
  durationMs: number;
  /** Error message if detection failed */
  error?: string;
}

/**
 * A detected transaction from the pipeline
 */
export interface DetectedTransaction {
  /** Property address extracted */
  propertyAddress: string;
  /** Transaction type */
  transactionType: TransactionType | null;
  /** Transaction stage */
  stage: TransactionStage | null;
  /** Confidence score (0-1) */
  confidence: number;
  /** Number of related messages */
  messageCount: number;
  /** IDs of messages linked to this transaction */
  messageIds: string[];
}

/**
 * Statistics about the sandbox state
 */
export interface SandboxStats {
  /** Total emails loaded */
  emailCount: number;
  /** Total SMS messages loaded */
  smsCount: number;
  /** Total contacts loaded */
  contactCount: number;
  /** Total transactions detected */
  transactionCount: number;
  /** Emails by category */
  emailsByCategory: Record<string, number>;
  /** Emails by provider */
  emailsByProvider: Record<string, number>;
}

/**
 * Mock email provider configuration
 */
export interface MockEmailProviderConfig {
  /** Provider type */
  type: 'gmail' | 'outlook';
  /** Simulated latency in milliseconds */
  latencyMs?: number;
  /** Whether to simulate errors */
  simulateErrors?: boolean;
  /** Error rate (0-1) if simulating errors */
  errorRate?: number;
}

/**
 * Mock SMS/iMessage provider configuration
 */
export interface MockMessageProviderConfig {
  /** Provider type */
  type: 'imessage' | 'sms';
  /** Simulated latency in milliseconds */
  latencyMs?: number;
  /** Whether to simulate errors */
  simulateErrors?: boolean;
  /** Error rate (0-1) if simulating errors */
  errorRate?: number;
}

/**
 * Email transformed for pipeline processing
 * Compatible with the format expected by sync services
 */
export interface ProcessableEmail {
  /** External ID from provider */
  externalId: string;
  /** Thread ID for grouping */
  threadId: string;
  /** Email subject */
  subject: string;
  /** Plain text body */
  bodyText: string;
  /** HTML body */
  bodyHtml?: string;
  /** Sender address */
  from: string;
  /** Recipient addresses */
  to: string[];
  /** CC addresses */
  cc?: string[];
  /** BCC addresses */
  bcc?: string[];
  /** Email labels/folders */
  labels: string[];
  /** Sent timestamp */
  sentAt: Date;
  /** Whether email has attachments */
  hasAttachments: boolean;
  /** Number of attachments */
  attachmentCount: number;
  /** Channel type */
  channel: MessageChannel;
}

/**
 * SMS/iMessage transformed for pipeline processing
 * Compatible with the format expected by sync services
 */
export interface ProcessableMessage {
  /** Message ID from iOS backup */
  messageId: number;
  /** Chat ID for grouping conversations */
  chatId: number;
  /** Message text content */
  text: string;
  /** Whether the message was sent by device owner */
  isFromMe: boolean;
  /** Sender identifier (phone or email) */
  senderIdentifier: string;
  /** Sender display name (if known from contacts) */
  senderName?: string;
  /** Message timestamp */
  sentAt: Date;
  /** Service type */
  service: 'iMessage' | 'SMS';
  /** Whether message has attachments */
  hasAttachments: boolean;
  /** Channel type */
  channel: MessageChannel;
}

/**
 * Classification result for a message
 */
export interface ClassificationResult {
  /** Message ID */
  messageId: string;
  /** Whether the message is transaction-related */
  isTransactionRelated: boolean;
  /** Whether the message should be classified as spam */
  isSpam: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Extracted transaction type (if any) */
  transactionType: TransactionType | null;
  /** Extracted transaction stage (if any) */
  stage: TransactionStage | null;
}

/**
 * Expected vs actual classification comparison
 */
export interface ClassificationComparison {
  /** Message ID */
  messageId: string;
  /** Expected classification from fixture */
  expected: {
    isTransaction: boolean;
    transactionType: TransactionType | null;
    shouldBeSpam: boolean;
  };
  /** Actual classification from pipeline */
  actual: ClassificationResult;
  /** Whether expected matches actual */
  isCorrect: boolean;
  /** Specific mismatches */
  mismatches: string[];
}
