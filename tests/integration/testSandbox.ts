/**
 * Test Sandbox
 *
 * Main orchestrator for integration tests. Provides a controlled environment
 * for testing email sync, AI detection, and transaction extraction pipelines
 * without external dependencies.
 */

import type { FakeEmail } from '../../electron/services/__tests__/fixtures/fake-mailbox/types';
import {
  getAllEmails,
  getTransactionEmails,
  getSpamEmails,
  getNormalEmails,
  filterEmails,
  getStats as getEmailStats,
} from '../../electron/services/__tests__/fixtures/fake-mailbox/emailFixtureService';
import {
  MockGmailProvider,
  MockOutlookProvider,
  MockiOSBackupProvider,
  fakeEmailToProcessable,
} from './mockProviders';
import type {
  TestSandboxOptions,
  SyncResult,
  DetectionResult,
  DetectedTransaction,
  SandboxStats,
  ClassificationResult,
  ClassificationComparison,
  ProcessableEmail,
} from './types';
import { TEST_USER_ID, TEST_FIXED_DATE } from './setup';

/**
 * Test Sandbox
 *
 * Orchestrates integration testing by:
 * 1. Loading fake email/SMS fixtures
 * 2. Providing mock providers that simulate real API behavior
 * 3. Running classification and detection pipelines
 * 4. Comparing results against expected values
 */
export class TestSandbox {
  private options: Required<TestSandboxOptions>;
  private gmailProvider: MockGmailProvider;
  private outlookProvider: MockOutlookProvider;
  private iosProvider: MockiOSBackupProvider;
  private loadedEmails: FakeEmail[] = [];
  private syncedEmails: ProcessableEmail[] = [];
  private classificationResults: Map<string, ClassificationResult> = new Map();
  private detectedTransactions: DetectedTransaction[] = [];
  private isSetup = false;

  constructor(options: TestSandboxOptions = {}) {
    this.options = {
      fixtures: options.fixtures ?? 'both',
      fixedDate: options.fixedDate ?? TEST_FIXED_DATE,
      userId: options.userId ?? TEST_USER_ID,
    };

    // Initialize mock providers
    this.gmailProvider = new MockGmailProvider();
    this.outlookProvider = new MockOutlookProvider();
    this.iosProvider = new MockiOSBackupProvider();
  }

  /**
   * Initialize the sandbox by loading fixtures and setting up providers
   */
  async setup(): Promise<void> {
    if (this.isSetup) {
      console.warn('TestSandbox already set up. Call teardown() first to reset.');
      return;
    }

    // Load email fixtures if configured
    if (this.options.fixtures === 'email' || this.options.fixtures === 'both') {
      this.loadedEmails = getAllEmails();
      this.gmailProvider.loadEmails(this.loadedEmails);
      this.outlookProvider.loadEmails(this.loadedEmails);
    }

    // Load SMS fixtures when available (TASK-801)
    if (this.options.fixtures === 'sms' || this.options.fixtures === 'both') {
      // TODO: Load SMS fixtures from TASK-801 when available
      // const smsFixtures = loadSMSFixtures();
      // this.iosProvider.loadMessages(smsFixtures.messages);
      // this.iosProvider.loadContacts(smsFixtures.contacts);
    }

    this.isSetup = true;
  }

  /**
   * Clean up sandbox state
   */
  async teardown(): Promise<void> {
    this.loadedEmails = [];
    this.syncedEmails = [];
    this.classificationResults.clear();
    this.detectedTransactions = [];
    this.isSetup = false;
  }

