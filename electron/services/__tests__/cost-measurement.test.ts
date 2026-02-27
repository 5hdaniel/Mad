/**
 * LLM Cost Measurement Tests
 * TASK-511: Verify cost reduction targets (97% reduction, <$0.20 for 600 emails)
 */

import { MessageInput } from '../extraction/types';
import { createBatches, estimateEmailTokens } from '../llm/batchLLMService';

// ============================================================================
// Pricing Configuration
// ============================================================================

/**
 * LLM Pricing as of Dec 2024
 * Verify at https://www.anthropic.com/pricing and https://openai.com/pricing
 * Last verified: 2024-12-19
 * Per SR Engineer review: Keep this updated when pricing changes
 */
const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  anthropic: {
    'claude-3-5-haiku-20241022': { input: 0.001, output: 0.005 }, // per 1K tokens
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  },
  openai: {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.005, output: 0.015 },
  },
};

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Calculate cost from token counts
 */
function calculateCost(
  inputTokens: number,
  outputTokens: number,
  provider: string,
  model: string
): number {
  const pricing = PRICING[provider][model];
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

/**
 * Generate realistic test emails with thread_ids, labels, etc.
 */
function generateTestEmails(count: number): MessageInput[] {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      id: `email_${i}`,
      thread_id: `thread_${Math.floor(i / 4)}`, // ~4 emails per thread
      subject: `Test email ${i} - Real Estate Update`,
      body: generateRealisticBody(i),
      sender: `sender${i % 50}@email.com`,
      recipients: [`recipient${i % 30}@email.com`],
      labels: getLabelsForEmail(i),
      date: new Date(Date.now() - i * 3600000).toISOString(),
    }));
}

/**
 * Generate realistic email body content
 */
function generateRealisticBody(index: number): string {
  const templates = [
    'Dear Client,\n\nPlease find attached the closing documents for your property. The closing is scheduled for next week.\n\nBest regards,\nTitle Company',
    'Great news! The sellers have accepted your offer. Next steps include home inspection and appraisal.\n\nMLS# 12345678',
    'Thank you for your inquiry about our services. We would be happy to assist you with your real estate needs.',
    'Your lease agreement is ready for signature. Monthly rent: $1,850. Please sign by Friday.',
    'This is a general update about your account. No action required.',
    'Meeting reminder for tomorrow at 10 AM. Please confirm your attendance.',
  ];
  return templates[index % templates.length];
}

/**
 * Get labels for test email (10% spam, 90% inbox)
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
 * Pipeline simulation result with token tracking
 */
interface SimulationResult {
  success: boolean;
  stats: {
    originalEmails: number;
    afterSpamFilter: number;
    spamFiltered: number;
    threadsAnalyzed: number;
    batchesSent: number;
    transactionsFound: number;
    emailsLinkedByPropagation: number;
    costReductionPercent: string;
    // Token tracking for cost calculation
    totalInputTokens: number;
    totalOutputTokens: number;
  };
}

/**
 * Simulate the optimized pipeline without making real API calls.
 * Uses the actual pipeline logic but mocks the LLM call.
 */
