# TASK-510: Accuracy Testing Suite

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Create tests to validate that optimized pipeline maintains detection accuracy compared to per-email analysis.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-085
- **Phase**: 4 (Validation)
- **Dependencies**: TASK-509 (Phase 3 complete)
- **Estimated Turns**: 15

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-510-accuracy-testing
```

## Technical Specification

### Accuracy Test Suite

**File:** `electron/services/__tests__/extraction-accuracy.test.ts` (NEW)

```typescript
describe('Extraction Pipeline Accuracy', () => {
  const testDataset = loadTestEmailDataset();  // 100+ emails with known labels

  describe('Spam Filter Accuracy', () => {
    it('should not filter any transaction emails as spam', async () => {
      const transactionEmails = testDataset.filter(e => e.label === 'transaction');
      const filtered = transactionEmails.filter(e => isSpam(e));

      expect(filtered.length).toBe(0);  // 0% false positives
    });

    it('should filter known spam emails', async () => {
      const spamEmails = testDataset.filter(e => e.label === 'spam');
      const filtered = spamEmails.filter(e => isSpam(e));

      expect(filtered.length / spamEmails.length).toBeGreaterThan(0.9);  // >90%
    });
  });

  describe('Thread Propagation Accuracy', () => {
    it('should detect transaction in first email of thread', async () => {
      const transactionThreads = testDataset
        .filter(e => e.label === 'transaction')
        .reduce((acc, e) => {
          if (!acc[e.thread_id]) acc[e.thread_id] = [];
          acc[e.thread_id].push(e);
          return acc;
        }, {});

      for (const [threadId, emails] of Object.entries(transactionThreads)) {
        const sorted = emails.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
        const firstEmail = sorted[0];

        // First email should indicate transaction
        expect(firstEmail.containsTransactionIndicators).toBe(true);
      }
    });
  });

  describe('Overall Detection Accuracy', () => {
    it('should match baseline accuracy within 5%', async () => {
      // Run baseline (per-email)
      const baselineResults = await runBaselineAnalysis(testDataset);

      // Run optimized
      const optimizedResults = await runOptimizedAnalysis(testDataset);

      // Compare
      const baselineTransactions = baselineResults.filter(r => r.isTransaction);
      const optimizedTransactions = optimizedResults.filter(r => r.isTransaction);

      const matchRate = calculateMatchRate(baselineTransactions, optimizedTransactions);

      expect(matchRate).toBeGreaterThan(0.95);  // >95% match
    });

    it('should not miss more than 2% of transactions', async () => {
      const knownTransactions = testDataset.filter(e => e.label === 'transaction');
      const optimizedResults = await runOptimizedAnalysis(testDataset);
      const detected = optimizedResults.filter(r => r.isTransaction);

      const falseNegativeRate = 1 - (detected.length / knownTransactions.length);

      expect(falseNegativeRate).toBeLessThan(0.02);  // <2% missed
    });
  });
});
```

### Helper Functions (Per SR Engineer Review)

**File:** `electron/services/__tests__/fixtures/accuracy-test-helpers.ts`

```typescript
import testEmails from './accuracy-test-emails.json';
import { isGmailSpam } from '../../llm/spamFilterService';
import { HybridExtractorService } from '../../extraction/hybridExtractorService';

export interface TestEmail {
  id: string;
  thread_id: string;
  subject: string;
  body: string;
  labels: string[];
  sent_at: string;
  label: 'transaction' | 'spam' | 'normal';
  expected: {
    isTransaction: boolean;
    transactionType?: string;
    shouldBeSpam: boolean;
    containsTransactionIndicators: boolean;
  };
}

export function loadTestEmailDataset(): TestEmail[] {
  return testEmails.emails as TestEmail[];
}

export function isSpam(email: TestEmail): boolean {
  const result = isGmailSpam(email.labels || []);
  return result.isSpam;
}

export async function runBaselineAnalysis(emails: TestEmail[]): Promise<AnalysisResult[]> {
  // Individual analysis (no batching/threading)
  // Use mocked LLM for determinism - see beforeEach in test file
  const service = new HybridExtractorService();
  return service.analyzeMessages(emails.map(e => ({
    id: e.id,
    subject: e.subject,
    body: e.body,
    sender: '',
    recipients: [],
    date: e.sent_at
  })));
}

export async function runOptimizedAnalysis(emails: TestEmail[]): Promise<AnalysisResult[]> {
  // Full optimized pipeline with mocked LLM
  const service = new HybridExtractorService();
  const result = await service.analyzeMessagesOptimized(emails.map(e => ({
    id: e.id,
    subject: e.subject,
    body: e.body,
    sender: '',
    recipients: [],
    date: e.sent_at,
    labels: e.labels
  })));
  return result.results;
}