  /**
   * Sync emails from a specific provider
   */
  async syncEmails(provider: 'gmail' | 'outlook'): Promise<SyncResult> {
    this.ensureSetup();

    const startTime = Date.now();
    const mockProvider = provider === 'gmail' ? this.gmailProvider : this.outlookProvider;

    try {
      const { emails } = await mockProvider.fetchEmails();
      this.syncedEmails.push(...emails);

      return {
        success: true,
        itemCount: emails.length,
        errorCount: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        errorCount: 1,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Sync all emails from all providers
   */
  async syncAllEmails(): Promise<SyncResult> {
    this.ensureSetup();

    const startTime = Date.now();
    let totalItems = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    // Sync Gmail
    const gmailResult = await this.syncEmails('gmail');
    totalItems += gmailResult.itemCount;
    if (!gmailResult.success) {
      totalErrors++;
      if (gmailResult.error) errors.push(`Gmail: ${gmailResult.error}`);
    }

    // Sync Outlook
    const outlookResult = await this.syncEmails('outlook');
    totalItems += outlookResult.itemCount;
    if (!outlookResult.success) {
      totalErrors++;
      if (outlookResult.error) errors.push(`Outlook: ${outlookResult.error}`);
    }

    return {
      success: totalErrors === 0,
      itemCount: totalItems,
      errorCount: totalErrors,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Sync messages from iOS backup
   */
  async syncMessages(): Promise<SyncResult> {
    this.ensureSetup();

    const startTime = Date.now();

    try {
      const result = await this.iosProvider.syncAll();
      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        itemCount: 0,
        errorCount: 1,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Run classification on synced emails
   * Uses pattern-based classification for testing (simulates AI detection)
   */
  async runClassification(): Promise<ClassificationResult[]> {
    this.ensureSetup();

    const results: ClassificationResult[] = [];

    for (const email of this.syncedEmails) {
      const result = this.classifyEmail(email);
      this.classificationResults.set(email.externalId, result);
      results.push(result);
    }

    return results;
  }

  /**
   * Run transaction detection pipeline
   * Groups related messages and extracts transaction data
   */
  async runDetection(): Promise<DetectionResult> {
    this.ensureSetup();

    const startTime = Date.now();

    try {
      // First ensure classification has been run
      if (this.classificationResults.size === 0) {
        await this.runClassification();
      }

      // Group transaction-related emails by thread
      const transactionEmails = Array.from(this.classificationResults.entries())
        .filter(([, result]) => result.isTransactionRelated)
        .map(([id]) => {
          const email = this.syncedEmails.find((e) => e.externalId === id);
          return { id, email };
        })
        .filter((item) => item.email !== undefined);

      // Group by thread ID
      const threadGroups = new Map<string, typeof transactionEmails>();
      for (const item of transactionEmails) {
        if (!item.email) continue;
        const threadId = item.email.threadId;
        if (!threadGroups.has(threadId)) {
          threadGroups.set(threadId, []);
        }
        threadGroups.get(threadId)!.push(item);
      }

      // Extract transactions from thread groups
      this.detectedTransactions = [];
      for (const [threadId, emails] of threadGroups) {
        const transaction = this.extractTransactionFromThread(threadId, emails);
        if (transaction) {
          this.detectedTransactions.push(transaction);
        }
      }

      return {
        success: true,
        transactionsDetected: this.detectedTransactions.length,
        transactions: this.detectedTransactions,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        transactionsDetected: 0,
        transactions: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Compare classification results against expected values
   */
  compareClassifications(): ClassificationComparison[] {
    const comparisons: ClassificationComparison[] = [];

    for (const email of this.loadedEmails) {
      const actual = this.classificationResults.get(email.id);
      if (!actual) continue;

      const expected = {
        isTransaction: email.expected.isTransaction,
        transactionType: email.expected.transactionType,
        shouldBeSpam: email.expected.shouldBeSpam,
      };

      const mismatches: string[] = [];

      if (actual.isTransactionRelated !== expected.isTransaction) {
        mismatches.push(
          `isTransaction: expected ${expected.isTransaction}, got ${actual.isTransactionRelated}`
        );
      }

      if (actual.isSpam !== expected.shouldBeSpam) {
        mismatches.push(`isSpam: expected ${expected.shouldBeSpam}, got ${actual.isSpam}`);
      }

      if (expected.isTransaction && actual.transactionType !== expected.transactionType) {
        mismatches.push(
          `transactionType: expected ${expected.transactionType}, got ${actual.transactionType}`
        );
      }

      comparisons.push({
        messageId: email.id,
        expected,
        actual,
        isCorrect: mismatches.length === 0,
        mismatches,
      });
    }

    return comparisons;
  }

  /**
   * Get sandbox statistics
   */
  getStats(): SandboxStats {
    const emailStats = this.options.fixtures !== 'sms' ? getEmailStats() : null;

    return {
      emailCount: this.loadedEmails.length,
      smsCount: this.iosProvider.getMessageCount(),
      contactCount: this.iosProvider.getContactCount(),
      transactionCount: this.detectedTransactions.length,
      emailsByCategory: emailStats?.byCategory ?? {},
      emailsByProvider: emailStats?.byProvider ?? {},
    };
  }

  /**
   * Get emails filtered by criteria
   */
  getEmails(filter?: Parameters<typeof filterEmails>[0]): FakeEmail[] {
    return filter ? filterEmails(filter) : this.loadedEmails;
  }

  /**
   * Get transaction-related emails
   */
  getTransactionEmails(): FakeEmail[] {
    return getTransactionEmails();
  }

  /**
   * Get spam emails
   */
  getSpamEmails(): FakeEmail[] {
    return getSpamEmails();
  }

  /**
   * Get normal (non-transaction, non-spam) emails
   */
  getNormalEmails(): FakeEmail[] {
    return getNormalEmails();
  }

  /**
   * Get synced emails
   */
  getSyncedEmails(): ProcessableEmail[] {
    return [...this.syncedEmails];
  }

  /**
   * Get classification results
   */
  getClassificationResults(): Map<string, ClassificationResult> {
    return new Map(this.classificationResults);
  }

  /**
   * Get detected transactions
   */
  getDetectedTransactions(): DetectedTransaction[] {
    return [...this.detectedTransactions];
  }

  /**
   * Get mock providers for advanced testing
   */
  getProviders(): {
    gmail: MockGmailProvider;
    outlook: MockOutlookProvider;
    ios: MockiOSBackupProvider;
  } {
    return {
      gmail: this.gmailProvider,
      outlook: this.outlookProvider,
      ios: this.iosProvider,
    };
  }

  // Private methods

  private ensureSetup(): void {
    if (!this.isSetup) {
      throw new Error('TestSandbox not initialized. Call setup() first.');
    }
  }

  /**
   * Pattern-based email classification
   * Simulates AI detection for testing purposes
   */
  private classifyEmail(email: ProcessableEmail): ClassificationResult {
    const text = `${email.subject} ${email.bodyText}`.toLowerCase();

    // Spam detection patterns
    const spamPatterns = [
      /urgent.*claim.*prize/i,
      /win.*\$\d+/i,
      /lottery.*winner/i,
      /\$\d{1,3}(,\d{3})+.*prize/i,
      /act now.*expires/i,
      /bank.*details.*click/i,
      /offshore.*bank/i,
    ];

    const isSpam = spamPatterns.some((pattern) => pattern.test(text));

    // Transaction detection patterns
    const transactionPatterns = [
      /purchase agreement/i,
      /listing agreement/i,
      /closing (scheduled|date|funds)/i,
      /escrow/i,
      /home inspection/i,
      /title search/i,
      /appraisal/i,
      /mortgage (pre-?approval|loan)/i,
      /counter offer/i,
      /earnest money/i,
      /property at \d+/i,
      /\d+ (oak|maple|pine|elm|cedar|walnut|birch|spruce)/i,
      /final walk-?through/i,
      /disclosure documents?/i,
      /wire transfer instructions/i,
    ];

    const isTransactionRelated =
      !isSpam && transactionPatterns.some((pattern) => pattern.test(text));

    // Transaction type detection
    let transactionType: 'purchase' | 'sale' | null = null;
    if (isTransactionRelated) {
      if (
        /listing agreement|offer received|seller/i.test(text) &&
        !/buyer|purchasing|purchase price/i.test(text)
      ) {
        transactionType = 'sale';
      } else if (
        /purchase|buyer|mortgage|pre-?approval|closing funds|walk-?through/i.test(text)
      ) {
        transactionType = 'purchase';
      }
    }

    // Stage detection
    let stage: ClassificationResult['stage'] = null;
    if (isTransactionRelated) {
      if (/new listing|listing agreement/i.test(text)) {
        stage = 'intro';
      } else if (/showing|schedule.*view/i.test(text)) {
        stage = 'showing';
      } else if (/offer|counter offer/i.test(text)) {
        stage = 'offer';
      } else if (/inspection/i.test(text)) {
        stage = 'inspections';
      } else if (/escrow|title|appraisal|disclosure|pre-?approval/i.test(text)) {
        stage = 'escrow';
      } else if (/closing|wire transfer|walk-?through/i.test(text)) {
        stage = 'closing';
      } else if (/congratulations.*new home|post.*closing|hoa documents/i.test(text)) {
        stage = 'post_closing';
      }
    }

    // Confidence calculation
    let confidence = 0.5;
    if (isSpam || isTransactionRelated) {
      const matchCount = (isSpam ? spamPatterns : transactionPatterns).filter((p) =>
        p.test(text)
      ).length;
      confidence = Math.min(0.95, 0.5 + matchCount * 0.15);
    }

    return {
      messageId: email.externalId,
      isTransactionRelated,
      isSpam,
      confidence,
      transactionType,
      stage,
    };
  }

  /**
   * Extract transaction from a thread of related emails
   */
  private extractTransactionFromThread(
    threadId: string,
    emails: Array<{ id: string; email?: ProcessableEmail }>
  ): DetectedTransaction | null {
    if (emails.length === 0) return null;

    // Extract property address from email content
    let propertyAddress = 'Unknown Property';
    const addressPatterns = [
      /(\d+\s+(?:oak|maple|pine|elm|cedar|walnut|birch|spruce)\s+(?:street|avenue|boulevard|lane|road|way|drive|court))/i,
      /property at\s+(\d+[^.]+)/i,
      /(\d+\s+[a-z]+\s+(?:st|ave|blvd|ln|rd|way|dr|ct))/i,
    ];

    for (const { email } of emails) {
      if (!email) continue;
      const text = `${email.subject} ${email.bodyText}`;
      for (const pattern of addressPatterns) {
        const match = text.match(pattern);
        if (match) {
          propertyAddress = match[1].trim();
          break;
        }
      }
      if (propertyAddress !== 'Unknown Property') break;
    }

    // Aggregate classification results
    const classifications = emails
      .map(({ id }) => this.classificationResults.get(id))
      .filter((c): c is ClassificationResult => c !== undefined);

    // Determine transaction type (majority vote)
    const typeCounts = { purchase: 0, sale: 0 };
    for (const c of classifications) {
      if (c.transactionType === 'purchase') typeCounts.purchase++;
      if (c.transactionType === 'sale') typeCounts.sale++;
    }
    const transactionType =
      typeCounts.purchase >= typeCounts.sale
        ? typeCounts.purchase > 0
          ? 'purchase'
          : null
        : 'sale';

    // Determine stage (latest stage in progression)
    const stageOrder = [
      'intro',
      'showing',
      'offer',
      'inspections',
      'escrow',
      'closing',
      'post_closing',
    ];
    let latestStage: ClassificationResult['stage'] = null;
    for (const c of classifications) {
      if (c.stage) {
        const currentIndex = latestStage ? stageOrder.indexOf(latestStage) : -1;
        const newIndex = stageOrder.indexOf(c.stage);
        if (newIndex > currentIndex) {
          latestStage = c.stage;
        }
      }
    }

    // Calculate average confidence
    const avgConfidence =
      classifications.length > 0
        ? classifications.reduce((sum, c) => sum + c.confidence, 0) / classifications.length
        : 0;

    return {
      propertyAddress,
      transactionType,
      stage: latestStage,
      confidence: avgConfidence,
      messageCount: emails.length,
      messageIds: emails.map(({ id }) => id),
    };
  }
}

/**
 * Create a pre-configured sandbox for quick testing
 */
export async function createTestSandbox(
  options: TestSandboxOptions = {}
): Promise<TestSandbox> {
  const sandbox = new TestSandbox(options);
  await sandbox.setup();
  return sandbox;
}
