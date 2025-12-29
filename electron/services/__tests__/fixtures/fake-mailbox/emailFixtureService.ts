/**
 * Email Fixture Service
 * Utilities for loading, filtering, and working with fake email fixtures
 */

import emailData from './emails.json';
import type {
  FakeEmail,
  EmailFixtureData,
  EmailFixtureFilter,
  EmailFixtureStats,
  EmailCategory,
  EmailProvider,
  DifficultyLevel,
} from './types';
import type { TransactionStage } from '../../../../types/models';

// Type assertion for the imported JSON
const fixtureData = emailData as EmailFixtureData;

/**
 * Get all emails from the fixture
 */
export function getAllEmails(): FakeEmail[] {
  return fixtureData.emails;
}

/**
 * Get fixture metadata
 */
export function getMetadata(): EmailFixtureData['metadata'] {
  return fixtureData.metadata;
}

/**
 * Filter emails based on criteria
 */
export function filterEmails(filter: EmailFixtureFilter): FakeEmail[] {
  let result = [...fixtureData.emails];

  if (filter.provider) {
    result = result.filter((e) => e.provider === filter.provider);
  }

  if (filter.category) {
    result = result.filter((e) => e.category === filter.category);
  }

  if (filter.stage) {
    result = result.filter((e) => e.stage === filter.stage);
  }

  if (filter.difficulty) {
    result = result.filter((e) => e.difficulty === filter.difficulty);
  }

  if (filter.threadId) {
    result = result.filter((e) => e.thread_id === filter.threadId);
  }

  if (filter.isTransaction !== undefined) {
    result = result.filter((e) => e.expected.isTransaction === filter.isTransaction);
  }

  if (filter.isSpam !== undefined) {
    result = result.filter((e) => e.expected.shouldBeSpam === filter.isSpam);
  }

  if (filter.transactionType) {
    result = result.filter((e) => e.expected.transactionType === filter.transactionType);
  }

  if (filter.limit && filter.limit > 0) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

/**
 * Get emails by category
 */
export function getEmailsByCategory(category: EmailCategory): FakeEmail[] {
  return filterEmails({ category });
}

/**
 * Get emails by provider
 */
export function getEmailsByProvider(provider: EmailProvider): FakeEmail[] {
  return filterEmails({ provider });
}

/**
 * Get emails by transaction stage
 */
export function getEmailsByStage(stage: TransactionStage): FakeEmail[] {
  return filterEmails({ stage });
}

/**
 * Get emails by difficulty
 */
export function getEmailsByDifficulty(difficulty: DifficultyLevel): FakeEmail[] {
  return filterEmails({ difficulty });
}

/**
 * Get all emails in a specific thread
 */
export function getEmailThread(threadId: string): FakeEmail[] {
  return filterEmails({ threadId });
}

/**
 * Get transaction-related emails only
 */
export function getTransactionEmails(): FakeEmail[] {
  return filterEmails({ isTransaction: true });
}

/**
 * Get spam emails only
 */
export function getSpamEmails(): FakeEmail[] {
  return filterEmails({ isSpam: true });
}

/**
 * Get non-transaction, non-spam emails
 */
export function getNormalEmails(): FakeEmail[] {
  return fixtureData.emails.filter(
    (e) => !e.expected.isTransaction && !e.expected.shouldBeSpam
  );
}

/**
 * Get a random sample of emails
 */
export function getRandomSample(count: number): FakeEmail[] {
  const shuffled = [...fixtureData.emails].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get an email by ID
 */
export function getEmailById(id: string): FakeEmail | undefined {
  return fixtureData.emails.find((e) => e.id === id);
}

/**
 * Get fixture statistics
 */
export function getStats(): EmailFixtureStats {
  const emails = fixtureData.emails;

  const byCategory: Record<EmailCategory, number> = {
    transaction: 0,
    spam: 0,
    normal: 0,
    edge_case: 0,
  };

  const byProvider: Record<EmailProvider, number> = {
    gmail: 0,
    outlook: 0,
  };

  const byStage: Record<TransactionStage | 'none', number> = {
    intro: 0,
    showing: 0,
    offer: 0,
    inspections: 0,
    escrow: 0,
    closing: 0,
    post_closing: 0,
    none: 0,
  };

  const byDifficulty: Record<DifficultyLevel, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  const threadIds = new Set<string>();

  for (const email of emails) {
    byCategory[email.category]++;
    byProvider[email.provider]++;
    byDifficulty[email.difficulty]++;
    threadIds.add(email.thread_id);

    if (email.stage) {
      byStage[email.stage]++;
    } else {
      byStage.none++;
    }
  }

  return {
    total: emails.length,
    byCategory,
    byProvider,
    byStage,
    byDifficulty,
    uniqueThreads: threadIds.size,
  };
}

/**
 * Convert a FakeEmail to a format compatible with ParsedEmail interface
 */
export function toCompatibleFormat(email: FakeEmail): Record<string, unknown> {
  return {
    id: email.id,
    threadId: email.thread_id,
    subject: email.subject,
    body: email.body,
    bodyHtml: email.bodyHtml,
    snippet: email.snippet,
    from: email.sender,
    to: email.recipients.join(', '),
    cc: email.cc?.join(', '),
    labels: email.labels,
    date: email.sent_at,
    hasAttachments: email.hasAttachments,
    attachmentCount: email.attachmentCount,
  };
}
