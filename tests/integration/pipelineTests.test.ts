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

    it('should extract transaction type for most transaction emails', async () => {
      await sandbox.runClassification();
      const results = sandbox.getClassificationResults();

      const transactionEmails = sandbox.getTransactionEmails();
      let withType = 0;
      let total = 0;

      for (const email of transactionEmails) {
        const result = results.get(email.id);
        if (result && result.isTransactionRelated) {
          total++;
          if (result.transactionType !== null) {
            withType++;
          }
        }
      }

      // At least 50% of detected transaction emails should have a type
      // (pattern-based classification is simpler than AI detection)
      if (total > 0) {
        const percentage = (withType / total) * 100;
        expect(percentage).toBeGreaterThanOrEqual(50);
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

      // Expect at least 40% accuracy on easy cases
      // Note: Pattern-based classification is simpler than AI detection
      // The goal is to demonstrate the framework works, not achieve high accuracy
      const easyComparisons = comparisons.filter((c) => {
        const email = getAllEmails().find((e) => e.id === c.messageId);
        return email?.difficulty === 'easy';
      });
      const easyCorrect = easyComparisons.filter((c) => c.isCorrect).length;
      const easyAccuracy = (easyCorrect / easyComparisons.length) * 100;

      // Framework test: verify pipeline works and produces reasonable results
      expect(easyAccuracy).toBeGreaterThanOrEqual(40);
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

// ============================================================================
// iOS Backup / SMS / iMessage Integration Tests (TASK-801 Fixtures)
// ============================================================================

describe('Integration: iOS Backup Sync Pipeline', () => {
  let sandbox: TestSandbox;

  beforeAll(async () => {
    sandbox = await createTestSandbox({ fixtures: 'sms' });
  });

  afterAll(async () => {
    await sandbox.teardown();
  });

  describe('Fixture Loading', () => {
    it('should load iOS backup fixtures successfully', () => {
      const stats = sandbox.getStats();
      expect(stats.smsCount).toBeGreaterThan(0);
    });

    it('should load contacts from iOS backup', () => {
      const stats = sandbox.getStats();
      expect(stats.contactCount).toBeGreaterThan(0);
    });

    it('should have messages in multiple categories', () => {
      const transactionMessages = sandbox.getTransactionMessages();
      const allMessages = sandbox.getMessages();

      expect(transactionMessages.length).toBeGreaterThan(0);
      expect(allMessages.length).toBeGreaterThan(transactionMessages.length);
    });
  });

  describe('Message Sync', () => {
    it('should sync iOS messages', async () => {
      const result = await sandbox.syncMessages();
      expect(result.success).toBe(true);
      expect(result.itemCount).toBeGreaterThan(0);
      expect(result.errorCount).toBe(0);
    });

    it('should have synced messages available', async () => {
      const syncedMessages = sandbox.getSyncedMessages();
      expect(syncedMessages.length).toBeGreaterThan(0);
    });

    it('should include iMessage and SMS service types', () => {
      const syncedMessages = sandbox.getSyncedMessages();
      const services = new Set(syncedMessages.map((m) => m.service));

      expect(services.has('iMessage')).toBe(true);
      expect(services.has('SMS')).toBe(true);
    });
  });
});

describe('Integration: iOS Message Classification', () => {
  let sandbox: TestSandbox;

  beforeAll(async () => {
    sandbox = await createTestSandbox({ fixtures: 'sms' });
    await sandbox.syncMessages();
  });

  afterAll(async () => {
    await sandbox.teardown();
  });

  describe('Classification Execution', () => {
    it('should classify all synced messages', async () => {
      const results = await sandbox.runMessageClassification();
      const syncedCount = sandbox.getSyncedMessages().length;

      expect(results.length).toBe(syncedCount);
    });

    it('should detect transaction-related messages', async () => {
      const results = await sandbox.runMessageClassification();
      const transactionMessages = results.filter((r) => r.isTransactionRelated);

      expect(transactionMessages.length).toBeGreaterThan(0);
    });

    it('should assign confidence scores to all classifications', async () => {
      const results = await sandbox.runMessageClassification();

      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('Integration: Combined Email and SMS Pipeline', () => {
  let sandbox: TestSandbox;

  beforeAll(async () => {
    sandbox = await createTestSandbox({ fixtures: 'both' });
  });

  afterAll(async () => {
    await sandbox.teardown();
  });

  describe('Combined Fixture Loading', () => {
    it('should load both email and SMS fixtures', () => {
      const stats = sandbox.getStats();
      expect(stats.emailCount).toBeGreaterThan(0);
      expect(stats.smsCount).toBeGreaterThan(0);
      expect(stats.contactCount).toBeGreaterThan(0);
    });
  });

  describe('Combined Sync', () => {
    it('should sync all emails and messages', async () => {
      const result = await sandbox.syncAll();

      expect(result.success).toBe(true);
      expect(result.itemCount).toBeGreaterThan(0);
      expect(result.errorCount).toBe(0);
    });

    it('should have both emails and messages synced', async () => {
      const emails = sandbox.getSyncedEmails();
      const messages = sandbox.getSyncedMessages();

      expect(emails.length).toBeGreaterThan(0);
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Combined Classification', () => {
    it('should classify both emails and messages', async () => {
      // Already synced in previous test
      const emailResults = await sandbox.runClassification();
      const messageResults = await sandbox.runMessageClassification();

      expect(emailResults.length).toBeGreaterThan(0);
      expect(messageResults.length).toBeGreaterThan(0);

      // Both should detect some transaction-related content
      const transactionEmails = emailResults.filter((r) => r.isTransactionRelated);
      const transactionMessages = messageResults.filter((r) => r.isTransactionRelated);

      expect(transactionEmails.length).toBeGreaterThan(0);
      expect(transactionMessages.length).toBeGreaterThan(0);
    });
  });
});

describe('Integration: iOS Provider Error Handling', () => {
  it('should handle simulated iOS backup errors gracefully', async () => {
    const sandbox = new TestSandbox({ fixtures: 'sms' });
    await sandbox.setup();

    const iosProvider = sandbox.getProviders().ios;

    // Create a new provider with error simulation
    const { MockiOSBackupProvider } = await import('./mockProviders');
    const errorProvider = new MockiOSBackupProvider({
      simulateErrors: true,
      errorRate: 1.0, // Always error
    });

    // Load fixtures into error provider
    const messages = sandbox.getMessages();
    errorProvider.loadMessages(messages);

    await expect(errorProvider.fetchMessages()).rejects.toThrow();

    await sandbox.teardown();
  });

  it('should report sync failure on iOS error', async () => {
    const { MockiOSBackupProvider } = await import('./mockProviders');
    const iosProvider = new MockiOSBackupProvider({
      simulateErrors: true,
      errorRate: 1.0,
    });

    const result = await iosProvider.syncAll();
    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.error).toBeDefined();
  });
});

describe('Integration: iOS Fixture Statistics', () => {
  it('should have deterministic iOS fixture data', () => {
    const { getAllMessages, getAllContacts } = require('../../electron/services/__tests__/fixtures/fake-ios-backup/iosBackupFixtureService');

    const messages1 = getAllMessages();
    const messages2 = getAllMessages();
    const contacts1 = getAllContacts();
    const contacts2 = getAllContacts();

    expect(messages1.length).toBe(messages2.length);
    expect(contacts1.length).toBe(contacts2.length);

    for (let i = 0; i < messages1.length; i++) {
      expect(messages1[i].id).toBe(messages2[i].id);
      expect(messages1[i].text).toBe(messages2[i].text);
    }
  });

  it('should have correct iOS fixture statistics', () => {
    const { getMessageStats, getContactStats } = require('../../electron/services/__tests__/fixtures/fake-ios-backup/iosBackupFixtureService');

    const messageStats = getMessageStats();
    const contactStats = getContactStats();

    expect(messageStats.total).toBeGreaterThan(0);
    expect(messageStats.byCategory.transaction).toBeGreaterThan(0);
    expect(contactStats.total).toBeGreaterThan(0);
  });
});
