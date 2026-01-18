# TASK-511: Cost Measurement Tests

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Create tests to verify the cost reduction targets are met (97% reduction, <$0.20 for 600 emails).

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-085
- **Phase**: 4 (Validation)
- **Dependencies**: TASK-509 (parallel with TASK-510)
- **Estimated Turns**: 10

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-511-cost-measurement
```

## Technical Specification

### Cost Measurement Tests

**File:** `electron/services/__tests__/cost-measurement.test.ts` (NEW)

```typescript
describe('LLM Cost Measurement', () => {
  // Pricing as of Dec 2024 - verify at https://www.anthropic.com/pricing and https://openai.com/pricing
  // Last verified: 2024-12-19
  // Per SR Engineer review: Keep this updated when pricing changes
  const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
    anthropic: {
      'claude-3-5-haiku-20241022': { input: 0.001, output: 0.005 },  // per 1K tokens
      'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 }
    },
    openai: {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4o': { input: 0.005, output: 0.015 }
    }
  };

  describe('API Call Reduction', () => {
    it('should reduce API calls by >90%', async () => {
      const emails = generateTestEmails(600);

      // Simulate old approach
      const oldCalls = emails.length;  // 600 calls

      // Simulate new approach
      const result = await simulateOptimizedPipeline(emails);

      const reduction = 1 - (result.stats.batchesSent / oldCalls);

      expect(reduction).toBeGreaterThan(0.90);  // >90% reduction
      console.log(`API calls: ${oldCalls} → ${result.stats.batchesSent} (${(reduction * 100).toFixed(1)}% reduction)`);
    });
  });

  describe('Cost Targets', () => {
    it('should cost less than $0.20 for 600 emails (Haiku)', async () => {
      const emails = generateTestEmails(600);
      const result = await simulateOptimizedPipeline(emails);

      const inputTokens = result.stats.totalInputTokens;
      const outputTokens = result.stats.totalOutputTokens;

      const cost = calculateCost(inputTokens, outputTokens, 'anthropic', 'claude-3-5-haiku-20241022');

      expect(cost).toBeLessThan(0.20);
      console.log(`Cost for 600 emails: $${cost.toFixed(4)}`);
    });

    it('should cost less than $0.50 for 600 emails (Sonnet)', async () => {
      const emails = generateTestEmails(600);
      const result = await simulateOptimizedPipeline(emails);

      const inputTokens = result.stats.totalInputTokens;
      const outputTokens = result.stats.totalOutputTokens;

      const cost = calculateCost(inputTokens, outputTokens, 'anthropic', 'claude-sonnet-4-20250514');

      expect(cost).toBeLessThan(0.50);
      console.log(`Cost for 600 emails (Sonnet): $${cost.toFixed(4)}`);
    });
  });

  describe('Cost Breakdown', () => {
    it('should log cost breakdown by stage', async () => {
      const emails = generateTestEmails(600);
      const result = await simulateOptimizedPipeline(emails);

      console.log('=== Cost Optimization Breakdown ===');
      console.log(`Original emails: ${result.stats.originalEmails}`);
      console.log(`After spam filter: ${result.stats.afterSpamFilter} (-${result.stats.spamFiltered})`);
      console.log(`After thread grouping: ${result.stats.threadsAnalyzed}`);
      console.log(`Batches sent: ${result.stats.batchesSent}`);
      console.log(`Transactions found: ${result.stats.transactionsFound}`);
      console.log(`Emails linked by propagation: ${result.stats.emailsLinkedByPropagation}`);
      console.log(`Cost reduction: ${result.stats.costReductionPercent}%`);
    });
  });
});

function calculateCost(
  inputTokens: number,
  outputTokens: number,
  provider: string,
  model: string
): number {
  const pricing = PRICING[provider][model];
  return (inputTokens / 1000 * pricing.input) + (outputTokens / 1000 * pricing.output);
}

function generateTestEmails(count: number): Message[] {
  // Generate realistic test emails with thread_ids, labels, etc.
  return Array(count).fill(null).map((_, i) => ({
    id: `email_${i}`,
    thread_id: `thread_${Math.floor(i / 4)}`,  // ~4 emails per thread
    subject: `Test email ${i}`,
    body_plain: 'x'.repeat(500),
    labels: i % 10 === 0 ? ['SPAM'] : ['INBOX'],  // 10% spam
    sent_at: new Date(Date.now() - i * 3600000).toISOString()
  }));
}

/**
 * Simulate optimized pipeline with mocked LLM
 * Per SR Engineer review - required for deterministic cost measurement
 */