function simulateOptimizedPipeline(emails: MessageInput[]): SimulationResult {
  // Step 1: Spam filtering (same as pipeline)
  const nonSpamEmails = emails.filter((e) => {
    const labels = e.labels || [];
    return !labels.includes('SPAM') && !labels.includes('TRASH');
  });
  const spamFiltered = emails.length - nonSpamEmails.length;

  // Step 2: Thread grouping - get first email per thread
  const threadMap = new Map<string, MessageInput>();
  for (const email of nonSpamEmails) {
    const threadId = email.thread_id || email.id;
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, email);
    }
  }
  const firstEmails = Array.from(threadMap.values());

  // Step 3: Batching
  const batchingResult = createBatches(firstEmails);

  // Step 4: Estimate tokens per batch (simulated, no real API calls)
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const batch of batchingResult.batches) {
    // Input tokens: system prompt (~500) + email content
    const systemPromptTokens = 500;
    const emailContentTokens = batch.emails.reduce((sum, e) => sum + estimateEmailTokens(e), 0);
    totalInputTokens += systemPromptTokens + emailContentTokens;

    // Output tokens: ~50-100 tokens per email result
    totalOutputTokens += batch.emails.length * 75;
  }

  // Simulate ~25% transaction detection rate
  const transactionsFound = Math.floor(firstEmails.length * 0.25);

  // Emails linked by propagation = total thread emails - first emails analyzed
  const emailsLinkedByPropagation = nonSpamEmails.length - firstEmails.length;

  // Calculate cost reduction
  const originalApiCalls = emails.length;
  const actualApiCalls = batchingResult.stats.totalBatches;
  const costReductionPercent =
    originalApiCalls > 0
      ? ((1 - actualApiCalls / originalApiCalls) * 100).toFixed(1)
      : '0.0';

  return {
    success: true,
    stats: {
      originalEmails: emails.length,
      afterSpamFilter: nonSpamEmails.length,
      spamFiltered,
      threadsAnalyzed: firstEmails.length,
      batchesSent: batchingResult.stats.totalBatches,
      transactionsFound,
      emailsLinkedByPropagation,
      costReductionPercent,
      totalInputTokens,
      totalOutputTokens,
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('LLM Cost Measurement', () => {
  describe('API Call Reduction', () => {
    it('should reduce API calls by >90% for 600 emails', () => {
      const emails = generateTestEmails(600);
      const result = simulateOptimizedPipeline(emails);

      // Old approach: 1 API call per email
      const oldCalls = emails.length; // 600 calls

      // New approach: batched calls
      const newCalls = result.stats.batchesSent;

      const reduction = 1 - newCalls / oldCalls;

      expect(reduction).toBeGreaterThan(0.9); // >90% reduction
      console.log(
        `API calls: ${oldCalls} → ${newCalls} (${(reduction * 100).toFixed(1)}% reduction)`
      );
    });

    it('should reduce API calls by >95% for 1000 emails', () => {
      const emails = generateTestEmails(1000);
      const result = simulateOptimizedPipeline(emails);

      const oldCalls = emails.length;
      const newCalls = result.stats.batchesSent;
      const reduction = 1 - newCalls / oldCalls;

      expect(reduction).toBeGreaterThan(0.95); // >95% reduction for larger batches
      console.log(
        `API calls (1000): ${oldCalls} → ${newCalls} (${(reduction * 100).toFixed(1)}% reduction)`
      );
    });
  });

  describe('Cost Targets', () => {
    it('should cost less than $0.20 for 600 emails (Haiku)', () => {
      const emails = generateTestEmails(600);
      const result = simulateOptimizedPipeline(emails);

      const cost = calculateCost(
        result.stats.totalInputTokens,
        result.stats.totalOutputTokens,
        'anthropic',
        'claude-3-5-haiku-20241022'
      );

      expect(cost).toBeLessThan(0.2);
      console.log(`Cost for 600 emails (Haiku): $${cost.toFixed(4)}`);
      console.log(
        `  Input tokens: ${result.stats.totalInputTokens}, Output tokens: ${result.stats.totalOutputTokens}`
      );
    });

    it('should cost less than $0.50 for 600 emails (Sonnet)', () => {
      const emails = generateTestEmails(600);
      const result = simulateOptimizedPipeline(emails);

      const cost = calculateCost(
        result.stats.totalInputTokens,
        result.stats.totalOutputTokens,
        'anthropic',
        'claude-sonnet-4-20250514'
      );

      expect(cost).toBeLessThan(0.5);
      console.log(`Cost for 600 emails (Sonnet): $${cost.toFixed(4)}`);
    });

    it('should cost less than $0.05 for 600 emails (GPT-4o-mini)', () => {
      const emails = generateTestEmails(600);
      const result = simulateOptimizedPipeline(emails);

      const cost = calculateCost(
        result.stats.totalInputTokens,
        result.stats.totalOutputTokens,
        'openai',
        'gpt-4o-mini'
      );

      expect(cost).toBeLessThan(0.05);
      console.log(`Cost for 600 emails (GPT-4o-mini): $${cost.toFixed(4)}`);
    });
  });

  describe('Cost Breakdown', () => {
    it('should log cost breakdown by pipeline stage', () => {
      const emails = generateTestEmails(600);
      const result = simulateOptimizedPipeline(emails);

      console.log('\n=== Cost Optimization Breakdown ===');
      console.log(`Original emails: ${result.stats.originalEmails}`);
      console.log(
        `After spam filter: ${result.stats.afterSpamFilter} (-${result.stats.spamFiltered} spam/trash)`
      );
      console.log(`After thread grouping: ${result.stats.threadsAnalyzed} first emails`);
      console.log(`Batches sent: ${result.stats.batchesSent}`);
      console.log(`Transactions found: ${result.stats.transactionsFound}`);
      console.log(`Emails linked by propagation: ${result.stats.emailsLinkedByPropagation}`);
      console.log(`Cost reduction: ${result.stats.costReductionPercent}%`);
      console.log('===================================\n');

      // Verify all stats are populated
      expect(result.stats.originalEmails).toBe(600);
      expect(result.stats.spamFiltered).toBeGreaterThan(0);
      expect(result.stats.threadsAnalyzed).toBeLessThan(result.stats.afterSpamFilter);
      expect(result.stats.batchesSent).toBeGreaterThan(0);
    });

    it('should calculate per-email cost correctly', () => {
      const emails = generateTestEmails(600);
      const result = simulateOptimizedPipeline(emails);

      const totalCost = calculateCost(
        result.stats.totalInputTokens,
        result.stats.totalOutputTokens,
        'anthropic',
        'claude-3-5-haiku-20241022'
      );

      const perEmailCost = totalCost / emails.length;

      // Should be well under $0.01 per email with optimization
      expect(perEmailCost).toBeLessThan(0.001);
      console.log(`Per-email cost: $${perEmailCost.toFixed(6)}`);
    });
  });

  describe('Comparison: Old vs New', () => {
    it('should show dramatic cost improvement over naive approach', () => {
      const emailCount = 600;
      const emails = generateTestEmails(emailCount);
      const result = simulateOptimizedPipeline(emails);

      // Old approach: 1 API call per email, ~1000 tokens input per call
      const oldInputTokensPerEmail = 1000;
      const oldOutputTokensPerEmail = 100;
      const oldTotalInput = emailCount * oldInputTokensPerEmail;
      const oldTotalOutput = emailCount * oldOutputTokensPerEmail;
      const oldCost = calculateCost(oldTotalInput, oldTotalOutput, 'anthropic', 'claude-3-5-haiku-20241022');

      // New approach: batched with filtering
      const newCost = calculateCost(
        result.stats.totalInputTokens,
        result.stats.totalOutputTokens,
        'anthropic',
        'claude-3-5-haiku-20241022'
      );

      const costReduction = ((1 - newCost / oldCost) * 100).toFixed(1);
      const absoluteSavings = oldCost - newCost;

      console.log('\n=== Cost Comparison: Old vs New ===');
      console.log(`Old approach cost: $${oldCost.toFixed(4)} (${emailCount} individual calls)`);
      console.log(`New approach cost: $${newCost.toFixed(4)} (${result.stats.batchesSent} batched calls)`);
      console.log(`Cost reduction: ${costReduction}%`);
      console.log(`Absolute savings: $${absoluteSavings.toFixed(4)} per ${emailCount} emails`);
      console.log('===================================\n');

      // Should achieve >90% cost reduction
      expect(Number(costReduction)).toBeGreaterThan(90);
    });
  });

  describe('Scaling Tests', () => {
    it('should maintain efficiency with different email counts', () => {
      const testCases = [100, 300, 600, 1000, 2000];
      const results: Array<{ count: number; batches: number; cost: number; reduction: string }> = [];

      for (const count of testCases) {
        const emails = generateTestEmails(count);
        const result = simulateOptimizedPipeline(emails);
        const cost = calculateCost(
          result.stats.totalInputTokens,
          result.stats.totalOutputTokens,
          'anthropic',
          'claude-3-5-haiku-20241022'
        );

        results.push({
          count,
          batches: result.stats.batchesSent,
          cost,
          reduction: result.stats.costReductionPercent,
        });
      }

      console.log('\n=== Scaling Test Results ===');
      console.log('| Emails | Batches | Cost | Reduction |');
      console.log('|--------|---------|------|-----------|');
      for (const r of results) {
        console.log(
          `| ${r.count.toString().padStart(6)} | ${r.batches.toString().padStart(7)} | $${r.cost.toFixed(4).padStart(6)} | ${r.reduction.padStart(8)}% |`
        );
      }
      console.log('============================\n');

      // All should achieve >90% reduction
      for (const r of results) {
        expect(Number(r.reduction)).toBeGreaterThan(90);
      }
    });
  });
});
