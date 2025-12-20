/**
 * Pipeline Performance Benchmarks
 * TASK-512: Ensure optimized pipeline meets speed and memory targets
 */

import { isGmailSpam } from '../llm/spamFilterService';
import { groupEmailsByThread, getFirstEmailsFromThreads } from '../llm/threadGroupingService';
import { createBatches } from '../llm/batchLLMService';
import type { Message } from '../../types';
import { MessageInput } from '../extraction/types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * CI machines may be slower - add tolerance
 * Per SR Engineer review: Add timing tolerance for CI
 */
const CI_TOLERANCE = process.env.CI ? 1.5 : 1.0;

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Generate realistic test emails for benchmarking
 */
function generateTestEmails(count: number): Message[] {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      id: `email_${i}`,
      thread_id: `thread_${Math.floor(i / 4)}`, // ~4 emails per thread
      subject: `Test email ${i} - Real Estate Update`,
      body_plain: 'x'.repeat(500),
      labels: getLabelsForEmail(i),
      sent_at: new Date(Date.now() - i * 3600000).toISOString(),
      received_at: new Date(Date.now() - i * 3600000).toISOString(),
      created_at: new Date().toISOString(),
    })) as Message[];
}

/**
 * Get labels for test email (10% spam, 10% trash, 80% inbox)
 */
function getLabelsForEmail(index: number): string[] {
  if (index % 10 === 0) {
    return ['SPAM'];
  }
  if (index % 10 === 1) {
    return ['TRASH'];
  }
  return ['INBOX'];
}

/**
 * Filter spam emails using the spam filter service
 */
function filterSpam(emails: Message[]): Message[] {
  return emails.filter((e) => {
    const gmailResult = isGmailSpam(e.labels || []);
    return !gmailResult.isSpam;
  });
}

/**
 * Convert Message to MessageInput for batching
 */
function toMessageInputs(emails: Message[]): MessageInput[] {
  return emails.map((e) => ({
    id: e.id,
    thread_id: e.thread_id,
    subject: e.subject || '',
    body: e.body_plain || '',
    sender: 'sender@email.com',
    recipients: ['recipient@email.com'],
    date: e.sent_at || new Date().toISOString(),
    labels: e.labels,
  }));
}

// ============================================================================
// Tests
// ============================================================================

