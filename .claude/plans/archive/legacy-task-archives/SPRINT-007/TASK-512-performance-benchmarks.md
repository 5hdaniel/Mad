# TASK-512: Performance Benchmarks

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Create performance benchmarks to ensure optimized pipeline meets speed targets.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-085
- **Phase**: 4 (Validation)
- **Dependencies**: TASK-510, TASK-511
- **Estimated Turns**: 10

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-512-performance-benchmarks
```

## Technical Specification

### Performance Benchmark Suite

**File:** `electron/services/__tests__/performance-benchmark.test.ts` (NEW)

```typescript
// Per SR Engineer review: Add proper imports
import { isGmailSpam, isOutlookJunk } from '../llm/spamFilterService';
import { groupEmailsByThread, getFirstEmailsFromThreads } from '../llm/threadGroupingService';
import { createBatches } from '../llm/batchLLMService';
import { Message } from '../../types';

// CI machines may be slower - add tolerance (per SR Engineer review)
const CI_TOLERANCE = process.env.CI ? 1.5 : 1.0;

describe('Pipeline Performance Benchmarks', () => {

  // Warm-up run before measurements (per SR Engineer review - JIT optimization)
  beforeAll(() => {
    const warmupEmails = generateTestEmails(10);
    filterSpam(warmupEmails);
    groupEmailsByThread(warmupEmails);
  });

  describe('Processing Speed', () => {
    it('should process 100 emails in <5 seconds (excluding LLM time)', async () => {
      const emails = generateTestEmails(100);

      const start = performance.now();

      // Measure only local processing (spam filter, thread grouping, batching)
      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const batches = createBatches(firstEmails);

      const elapsed = performance.now() - start;

      // Use CI_TOLERANCE for slower CI machines (per SR Engineer review)
      expect(elapsed).toBeLessThan(5000 * CI_TOLERANCE);
      console.log(`Local processing for 100 emails: ${elapsed.toFixed(2)}ms`);
    });

    it('should process 600 emails in <10 seconds (excluding LLM time)', async () => {
      const emails = generateTestEmails(600);

      const start = performance.now();

      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const batches = createBatches(firstEmails);

      const elapsed = performance.now() - start;

      // Use CI_TOLERANCE for slower CI machines (per SR Engineer review)
      expect(elapsed).toBeLessThan(10000 * CI_TOLERANCE);
      console.log(`Local processing for 600 emails: ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should not exceed 500MB for 1000 emails', async () => {
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
      const batches = createBatches(firstEmails);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsedMB = (finalMemory - initialMemory) / 1024 / 1024;

      expect(memoryUsedMB).toBeLessThan(500);
      console.log(`Memory used for 1000 emails: ${memoryUsedMB.toFixed(2)}MB`);
    });
  });

  describe('Scalability', () => {
    it('should scale linearly with email count', async () => {
      const times: number[] = [];

      for (const count of [100, 200, 400, 800]) {
        const emails = generateTestEmails(count);

        const start = performance.now();
        filterSpam(emails);
        groupEmailsByThread(emails);
        const elapsed = performance.now() - start;

        times.push(elapsed);
        console.log(`${count} emails: ${elapsed.toFixed(2)}ms`);
      }

      // Check that 800 emails doesn't take more than 4x the time of 100 emails
      const ratio = times[3] / times[0];
      expect(ratio).toBeLessThan(10);  // Allow some overhead, but should be roughly linear
    });
  });

  describe('Batch Optimization', () => {
    it('should create optimal batch sizes', async () => {
      const emails = generateTestEmails(600);
      const spamFiltered = filterSpam(emails);
      const threadGrouping = groupEmailsByThread(spamFiltered);
      const firstEmails = getFirstEmailsFromThreads(threadGrouping);
      const result = createBatches(firstEmails);

      console.log('=== Batch Optimization Results ===');
      console.log(`Total emails: ${emails.length}`);
      console.log(`First emails to analyze: ${firstEmails.length}`);
      console.log(`Batches created: ${result.stats.totalBatches}`);
      console.log(`Avg emails per batch: ${result.stats.avgEmailsPerBatch.toFixed(1)}`);
      console.log(`Estimated tokens: ${result.stats.estimatedTotalTokens}`);

      // Should have reasonable batch sizes
      expect(result.stats.avgEmailsPerBatch).toBeGreaterThan(10);
      expect(result.stats.avgEmailsPerBatch).toBeLessThan(50);
    });
  });
});

// Helper functions
function generateTestEmails(count: number): Message[] {
  return Array(count).fill(null).map((_, i) => ({
    id: `email_${i}`,
    thread_id: `thread_${Math.floor(i / 4)}`,  // ~4 emails per thread
    subject: `Test email ${i}`,
    body_plain: 'x'.repeat(500),
    labels: i % 10 === 0 ? ['SPAM'] : ['INBOX'],  // 10% spam
    sent_at: new Date(Date.now() - i * 3600000).toISOString()
  })) as Message[];
}

function filterSpam(emails: Message[]): Message[] {
  return emails.filter(e => {
    const gmailResult = isGmailSpam(e.labels || []);
    return !gmailResult.isSpam;
  });
}
```

## Acceptance Criteria

- [ ] Processing speed test passes (<5s for 100 emails)
- [ ] Memory usage test passes (<500MB for 1000 emails)
- [ ] Scalability test shows linear growth
- [ ] Batch optimization creates reasonable batches
- [ ] No performance regressions from current approach

## Files to Create

| File | Action |
|------|--------|
| `electron/services/__tests__/performance-benchmark.test.ts` | CREATE |

## Guardrails

- DO NOT include LLM call time in benchmarks
- Measure only local processing
- Tests must be repeatable

## Definition of Done

- [ ] Benchmarks created
- [ ] All performance targets met
- [ ] PR created targeting `int/cost-optimization`
- [ ] All Phase 4 tests pass
- [ ] `int/cost-optimization` branch is green
- [ ] Ready for SR Engineer final review before develop merge
- [ ] Final integration ready for develop merge

**Note:** Per SR Engineer review - this is the sprint completion gate. After merge, `int/cost-optimization` is ready for `develop` merge.

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [x] Approved as-is

### Branch Information
- **Branch From:** `int/cost-optimization` (after TASK-510 and TASK-511 merged)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-512-performance-benchmarks`

### Execution Classification
- **Parallel Safe:** No - depends on TASK-510 and TASK-511
- **Depends On:** TASK-510, TASK-511
- **Blocks:** None - this is the final sprint task

### Technical Notes

1. **Performance targets are reasonable:**
   - <5s for 100 emails (local processing only)
   - <10s for 600 emails (local processing only)
   - <500MB memory for 1000 emails
   - Linear scalability

2. **performance.now() usage is correct:** For measuring elapsed time in Node.js/Jest.

3. **Memory measurement approach:** `process.memoryUsage().heapUsed` is appropriate but can be noisy. Consider multiple runs and averaging.

4. **Scalability test design is good:** Testing 100, 200, 400, 800 emails to verify linear growth.

5. **Missing: Garbage collection consideration:** Force GC before memory tests for accurate measurement.

6. **Missing imports:** Test references `filterSpam`, `groupEmailsByThread`, `getFirstEmailsFromThreads`, `createBatches` but doesn't show imports.

### Risk Notes

- **Low risk:** Performance benchmarks don't modify production code.
- **CI timing variability:** Performance tests may be flaky on different CI runners. Add tolerance margins.
- **Final gate:** This is the last task before `int/cost-optimization` merges to `develop`.

### Dependencies

Confirmed: Depends on both TASK-510 and TASK-511. This is the Phase 4 sequential gate.

### Shared File Analysis
- Files created: New test file - no conflicts
- **Sprint completion gate:** After this merges, `int/cost-optimization` is ready for `develop` merge

### Recommended Changes

1. **Minor:** Add proper imports at test file top:
   ```typescript
   import { isGmailSpam, isOutlookJunk } from '../../llm/spamFilterService';
   import { groupEmailsByThread, getFirstEmailsFromThreads } from '../../llm/threadGroupingService';
   import { createBatches } from '../../llm/batchLLMService';
   ```

2. **Minor:** Add GC trigger before memory tests:
   ```typescript
   it('should not exceed 500MB for 1000 emails', async () => {
     if (global.gc) {
       global.gc(); // Run with --expose-gc flag
     }
     const initialMemory = process.memoryUsage().heapUsed;
     // ... rest of test
   });
   ```

3. **Add timing tolerance for CI:**
   ```typescript
   // CI machines may be slower, add 50% tolerance
   const CI_TOLERANCE = process.env.CI ? 1.5 : 1.0;

   expect(elapsed).toBeLessThan(5000 * CI_TOLERANCE);
   ```

4. **Add warm-up run:** First iteration is often slower due to JIT:
   ```typescript
   // Warm-up run (not measured)
   filterSpam(generateTestEmails(10));

   // Actual measurement
   const start = performance.now();
   // ...
   ```

5. **Sprint completion checklist:** Add to Definition of Done:
   - [ ] All Phase 4 tests pass
   - [ ] `int/cost-optimization` branch is green
   - [ ] Ready for SR Engineer final review before develop merge

### Post-Sprint Actions

After this task completes:
1. SR Engineer reviews `int/cost-optimization` branch holistically
2. Create PR: `int/cost-optimization` -> `develop`
3. Final CI validation
4. Merge with traditional merge (not squash)
5. Close SPRINT-007