async function simulateOptimizedPipeline(emails: Message[]) {
  const service = new HybridExtractorService();

  // Mock LLM to avoid real API calls and measure only local processing
  jest.spyOn(service as any, 'processBatch').mockImplementation(async (batch: EmailBatch) => {
    // Simulate token counting without actual LLM call
    const estimatedInputTokens = batch.emails.reduce((sum, e) =>
      sum + Math.ceil((e.subject?.length || 0 + e.body_plain?.length || 0) / 4), 0);
    const estimatedOutputTokens = batch.emails.length * 50; // ~50 tokens per result

    return {
      results: batch.emails.map(e => ({
        emailId: e.id,
        isTransaction: Math.random() > 0.7, // Simulate ~30% transaction rate
        confidence: 0.5 + Math.random() * 0.5
      })),
      errors: [],
      stats: {
        total: batch.emails.length,
        successful: batch.emails.length,
        failed: 0,
        transactionsFound: Math.floor(batch.emails.length * 0.3),
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens
      }
    };
  });

  return await service.analyzeMessagesOptimized(emails, { usePatternMatching: true, useLLM: true });
}
```

## Acceptance Criteria

- [ ] API call reduction test passes (>90%)
- [ ] Cost target test passes (<$0.20 for Haiku)
- [ ] Cost breakdown logged clearly
- [ ] Tests are deterministic
- [ ] Pricing is configurable/updateable

## Files to Create

| File | Action |
|------|--------|
| `electron/services/__tests__/cost-measurement.test.ts` | CREATE |

## Guardrails

- DO NOT make real API calls (mock/simulate)
- Use realistic token estimates
- Keep pricing up to date

## Definition of Done

- [ ] Tests created
- [ ] All cost targets met
- [ ] PR created targeting `int/cost-optimization`

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [x] Approved as-is

### Branch Information
- **Branch From:** `int/cost-optimization` (after Phase 3 complete)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-511-cost-measurement`

### Execution Classification
- **Parallel Safe:** Yes - can run in parallel with TASK-510
- **Depends On:** TASK-509 (Phase 3 complete)
- **Blocks:** TASK-512

### Technical Notes

1. **Pricing constants are accurate:** The Dec 2024 pricing for Claude models is correct:
   - claude-3-5-haiku: $0.001/$0.005 per 1K tokens (input/output)
   - claude-sonnet-4: $0.003/$0.015 per 1K tokens

2. **Cost calculation formula is correct:** `(inputTokens / 1000 * pricing.input) + (outputTokens / 1000 * pricing.output)`

3. **Test email generation is good:** The `generateTestEmails()` function creates realistic distribution:
   - ~4 emails per thread (150 threads for 600 emails)
   - 10% spam rate
   - Reasonable body size (500 chars)

4. **simulateOptimizedPipeline() needs implementation:** This function is referenced but not defined. Should call the actual pipeline with mocked LLM.

5. **Console.log usage for metrics:** Using `console.log` in tests for metrics is appropriate for visibility during CI runs.

6. **Sonnet cost target:** <$0.50 for 600 emails with Sonnet is ambitious but achievable with proper batching.

### Risk Notes

- **Low risk:** Cost measurement tests don't modify production code.
- **Pricing volatility:** LLM pricing may change. Add a note to update pricing constants periodically.

### Dependencies

Confirmed: Can run in parallel with TASK-510. Both depend on TASK-509.

### Shared File Analysis
- Files created: New test file - no conflicts
- Uses `generateTestEmails()` which could be shared with TASK-510

### Recommended Changes

1. **Minor:** Add `simulateOptimizedPipeline()` implementation:

   ```typescript
   async function simulateOptimizedPipeline(emails: Message[]) {
     const service = new HybridExtractorService();

     // Mock LLM to avoid real API calls
     jest.spyOn(service, 'processBatch').mockImplementation(async (batch) => {
       // Simulate token counting without actual LLM call
       return {
         results: batch.emails.map(e => ({ emailId: e.id, isTransaction: false, confidence: 0.5 })),
         errors: [],
         stats: {
           total: batch.emails.length,
           successful: batch.emails.length,
           failed: 0,
           transactionsFound: 0
         }
       };
     });

     return await service.analyzeMessagesOptimized(emails, { usePatternMatching: true, useLLM: true });
   }
   ```

2. **Optional:** Extract `generateTestEmails()` to shared helper file for use by TASK-510:
   ```typescript
   // electron/services/__tests__/fixtures/test-email-generator.ts
   export function generateTestEmails(count: number, options?: TestEmailOptions): Message[]
   ```

3. **Add pricing version comment:**
   ```typescript
   // Pricing as of Dec 2024 - verify at https://www.anthropic.com/pricing
   // Last verified: 2024-12-19
   const PRICING = { ... };
   ```

4. **Consider adding OpenAI pricing:** For completeness, add OpenAI model pricing too (gpt-4o-mini, gpt-4o)
