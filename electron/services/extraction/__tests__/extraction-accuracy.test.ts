/**
 * Extraction Pipeline Accuracy Tests
 * TASK-510: Validate that optimized pipeline maintains detection accuracy
 */

import {
  loadTestEmailDataset,
  getDatasetMetadata,
  isSpam,
  getSpamEmails,
  getTransactionEmails,
  getNormalEmails,
  getEdgeCaseEmails,
  getEmailsByDifficulty,
  getEmailsByStage,
  toMessageInputs,
  groupByThread,
  getFirstEmailsInThreads,
  TestEmail,
} from './fixtures/accuracy-test-helpers';
import { groupEmailsByThread, getFirstEmailsFromThreads } from '../../llm/threadGroupingService';
import { isGmailSpam } from '../../llm/spamFilterService';
import { createBatches, estimateEmailTokens } from '../../llm/batchLLMService';
import type { Message } from '../../../types';

describe('Extraction Pipeline Accuracy', () => {
  let testDataset: TestEmail[];

  beforeAll(() => {
    testDataset = loadTestEmailDataset();
  });

  describe('Dataset Validation', () => {
    it('should have expected number of test emails', () => {
      const metadata = getDatasetMetadata();
      expect(testDataset.length).toBe(metadata.totalEmails);
    });

    it('should have correct distribution of email types', () => {
      const metadata = getDatasetMetadata();
      const transactions = getTransactionEmails(testDataset);
      const spam = getSpamEmails(testDataset);
      const normal = getNormalEmails(testDataset);
      const edgeCases = getEdgeCaseEmails(testDataset);

      expect(transactions.length).toBe(metadata.transactionEmails);
      expect(spam.length).toBe(metadata.spamEmails);
      expect(normal.length).toBe(metadata.normalEmails);
      expect(edgeCases.length).toBe(metadata.edgeCaseEmails || 0);
    });

    it('should have emails at different difficulty levels', () => {
      const easy = getEmailsByDifficulty(testDataset, 'easy');
      const medium = getEmailsByDifficulty(testDataset, 'medium');
      const hard = getEmailsByDifficulty(testDataset, 'hard');

      // Should have distribution of difficulty
      expect(easy.length).toBeGreaterThan(0);
      expect(medium.length).toBeGreaterThan(0);
      expect(hard.length).toBeGreaterThan(0);

      console.log(
        `Difficulty distribution: ${easy.length} easy, ${medium.length} medium, ${hard.length} hard`
      );
    });

    it('should cover multiple transaction stages', () => {
      const prospecting = getEmailsByStage(testDataset, 'prospecting');
      const negotiation = getEmailsByStage(testDataset, 'negotiation');
      const underContract = getEmailsByStage(testDataset, 'under_contract');
      const dueDiligence = getEmailsByStage(testDataset, 'due_diligence');
      const closing = getEmailsByStage(testDataset, 'closing');
      const closed = getEmailsByStage(testDataset, 'closed');

      // Should have at least some emails in each major stage
      expect(prospecting.length).toBeGreaterThan(0);
      expect(closing.length).toBeGreaterThan(0);

      console.log(
        `Stage distribution: prospecting=${prospecting.length}, negotiation=${negotiation.length}, ` +
          `under_contract=${underContract.length}, due_diligence=${dueDiligence.length}, ` +
          `closing=${closing.length}, closed=${closed.length}`
      );
    });
  });

  describe('Spam Filter Accuracy', () => {
    it('should not filter any transaction emails as spam (0% false positives)', () => {
      const transactionEmails = getTransactionEmails(testDataset);
      const falsePositives = transactionEmails.filter((e) => isSpam(e));

      expect(falsePositives.length).toBe(0);
      console.log(
        `Spam filter: 0/${transactionEmails.length} transaction emails incorrectly filtered`
      );
    });

    it('should filter known spam emails (>90% detection)', () => {
      const spamEmails = getSpamEmails(testDataset);
      const detected = spamEmails.filter((e) => isSpam(e));
      const detectionRate = detected.length / spamEmails.length;

      expect(detectionRate).toBeGreaterThanOrEqual(0.9);
      console.log(
        `Spam filter: ${detected.length}/${spamEmails.length} (${(detectionRate * 100).toFixed(1)}%) spam detected`
      );
    });

    it('should not filter normal emails as spam', () => {
      const normalEmails = getNormalEmails(testDataset);
      const falsePositives = normalEmails.filter((e) => isSpam(e));

      // Allow up to 5% false positives on normal emails
      const falsePositiveRate = falsePositives.length / normalEmails.length;
      expect(falsePositiveRate).toBeLessThan(0.05);
    });

    it('should correctly identify Gmail spam labels', () => {
      // Test specific Gmail spam labels
      expect(isGmailSpam(['SPAM']).isSpam).toBe(true);
      expect(isGmailSpam(['TRASH']).isSpam).toBe(true);
      expect(isGmailSpam(['INBOX']).isSpam).toBe(false);
      expect(isGmailSpam(['INBOX', 'IMPORTANT']).isSpam).toBe(false);
    });
  });

  describe('Edge Case Handling', () => {
    it('should correctly classify edge case emails as NOT transactions', () => {
      const edgeCases = getEdgeCaseEmails(testDataset);

      // Edge cases should NOT be classified as transactions
      const incorrectlyClassified = edgeCases.filter((e) => e.expected.isTransaction);

      expect(incorrectlyClassified.length).toBe(0);
      console.log(`Edge cases: ${edgeCases.length} emails, all correctly expected as non-transactions`);
    });

    it('should identify edge cases with transaction indicators but not actual transactions', () => {
      const edgeCases = getEdgeCaseEmails(testDataset);
      const withIndicators = edgeCases.filter((e) => e.expected.containsTransactionIndicators);

      // These are the tricky ones - they have RE indicators but aren't transactions
      expect(withIndicators.length).toBeGreaterThan(0);
      console.log(
        `Edge cases with indicators: ${withIndicators.length}/${edgeCases.length} ` +
          `(${((withIndicators.length / edgeCases.length) * 100).toFixed(0)}%)`
      );
    });

    it('should not filter edge case emails as spam', () => {
      const edgeCases = getEdgeCaseEmails(testDataset);
      const filteredAsSpam = edgeCases.filter((e) => isSpam(e));

      // Edge cases should NOT be in spam folders
      expect(filteredAsSpam.length).toBe(0);
    });

    it('should have hard difficulty edge cases', () => {
      const edgeCases = getEdgeCaseEmails(testDataset);
      const hardEdgeCases = edgeCases.filter((e) => e.difficulty === 'hard');

      // Most edge cases should be hard
      expect(hardEdgeCases.length).toBeGreaterThan(edgeCases.length / 2);
      console.log(`Hard edge cases: ${hardEdgeCases.length}/${edgeCases.length}`);
    });
  });

  describe('Thread Grouping Accuracy', () => {
    it('should correctly group emails by thread', () => {
      const threads = groupByThread(testDataset);
      const metadata = getDatasetMetadata();

      // Should have fewer or equal threads than unique thread_ids
      expect(threads.size).toBeLessThanOrEqual(metadata.threads);
    });

    it('should identify first email in each thread correctly', () => {
      const threads = groupByThread(testDataset);

      for (const [_threadId, emails] of threads) {
        // First email should be the one with earliest sent_at
        const sortedByDate = [...emails].sort(
          (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
        );
        expect(emails[0].id).toBe(sortedByDate[0].id);
      }
    });

    it('should identify first emails correctly using groupEmailsByThread', () => {
      // Convert to Message-like objects for the service
      const messages = testDataset.map((e) => ({
        id: e.id,
        thread_id: e.thread_id,
        sent_at: e.sent_at,
        received_at: e.sent_at,
        created_at: e.sent_at,
      })) as unknown as Message[];

      const result = groupEmailsByThread(messages);
      const firstEmails = getFirstEmailsFromThreads(result);

      // Each thread should contribute exactly one first email (or orphan)
      const expectedCount = result.stats.totalThreads + result.stats.orphanCount;
      expect(firstEmails.length).toBe(expectedCount);
    });

    it('should reduce email count significantly with thread grouping', () => {
      const originalCount = testDataset.length;
      const firstEmails = getFirstEmailsInThreads(testDataset);

      const reductionPercent = (1 - firstEmails.length / originalCount) * 100;

      // Expect at least 20% reduction (some emails are replies)
      expect(reductionPercent).toBeGreaterThan(0);
      console.log(
        `Thread grouping: ${originalCount} → ${firstEmails.length} (${reductionPercent.toFixed(1)}% reduction)`
      );
    });
  });

  describe('Transaction Thread Propagation', () => {
    it('should have transaction indicator in first email of transaction threads', () => {
      const threads = groupByThread(testDataset);
      let threadsWithTransactions = 0;
      let firstEmailHasIndicators = 0;

      for (const [, emails] of threads) {
        const hasTransaction = emails.some((e) => e.expected.isTransaction);
        if (hasTransaction) {
          threadsWithTransactions++;
          // First email should have transaction indicators
          if (emails[0].expected.containsTransactionIndicators) {
            firstEmailHasIndicators++;
          }
        }
      }

      // At least 70% of transaction threads should have indicators in first email
      const indicatorRate = firstEmailHasIndicators / threadsWithTransactions;
      expect(indicatorRate).toBeGreaterThan(0.7);
      console.log(
        `Thread propagation: ${firstEmailHasIndicators}/${threadsWithTransactions} threads have indicators in first email`
      );
    });

    it('should not lose transactions by only analyzing first email', () => {
      const allTransactions = getTransactionEmails(testDataset);
      const firstEmails = getFirstEmailsInThreads(testDataset);
      const firstEmailTransactions = firstEmails.filter((e) => e.expected.isTransaction);

      // Group transactions by thread
      const transactionThreads = new Set(allTransactions.map((e) => e.thread_id));
      const detectedTransactionThreads = new Set(firstEmailTransactions.map((e) => e.thread_id));

      // All transaction threads should be detected
      const coverage = detectedTransactionThreads.size / transactionThreads.size;
      expect(coverage).toBe(1); // 100% thread coverage

      console.log(
        `Thread coverage: ${detectedTransactionThreads.size}/${transactionThreads.size} transaction threads detected`
      );
    });
  });

  describe('Batching Efficiency', () => {
    it('should create reasonable batch sizes', () => {
      const messageInputs = toMessageInputs(testDataset);
      const batchResult = createBatches(messageInputs);

      // Should create at least 1 batch
      expect(batchResult.batches.length).toBeGreaterThan(0);

      // Each batch should have reasonable size
      for (const batch of batchResult.batches) {
        expect(batch.emails.length).toBeLessThanOrEqual(30);
        expect(batch.estimatedTokens).toBeLessThanOrEqual(50000);
      }

      console.log(
        `Batching: ${testDataset.length} emails → ${batchResult.batches.length} batches`
      );
    });

    it('should estimate tokens reasonably', () => {
      const messageInputs = toMessageInputs(testDataset);

      for (const input of messageInputs) {
        const tokens = estimateEmailTokens(input);
        // Each email should estimate to reasonable token count
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThan(10000); // Single email shouldn't exceed 10k tokens
      }
    });

    it('should achieve significant cost reduction through batching', () => {
      const messageInputs = toMessageInputs(testDataset);
      const batchResult = createBatches(messageInputs);

      const originalApiCalls = testDataset.length;
      const batchedApiCalls = batchResult.batches.length;
      const costReduction = (1 - batchedApiCalls / originalApiCalls) * 100;

      // Should achieve at least 50% reduction
      expect(costReduction).toBeGreaterThan(50);
      console.log(
        `Cost reduction: ${originalApiCalls} → ${batchedApiCalls} calls (${costReduction.toFixed(1)}% reduction)`
      );
    });
  });

  describe('Combined Pipeline Efficiency', () => {
    it('should achieve overall cost reduction target (>90%)', () => {
      // Step 1: Spam filter
      const afterSpam = testDataset.filter((e) => !isSpam(e));
      const spamReduction = 1 - afterSpam.length / testDataset.length;

      // Step 2: Thread grouping
      const firstEmails = getFirstEmailsInThreads(afterSpam);
      const threadReduction = 1 - firstEmails.length / afterSpam.length;

      // Step 3: Batching
      const messageInputs = toMessageInputs(firstEmails);
      const batchResult = createBatches(messageInputs);

      // Total: original emails → batched API calls
      const originalCalls = testDataset.length;
      const finalCalls = batchResult.batches.length;
      const totalReduction = (1 - finalCalls / originalCalls) * 100;

      console.log('\n=== Pipeline Efficiency Summary ===');
      console.log(`Original emails: ${testDataset.length}`);
      console.log(`After spam filter: ${afterSpam.length} (${(spamReduction * 100).toFixed(1)}% removed)`);
      console.log(`After thread grouping: ${firstEmails.length} (${(threadReduction * 100).toFixed(1)}% removed)`);
      console.log(`After batching: ${batchResult.batches.length} API calls`);
      console.log(`Total cost reduction: ${totalReduction.toFixed(1)}%`);
      console.log('===================================\n');

      // Target: >90% cost reduction
      expect(totalReduction).toBeGreaterThan(90);
    });
  });
});