describe('Pipeline Performance Benchmarks', () => {
  // Warm-up run before measurements (per SR Engineer review - JIT optimization)
  beforeAll(() => {
    const warmupEmails = generateTestEmails(10);
    filterSpam(warmupEmails);
    groupEmailsByThread(warmupEmails);
  });

  describe('Processing Speed', () => {
    it('should process 100 emails in <5 seconds (excluding LLM time)', () => {
      const emails = generateTestEmails(100);

      const start = performance.now();

      // Measure only local processing (spam filter, thread grouping, batching)
      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const batches = createBatches(toMessageInputs(firstEmails));

      const elapsed = performance.now() - start;

      // Use CI_TOLERANCE for slower CI machines (per SR Engineer review)
      expect(elapsed).toBeLessThan(5000 * CI_TOLERANCE);
      console.log(`Local processing for 100 emails: ${elapsed.toFixed(2)}ms`);
    });

    it('should process 600 emails in <10 seconds (excluding LLM time)', () => {
      const emails = generateTestEmails(600);

      const start = performance.now();

      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const batches = createBatches(toMessageInputs(firstEmails));

      const elapsed = performance.now() - start;

      // Use CI_TOLERANCE for slower CI machines (per SR Engineer review)
      expect(elapsed).toBeLessThan(10000 * CI_TOLERANCE);
      console.log(`Local processing for 600 emails: ${elapsed.toFixed(2)}ms`);
    });

    it('should process 1000 emails in <15 seconds (excluding LLM time)', () => {
      const emails = generateTestEmails(1000);

      const start = performance.now();

      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const batches = createBatches(toMessageInputs(firstEmails));

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(15000 * CI_TOLERANCE);
      console.log(`Local processing for 1000 emails: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should not exceed 500MB for 1000 emails', () => {
      // Force GC before memory test for accurate measurement (per SR Engineer review)
      // Run with --expose-gc flag: jest --expose-gc
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      const emails = generateTestEmails(1000);
      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const batches = createBatches(toMessageInputs(firstEmails));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsedMB = (finalMemory - initialMemory) / 1024 / 1024;

      expect(memoryUsedMB).toBeLessThan(500);
      console.log(`Memory used for 1000 emails: ${memoryUsedMB.toFixed(2)}MB`);
    });

    it('should have reasonable per-email memory footprint', () => {
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      const emails = generateTestEmails(500);
      filterSpam(emails);
      groupEmailsByThread(emails);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsedMB = (finalMemory - initialMemory) / 1024 / 1024;
      const memoryPerEmail = memoryUsedMB / emails.length;

      // Should use less than 0.5MB per email
      expect(memoryPerEmail).toBeLessThan(0.5);
      console.log(`Memory per email: ${(memoryPerEmail * 1024).toFixed(2)}KB`);
    });
  });

  describe('Scalability', () => {
    it('should scale linearly with email count', () => {
      const times: number[] = [];
      const counts = [100, 200, 400, 800];

      for (const count of counts) {
        const emails = generateTestEmails(count);

        const start = performance.now();
        filterSpam(emails);
        groupEmailsByThread(emails);
        const elapsed = performance.now() - start;

        times.push(elapsed);
        console.log(`${count} emails: ${elapsed.toFixed(2)}ms`);
      }

      // Check that 800 emails doesn't take more than 15x the time of 100 emails
      // (should be closer to 8x for linear, but allow overhead for system variation)
      const ratio = times[3] / times[0];
      expect(ratio).toBeLessThan(15);
      console.log(`Scalability ratio (800/100): ${ratio.toFixed(2)}x (expected: <15x, ideal: 8x)`);
    });

    it('should maintain consistent per-email processing time', () => {
      const results: Array<{ count: number; timePerEmail: number }> = [];
      const counts = [100, 300, 600, 1000];

      for (const count of counts) {
        const emails = generateTestEmails(count);

        const start = performance.now();
        filterSpam(emails);
        groupEmailsByThread(emails);
        const elapsed = performance.now() - start;

        const timePerEmail = elapsed / count;
        results.push({ count, timePerEmail });
        console.log(
          `${count} emails: ${timePerEmail.toFixed(4)}ms per email (total: ${elapsed.toFixed(2)}ms)`
        );
      }

      // Per-email time should be relatively consistent (within 3x of smallest)
      const minTime = Math.min(...results.map((r) => r.timePerEmail));
      const maxTime = Math.max(...results.map((r) => r.timePerEmail));
      expect(maxTime / minTime).toBeLessThan(3);
    });
  });

  describe('Batch Optimization', () => {
    it('should create optimal batch sizes', () => {
      const emails = generateTestEmails(600);
      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const result = createBatches(toMessageInputs(firstEmails));

      console.log('=== Batch Optimization Results ===');
      console.log(`Total emails: ${emails.length}`);
      console.log(`After spam filter: ${spamFiltered.length}`);
      console.log(`First emails to analyze: ${firstEmails.length}`);
      console.log(`Batches created: ${result.stats.totalBatches}`);
      console.log(`Avg emails per batch: ${result.stats.avgEmailsPerBatch.toFixed(1)}`);
      console.log(`Estimated tokens: ${result.stats.estimatedTotalTokens}`);
      console.log('==================================');

      // Should have reasonable batch sizes
      expect(result.stats.avgEmailsPerBatch).toBeGreaterThan(10);
      expect(result.stats.avgEmailsPerBatch).toBeLessThanOrEqual(30); // Max per batch
    });

    it('should not exceed token limits per batch', () => {
      const emails = generateTestEmails(1000);
      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const result = createBatches(toMessageInputs(firstEmails));

      // Each batch should be under the token limit
      for (const batch of result.batches) {
        expect(batch.estimatedTokens).toBeLessThanOrEqual(50000);
        expect(batch.emails.length).toBeLessThanOrEqual(30);
      }
    });
  });

  describe('Component Timing', () => {
    it('should measure time for each pipeline component', () => {
      const emails = generateTestEmails(600);

      // Spam filter timing
      const spamStart = performance.now();
      const spamFiltered = filterSpam(emails);
      const spamTime = performance.now() - spamStart;

      // Thread grouping timing
      const threadStart = performance.now();
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const threadTime = performance.now() - threadStart;

      // Batching timing
      const batchStart = performance.now();
      const batches = createBatches(toMessageInputs(firstEmails));
      const batchTime = performance.now() - batchStart;

      const totalTime = spamTime + threadTime + batchTime;

      console.log('\n=== Component Timing (600 emails) ===');
      console.log(`Spam filter: ${spamTime.toFixed(2)}ms (${((spamTime / totalTime) * 100).toFixed(1)}%)`);
      console.log(
        `Thread grouping: ${threadTime.toFixed(2)}ms (${((threadTime / totalTime) * 100).toFixed(1)}%)`
      );
      console.log(`Batching: ${batchTime.toFixed(2)}ms (${((batchTime / totalTime) * 100).toFixed(1)}%)`);
      console.log(`Total: ${totalTime.toFixed(2)}ms`);
      console.log('=====================================\n');

      // All components should complete quickly
      expect(spamTime).toBeLessThan(1000);
      expect(threadTime).toBeLessThan(1000);
      expect(batchTime).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty email list', () => {
      const emails: Message[] = [];

      const start = performance.now();
      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const batches = createBatches(toMessageInputs(firstEmails));
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      expect(batches.batches.length).toBe(0);
    });

    it('should handle all emails being spam', () => {
      const emails = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `email_${i}`,
          thread_id: `thread_${i}`,
          subject: `Spam ${i}`,
          body_plain: 'spam content',
          labels: ['SPAM'],
          sent_at: new Date().toISOString(),
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })) as Message[];

      const spamFiltered = filterSpam(emails);
      expect(spamFiltered.length).toBe(0);
    });

    it('should handle all emails in same thread', () => {
      const emails = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `email_${i}`,
          thread_id: 'single_thread', // All same thread
          subject: `Email ${i}`,
          body_plain: 'content',
          labels: ['INBOX'],
          sent_at: new Date(Date.now() - i * 3600000).toISOString(),
          received_at: new Date(Date.now() - i * 3600000).toISOString(),
          created_at: new Date().toISOString(),
        })) as Message[];

      const threadGrouping = groupEmailsByThread(emails);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);

      // Only 1 first email (all in same thread)
      expect(firstEmails.length).toBe(1);
    });
  });
});
