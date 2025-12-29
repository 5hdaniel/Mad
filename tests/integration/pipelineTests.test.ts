/**
 * Integration Pipeline Tests
 *
 * End-to-end tests for the email sync -> classification -> transaction extraction pipeline.
 * Uses the TestSandbox with fake email fixtures for deterministic, offline testing.
 */

import { TestSandbox, createTestSandbox } from './testSandbox';
import { MockGmailProvider, MockOutlookProvider } from './mockProviders';
import { TEST_USER_ID } from './setup';
import { getAllEmails, getStats } from '../../electron/services/__tests__/fixtures/fake-mailbox/emailFixtureService';

describe('Integration: Email Sync Pipeline', () => {
  let sandbox: TestSandbox;

  beforeAll(async () => {
    sandbox = await createTestSandbox({ fixtures: 'email' });
  });

  afterAll(async () => {
    await sandbox.teardown();
  });

  describe('Fixture Loading', () => {
    it('should load email fixtures successfully', () => {
      const stats = sandbox.getStats();
      expect(stats.emailCount).toBeGreaterThan(0);
    });

    it('should have emails from both providers', () => {
      const stats = sandbox.getStats();
      expect(stats.emailsByProvider.gmail).toBeGreaterThan(0);
      expect(stats.emailsByProvider.outlook).toBeGreaterThan(0);
    });

    it('should have emails in all categories', () => {
      const stats = sandbox.getStats();
      expect(stats.emailsByCategory.transaction).toBeGreaterThan(0);
      expect(stats.emailsByCategory.spam).toBeGreaterThan(0);
      expect(stats.emailsByCategory.normal).toBeGreaterThan(0);
    });
  });

  describe('Email Sync', () => {
    it('should sync Gmail emails', async () => {
      const result = await sandbox.syncEmails('gmail');
      expect(result.success).toBe(true);
      expect(result.itemCount).toBeGreaterThan(0);
      expect(result.errorCount).toBe(0);
    });

    it('should sync Outlook emails', async () => {
      const result = await sandbox.syncEmails('outlook');
      expect(result.success).toBe(true);
      expect(result.itemCount).toBeGreaterThan(0);
      expect(result.errorCount).toBe(0);
    });

    it('should accumulate synced emails from multiple providers', async () => {
      const syncedEmails = sandbox.getSyncedEmails();
      const gmailCount = sandbox.getProviders().gmail.getEmailCount();
      const outlookCount = sandbox.getProviders().outlook.getEmailCount();

      expect(syncedEmails.length).toBe(gmailCount + outlookCount);
    });
  });
});

