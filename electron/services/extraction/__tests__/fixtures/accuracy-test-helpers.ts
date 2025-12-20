/**
 * Accuracy Test Helpers
 * TASK-510: Helper functions for extraction accuracy testing
 */

import testEmails from './accuracy-test-emails.json';
import { isGmailSpam, isOutlookJunk } from '../../../llm/spamFilterService';
import { MessageInput } from '../../types';
import { BatchAnalysisResult } from '../../../llm/batchLLMService';

// ============================================================================
// Types
// ============================================================================

/**
 * Test email with expected results for validation
 */
export interface TestEmail {
  id: string;
  thread_id: string;
  subject: string;
  body: string;
  sender: string;
  recipients: string[];
  labels: string[];
  sent_at: string;
  label: 'transaction' | 'spam' | 'normal' | 'edge_case';
  stage?: 'prospecting' | 'negotiation' | 'under_contract' | 'due_diligence' | 'closing' | 'closed';
  difficulty?: 'easy' | 'medium' | 'hard';
  expected: {
    isTransaction: boolean;
    transactionType: 'purchase' | 'sale' | 'lease' | null;
    shouldBeSpam: boolean;
    containsTransactionIndicators: boolean;
  };
}

/**
 * Test dataset structure
 */
interface TestDataset {
  metadata: {
    description: string;
    version?: string;
    totalEmails: number;
    transactionEmails: number;
    spamEmails: number;
    normalEmails: number;
    edgeCaseEmails?: number;
    threads: number;
    notes?: string;
  };
  emails: TestEmail[];
}

// ============================================================================
// Dataset Loading
// ============================================================================

/**
 * Load the test email dataset
 */
export function loadTestEmailDataset(): TestEmail[] {
  return (testEmails as TestDataset).emails;
}

/**
 * Get dataset metadata
 */
export function getDatasetMetadata(): TestDataset['metadata'] {
  return (testEmails as TestDataset).metadata;
}

// ============================================================================
// Spam Detection Helpers
// ============================================================================

/**
 * Check if an email would be detected as spam
 */
export function isSpam(email: TestEmail): boolean {
  // Check Gmail spam labels
  if (email.labels && email.labels.length > 0) {
    const result = isGmailSpam(email.labels);
    if (result.isSpam) return true;
  }
  return false;
}

/**
 * Get emails that should be filtered as spam
 */
export function getSpamEmails(emails: TestEmail[]): TestEmail[] {
  return emails.filter((e) => e.expected.shouldBeSpam);
}

/**
 * Get emails that are real estate transactions
 */
export function getTransactionEmails(emails: TestEmail[]): TestEmail[] {
  return emails.filter((e) => e.expected.isTransaction);
}

/**
 * Get normal (non-transaction, non-spam) emails
 */
export function getNormalEmails(emails: TestEmail[]): TestEmail[] {
  return emails.filter((e) => e.label === 'normal');
}

/**
 * Get edge case emails (tricky to classify)
 */
export function getEdgeCaseEmails(emails: TestEmail[]): TestEmail[] {
  return emails.filter((e) => e.label === 'edge_case');
}

/**
 * Get emails by difficulty level
 */
export function getEmailsByDifficulty(
  emails: TestEmail[],
  difficulty: 'easy' | 'medium' | 'hard'
): TestEmail[] {
  return emails.filter((e) => e.difficulty === difficulty);
}

/**
 * Get emails by transaction stage
 */
export function getEmailsByStage(
  emails: TestEmail[],
  stage: 'prospecting' | 'negotiation' | 'under_contract' | 'due_diligence' | 'closing' | 'closed'
): TestEmail[] {
  return emails.filter((e) => e.stage === stage);
}

// ============================================================================
// Conversion Helpers
// ============================================================================

/**
 * Convert TestEmail to MessageInput for pipeline processing
 */
export function toMessageInput(email: TestEmail): MessageInput {
  return {
    id: email.id,
    subject: email.subject,
    body: email.body,
    sender: email.sender,
    recipients: email.recipients,
    date: email.sent_at,
    labels: email.labels,
    thread_id: email.thread_id,
  };
}

/**
 * Convert array of TestEmails to MessageInputs
 */
export function toMessageInputs(emails: TestEmail[]): MessageInput[] {
  return emails.map(toMessageInput);
}

// ============================================================================
// Accuracy Calculation
// ============================================================================

/**
 * Calculate match rate between expected and actual results
 */
export function calculateMatchRate(
  expected: TestEmail[],
  actual: BatchAnalysisResult[]
): number {
  if (expected.length === 0) return 1;

  const actualMap = new Map(actual.map((r) => [r.emailId, r]));
  let matches = 0;

  for (const email of expected) {
    const result = actualMap.get(email.id);
    if (result && result.isRealEstateRelated === email.expected.isTransaction) {
      matches++;
    }
  }

  return matches / expected.length;
}

/**
 * Calculate false positive rate (non-transactions marked as transactions)
 */
export function calculateFalsePositiveRate(
  emails: TestEmail[],
  results: BatchAnalysisResult[]
): number {
  const nonTransactionEmails = emails.filter((e) => !e.expected.isTransaction);
  if (nonTransactionEmails.length === 0) return 0;

  const resultsMap = new Map(results.map((r) => [r.emailId, r]));
  let falsePositives = 0;

  for (const email of nonTransactionEmails) {
    const result = resultsMap.get(email.id);
    if (result?.isRealEstateRelated) {
      falsePositives++;
    }
  }

  return falsePositives / nonTransactionEmails.length;
}

/**
 * Calculate false negative rate (transactions marked as non-transactions)
 */
export function calculateFalseNegativeRate(
  emails: TestEmail[],
  results: BatchAnalysisResult[]
): number {
  const transactionEmails = emails.filter((e) => e.expected.isTransaction);
  if (transactionEmails.length === 0) return 0;

  const resultsMap = new Map(results.map((r) => [r.emailId, r]));
  let falseNegatives = 0;

  for (const email of transactionEmails) {
    const result = resultsMap.get(email.id);
    if (!result?.isRealEstateRelated) {
      falseNegatives++;
    }
  }

  return falseNegatives / transactionEmails.length;
}

/**
 * Group emails by thread and find first email in each thread
 */
export function groupByThread(emails: TestEmail[]): Map<string, TestEmail[]> {
  const threads = new Map<string, TestEmail[]>();

  for (const email of emails) {
    if (!threads.has(email.thread_id)) {
      threads.set(email.thread_id, []);
    }
    threads.get(email.thread_id)!.push(email);
  }

  // Sort emails in each thread by date
  for (const [, threadEmails] of threads) {
    threadEmails.sort(
      (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    );
  }

  return threads;
}

/**
 * Get first email from each thread
 */
export function getFirstEmailsInThreads(emails: TestEmail[]): TestEmail[] {
  const threads = groupByThread(emails);
  const firstEmails: TestEmail[] = [];

  for (const [, threadEmails] of threads) {
    firstEmails.push(threadEmails[0]);
  }

  return firstEmails;
}