export function calculateMatchRate(baseline: AnalysisResult[], optimized: AnalysisResult[]): number {
  const baselineIds = new Set(baseline.filter(r => r.isTransaction).map(r => r.emailId));
  const optimizedIds = new Set(optimized.filter(r => r.isTransaction).map(r => r.emailId));

  let matches = 0;
  for (const id of baselineIds) {
    if (optimizedIds.has(id)) matches++;
  }

  return baselineIds.size > 0 ? matches / baselineIds.size : 1;
}
```

### Test Data Requirements

Create fixture file with labeled emails:

**File:** `electron/services/__tests__/fixtures/accuracy-test-emails.json`

```json
{
  "emails": [
    {
      "id": "test_1",
      "thread_id": "thread_1",
      "subject": "Closing documents for 123 Main St",
      "body": "...",
      "labels": ["INBOX"],
      "sent_at": "2024-01-01T10:00:00Z",
      "expected": {
        "isTransaction": true,
        "transactionType": "purchase"
      }
    }
  ],
  "metadata": {
    "totalEmails": 100,
    "transactionEmails": 40,
    "spamEmails": 15,
    "threads": 50
  }
}
```

## Acceptance Criteria

- [ ] Test dataset created (100+ labeled emails)
- [ ] Spam filter false positive test passes (0%)
- [ ] Thread propagation test passes
- [ ] Overall accuracy test passes (>95% match)
- [ ] False negative rate test passes (<2%)
- [ ] Tests run in CI

## Files to Create

| File | Action |
|------|--------|
| `electron/services/extraction/__tests__/extraction-accuracy.test.ts` | CREATE |
| `electron/services/__tests__/fixtures/accuracy-test-emails.json` | CREATE |
| `electron/services/__tests__/fixtures/accuracy-test-helpers.ts` | CREATE |

**Note:** Per SR Engineer review:
- Test file moved to `extraction/__tests__/` to match service location
- Helper functions file added for `loadTestEmailDataset()`, `isSpam()`, etc.
- Mock LLM responses required for deterministic tests

## Guardrails

- DO NOT modify pipeline code
- Use REAL email patterns (anonymized)
- Tests must be deterministic

## Definition of Done

- [ ] Test suite created
- [ ] Tests passing
- [ ] Accuracy metrics documented
- [ ] PR created targeting `int/cost-optimization`

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [ ] Approved as-is
- [x] Approved with minor changes
- [ ] Needs revision

### Branch Information
- **Branch From:** `int/cost-optimization` (after Phase 3 complete)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-510-accuracy-testing`

### Execution Classification
- **Parallel Safe:** Yes - can run in parallel with TASK-511
- **Depends On:** TASK-509 (Phase 3 complete)
- **Blocks:** TASK-512

### Technical Notes

1. **Test dataset creation is significant work:** Creating 100+ labeled emails with realistic content is non-trivial. Consider:
   - Using anonymized real emails from test accounts
   - Generating synthetic emails with known patterns
   - Documenting the labeling methodology

2. **Helper function imports needed:** The test references `loadTestEmailDataset()`, `isSpam()`, `runBaselineAnalysis()`, `runOptimizedAnalysis()`, `calculateMatchRate()` - these need to be created/imported.

3. **Thread propagation test assumption:** The test assumes `firstEmail.containsTransactionIndicators` exists, but this is a derived property that needs to be computed.

4. **Test isolation concern:** Tests that call `runOptimizedAnalysis()` will need mock LLM responses to be deterministic and fast.

5. **Fixture file format is good:** The JSON structure in `accuracy-test-emails.json` is well-designed.

6. **Coverage expectations are reasonable:** >95% match rate and <2% false negative rate are achievable targets.

### Risk Notes

- **Medium risk:** Test creation is time-consuming and requires domain knowledge.
- **Determinism concern:** Tests must not depend on actual LLM calls to be reliable in CI.
- **Fixture maintenance:** Test emails need updating if detection logic changes.

### Dependencies

Confirmed: Can run in parallel with TASK-511. Both depend on TASK-509.

### Shared File Analysis
- Files created: New test files - no conflicts with TASK-511
- Both TASK-510 and TASK-511 can run in parallel as they create different test files

### Recommended Changes

1. **Critical:** Add helper functions file `electron/services/__tests__/fixtures/accuracy-test-helpers.ts`:

   ```typescript
   import testEmails from './accuracy-test-emails.json';

   export function loadTestEmailDataset(): TestEmail[] {
     return testEmails.emails;
   }

   export function isSpam(email: TestEmail): boolean {
     // Use the spam filter service
     const result = isGmailSpam(email.labels || []);
     return result.isSpam;
   }

   export async function runBaselineAnalysis(emails: TestEmail[]): Promise<AnalysisResult[]> {
     // Individual analysis (no batching/threading)
     // Use mocked LLM for determinism
   }

   export async function runOptimizedAnalysis(emails: TestEmail[]): Promise<AnalysisResult[]> {
     // Full optimized pipeline
     // Use mocked LLM for determinism
   }

   export function calculateMatchRate(baseline: AnalysisResult[], optimized: AnalysisResult[]): number {
     // Compare transaction detection results
   }
   ```

2. **Mock LLM for determinism:** Add mock responses to avoid flaky tests:
   ```typescript
   jest.mock('../llm/anthropicService');
   jest.mock('../llm/openAIService');

   beforeEach(() => {
     // Return predetermined responses based on email content
   });
   ```

3. **Fixture enhancement:** Add more metadata to test emails:
   ```json
   {
     "id": "test_1",
     "expected": {
       "isTransaction": true,
       "transactionType": "purchase",
       "shouldBeSpam": false,
       "containsTransactionIndicators": true
     }
   }
   ```

4. **Test file location:** Consider `electron/services/extraction/__tests__/` to match the service location