describe('Integration: Email Classification', () => {
  let sandbox: TestSandbox;

  beforeAll(async () => {
    sandbox = await createTestSandbox({ fixtures: 'email' });
    // Sync all emails before classification tests
    await sandbox.syncAllEmails();
  });

  afterAll(async () => {
    await sandbox.teardown();
  });

  describe('Classification Execution', () => {
    it('should classify all synced emails', async () => {
      const results = await sandbox.runClassification();
      const syncedCount = sandbox.getSyncedEmails().length;

      expect(results.length).toBe(syncedCount);
    });

    it('should detect transaction-related emails', async () => {
      const results = await sandbox.runClassification();
      const transactionEmails = results.filter((r) => r.isTransactionRelated);

      expect(transactionEmails.length).toBeGreaterThan(0);
    });

    it('should detect spam emails', async () => {
      const results = await sandbox.runClassification();
      const spamEmails = results.filter((r) => r.isSpam);

      expect(spamEmails.length).toBeGreaterThan(0);
    });

    it('should assign confidence scores to all classifications', async () => {
      const results = await sandbox.runClassification();

      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Classification Accuracy', () => {
    it('should correctly classify obvious transaction emails', async () => {
      await sandbox.runClassification();
      const comparisons = sandbox.compareClassifications();

      // Check emails with "easy" difficulty that are transactions
      const easyTransactions = sandbox
        .getTransactionEmails()
        .filter((e) => e.difficulty === 'easy');

      for (const email of easyTransactions) {
        const comparison = comparisons.find((c) => c.messageId === email.id);
        if (comparison) {
          expect(comparison.actual.isTransactionRelated).toBe(true);
        }
      }
    });

    it('should correctly classify obvious spam emails', async () => {
      await sandbox.runClassification();
      const comparisons = sandbox.compareClassifications();

      const spamEmails = sandbox.getSpamEmails().filter((e) => e.difficulty === 'easy');

      for (const email of spamEmails) {
        const comparison = comparisons.find((c) => c.messageId === email.id);
        if (comparison) {
          expect(comparison.actual.isSpam).toBe(true);
        }
      }
    });

    it('should extract transaction type when applicable', async () => {
      await sandbox.runClassification();
      const results = sandbox.getClassificationResults();

      const transactionEmails = sandbox.getTransactionEmails();
      for (const email of transactionEmails) {
        const result = results.get(email.id);
        if (result && result.isTransactionRelated) {
          // Should have a transaction type for most transaction emails
          // (some edge cases may not have enough context)
          if (email.difficulty === 'easy') {
            expect(result.transactionType).not.toBeNull();
          }
        }
      }
    });
  });
});

describe('Integration: Transaction Detection', () => {
  let sandbox: TestSandbox;

  beforeAll(async () => {
    sandbox = await createTestSandbox({ fixtures: 'email' });
    await sandbox.syncAllEmails();
  });

  afterAll(async () => {
    await sandbox.teardown();
  });

  describe('Detection Pipeline', () => {
    it('should run detection and find transactions', async () => {
      const result = await sandbox.runDetection();

      expect(result.success).toBe(true);
      expect(result.transactionsDetected).toBeGreaterThan(0);
    });

    it('should extract property addresses from transactions', async () => {
      const result = await sandbox.runDetection();

      for (const transaction of result.transactions) {
        expect(transaction.propertyAddress).toBeDefined();
        expect(transaction.propertyAddress).not.toBe('');
      }
    });

    it('should group related emails into transactions', async () => {
      const result = await sandbox.runDetection();

      // Transactions should have at least one related message
      for (const transaction of result.transactions) {
        expect(transaction.messageCount).toBeGreaterThan(0);
        expect(transaction.messageIds.length).toBe(transaction.messageCount);
      }
    });

    it('should assign stages to detected transactions', async () => {
      const result = await sandbox.runDetection();

      // Most detected transactions should have a stage
      const withStage = result.transactions.filter((t) => t.stage !== null);
      expect(withStage.length).toBeGreaterThan(0);
    });

    it('should calculate confidence scores for transactions', async () => {
      const result = await sandbox.runDetection();

      for (const transaction of result.transactions) {
        expect(transaction.confidence).toBeGreaterThanOrEqual(0);
        expect(transaction.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Detection Performance', () => {
    it('should complete detection in under 5 seconds', async () => {
      const result = await sandbox.runDetection();

      expect(result.durationMs).toBeLessThan(5000);
    });
  });
});

describe('Integration: Provider Error Handling', () => {
  describe('Gmail Provider Errors', () => {
    it('should handle simulated errors gracefully', async () => {
      const gmailProvider = new MockGmailProvider({
        simulateErrors: true,
        errorRate: 1.0, // Always error
      });

      gmailProvider.loadEmails(getAllEmails());

      await expect(gmailProvider.fetchEmails()).rejects.toThrow();
    });

    it('should report sync failure on error', async () => {
      const gmailProvider = new MockGmailProvider({
        simulateErrors: true,
        errorRate: 1.0,
      });

      gmailProvider.loadEmails(getAllEmails());

      const result = await gmailProvider.syncAll();
      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.error).toBeDefined();
    });
  });

  describe('Outlook Provider Errors', () => {
    it('should handle simulated errors gracefully', async () => {
      const outlookProvider = new MockOutlookProvider({
        simulateErrors: true,
        errorRate: 1.0,
      });

      outlookProvider.loadEmails(getAllEmails());

      await expect(outlookProvider.fetchEmails()).rejects.toThrow();
    });
  });
});

describe('Integration: Sandbox Lifecycle', () => {
  it('should prevent operations before setup', async () => {
    const sandbox = new TestSandbox();

    // Should throw because setup() wasn't called
    await expect(sandbox.syncEmails('gmail')).rejects.toThrow(
      'TestSandbox not initialized'
    );
  });

  it('should allow reset via teardown and setup', async () => {
    const sandbox = await createTestSandbox({ fixtures: 'email' });

    // Sync some emails
    await sandbox.syncAllEmails();
    const firstSyncCount = sandbox.getSyncedEmails().length;
    expect(firstSyncCount).toBeGreaterThan(0);

    // Teardown and setup again
    await sandbox.teardown();
    await sandbox.setup();

    // Should start fresh
    const postResetCount = sandbox.getSyncedEmails().length;
    expect(postResetCount).toBe(0);
  });

  it('should warn on double setup', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const sandbox = await createTestSandbox({ fixtures: 'email' });

    // Call setup again
    await sandbox.setup();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('already set up')
    );

    consoleSpy.mockRestore();
    await sandbox.teardown();
  });
});

describe('Integration: Full Pipeline E2E', () => {
  it('should complete the full sync -> classify -> detect pipeline', async () => {
    const sandbox = await createTestSandbox({ fixtures: 'email' });

    try {
      // Step 1: Sync all emails
      const syncResult = await sandbox.syncAllEmails();
      expect(syncResult.success).toBe(true);
      expect(syncResult.itemCount).toBeGreaterThan(0);

      // Step 2: Run classification
      const classifications = await sandbox.runClassification();
      expect(classifications.length).toBe(syncResult.itemCount);

      // Step 3: Run detection
      const detectionResult = await sandbox.runDetection();
      expect(detectionResult.success).toBe(true);
      expect(detectionResult.transactionsDetected).toBeGreaterThan(0);

      // Step 4: Validate results
      const comparisons = sandbox.compareClassifications();
      const correctCount = comparisons.filter((c) => c.isCorrect).length;
      const totalCount = comparisons.length;
      const accuracy = (correctCount / totalCount) * 100;

      // Expect at least 60% accuracy on easy cases
      const easyComparisons = comparisons.filter((c) => {
        const email = getAllEmails().find((e) => e.id === c.messageId);
        return email?.difficulty === 'easy';
      });
      const easyCorrect = easyComparisons.filter((c) => c.isCorrect).length;
      const easyAccuracy = (easyCorrect / easyComparisons.length) * 100;

      expect(easyAccuracy).toBeGreaterThanOrEqual(60);
    } finally {
      await sandbox.teardown();
    }
  });
});

describe('Integration: Fixture Statistics', () => {
  it('should match metadata statistics', () => {
    const stats = getStats();
    const allEmails = getAllEmails();

    expect(stats.total).toBe(allEmails.length);
    expect(stats.byCategory.transaction + stats.byCategory.spam + stats.byCategory.normal + stats.byCategory.edge_case).toBe(stats.total);
    expect(stats.byProvider.gmail + stats.byProvider.outlook).toBe(stats.total);
  });

  it('should have deterministic fixture data', () => {
    const emails1 = getAllEmails();
    const emails2 = getAllEmails();

    expect(emails1.length).toBe(emails2.length);
    for (let i = 0; i < emails1.length; i++) {
      expect(emails1[i].id).toBe(emails2[i].id);
      expect(emails1[i].subject).toBe(emails2[i].subject);
    }
  });
});
