# Task TASK-324: Unit Tests for AI Tools & Pipeline

## Goal

Create comprehensive unit tests for all AI tools (TASK-315-319) and the hybrid extraction pipeline (TASK-320-323), ensuring reliable behavior with mocked LLM responses and verifying fallback logic.

## Non-Goals

- Do NOT implement integration tests with real LLM APIs
- Do NOT create end-to-end tests (SPRINT-006)
- Do NOT modify the implementation files
- Do NOT add new features
- Do NOT create UI tests

## Deliverables

1. New file: `electron/services/llm/tools/__tests__/analyzeMessageTool.test.ts`
2. New file: `electron/services/llm/tools/__tests__/extractContactRolesTool.test.ts`
3. New file: `electron/services/llm/tools/__tests__/clusterTransactionsTool.test.ts`
4. New file: `electron/services/llm/prompts/__tests__/prompts.test.ts`
5. New file: `electron/services/llm/__tests__/promptVersionService.test.ts`
6. New file: `electron/services/extraction/__tests__/hybridExtractorService.test.ts`
7. New file: `electron/services/extraction/__tests__/extractionStrategyService.test.ts`
8. New file: `electron/services/extraction/__tests__/confidenceAggregatorService.test.ts`
9. Update file: `electron/services/__tests__/transactionService.test.ts` (add hybrid tests)

## Acceptance Criteria

- [ ] All AI tool tests pass with mocked LLM responses
- [ ] Prompt snapshot tests detect unintended changes
- [ ] Hybrid extractor tests verify fallback behavior
- [ ] Strategy selector tests cover all decision paths
- [ ] Confidence aggregator tests verify score calculations
- [ ] Transaction service tests verify hybrid integration
- [ ] Overall test coverage for new code >70%
- [ ] All CI checks pass

## Implementation Notes

### Test Structure

```typescript
// Common test utilities for mocking LLM responses
// electron/services/llm/__tests__/testUtils.ts

import { LLMResponse, LLMMessage } from '../types';

export function createMockLLMResponse(content: string, tokens = { prompt: 100, completion: 50, total: 150 }): LLMResponse {
  return {
    content,
    tokensUsed: tokens,
    model: 'test-model',
    finishReason: 'stop',
    latencyMs: 100,
  };
}

export function createMockLLMService() {
  return {
    complete: jest.fn(),
    completeWithRetry: jest.fn(),
    validateApiKey: jest.fn().mockResolvedValue(true),
    getProvider: jest.fn().mockReturnValue('openai'),
  };
}

export const SAMPLE_RE_EMAIL = {
  subject: 'Closing Documents for 123 Main St',
  body: 'Please review the closing documents for the property at 123 Main Street, Seattle, WA 98101. The closing date is January 15, 2025. Sale price: $750,000.',
  sender: 'agent@realty.com',
  recipients: ['buyer@email.com', 'seller@email.com'],
  date: '2024-12-18T10:00:00Z',
};

export const SAMPLE_NON_RE_EMAIL = {
  subject: 'Weekly Newsletter',
  body: 'Check out our latest blog posts about technology trends.',
  sender: 'newsletter@tech.com',
  recipients: ['reader@email.com'],
  date: '2024-12-18T10:00:00Z',
};

export const SAMPLE_MESSAGE_ANALYSIS_RESPONSE = {
  isRealEstateRelated: true,
  confidence: 0.92,
  transactionIndicators: {
    type: 'purchase',
    stage: 'closing',
  },
  extractedEntities: {
    addresses: [{ value: '123 Main Street, Seattle, WA 98101', confidence: 0.95 }],
    amounts: [{ value: 750000, context: 'sale price' }],
    dates: [{ value: '2025-01-15', type: 'closing' }],
    contacts: [
      { name: 'Agent', email: 'agent@realty.com', suggestedRole: 'buyer_agent' },
    ],
  },
  reasoning: 'Email contains closing documents reference, property address, and sale price.',
};
```

### Message Analyzer Tests

```typescript
// electron/services/llm/tools/__tests__/analyzeMessageTool.test.ts

import { AnalyzeMessageTool } from '../analyzeMessageTool';
import { createMockLLMService, createMockLLMResponse, SAMPLE_RE_EMAIL, SAMPLE_MESSAGE_ANALYSIS_RESPONSE } from '../../__tests__/testUtils';

describe('AnalyzeMessageTool', () => {
  let tool: AnalyzeMessageTool;
  let mockLLMService: ReturnType<typeof createMockLLMService>;

  beforeEach(() => {
    mockLLMService = createMockLLMService();
    tool = new AnalyzeMessageTool(mockLLMService as any);
  });

  describe('analyze', () => {
    it('should return valid MessageAnalysis for RE email', async () => {
      mockLLMService.completeWithRetry.mockResolvedValue(
        createMockLLMResponse(JSON.stringify(SAMPLE_MESSAGE_ANALYSIS_RESPONSE))
      );

      const result = await tool.analyze(SAMPLE_RE_EMAIL, { provider: 'openai', apiKey: 'test', model: 'gpt-4o-mini' });

      expect(result.success).toBe(true);
      expect(result.data?.isRealEstateRelated).toBe(true);
      expect(result.data?.confidence).toBeGreaterThan(0.8);
      expect(result.data?.extractedEntities.addresses).toHaveLength(1);
    });

    it('should handle JSON wrapped in code blocks', async () => {
      const wrappedResponse = '```json\n' + JSON.stringify(SAMPLE_MESSAGE_ANALYSIS_RESPONSE) + '\n```';
      mockLLMService.completeWithRetry.mockResolvedValue(createMockLLMResponse(wrappedResponse));

      const result = await tool.analyze(SAMPLE_RE_EMAIL, { provider: 'openai', apiKey: 'test', model: 'gpt-4o-mini' });

      expect(result.success).toBe(true);
    });

    it('should return error result for malformed JSON', async () => {
      mockLLMService.completeWithRetry.mockResolvedValue(createMockLLMResponse('not valid json'));

      const result = await tool.analyze(SAMPLE_RE_EMAIL, { provider: 'openai', apiKey: 'test', model: 'gpt-4o-mini' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error result for missing required fields', async () => {
      mockLLMService.completeWithRetry.mockResolvedValue(
        createMockLLMResponse(JSON.stringify({ someOther: 'field' }))
      );

      const result = await tool.analyze(SAMPLE_RE_EMAIL, { provider: 'openai', apiKey: 'test', model: 'gpt-4o-mini' });

      expect(result.success).toBe(false);
    });

    it('should include latency in result', async () => {
      mockLLMService.completeWithRetry.mockResolvedValue(
        createMockLLMResponse(JSON.stringify(SAMPLE_MESSAGE_ANALYSIS_RESPONSE))
      );

      const result = await tool.analyze(SAMPLE_RE_EMAIL, { provider: 'openai', apiKey: 'test', model: 'gpt-4o-mini' });

      expect(result.latencyMs).toBeGreaterThan(0);
    });
  });
});
```

### Prompt Snapshot Tests

```typescript
// electron/services/llm/prompts/__tests__/prompts.test.ts

import { messageAnalysisPrompt, contactRolesPrompt, transactionClusteringPrompt } from '../index';
import { SAMPLE_RE_EMAIL } from '../../__tests__/testUtils';

describe('Prompt Templates', () => {
  describe('messageAnalysisPrompt', () => {
    it('should have stable system prompt', () => {
      expect(messageAnalysisPrompt.buildSystemPrompt()).toMatchSnapshot();
    });

    it('should build user prompt with all fields', () => {
      const userPrompt = messageAnalysisPrompt.buildUserPrompt(SAMPLE_RE_EMAIL);
      expect(userPrompt).toContain(SAMPLE_RE_EMAIL.subject);
      expect(userPrompt).toContain(SAMPLE_RE_EMAIL.sender);
      expect(userPrompt).toMatchSnapshot();
    });

    it('should have consistent hash', () => {
      const hash1 = messageAnalysisPrompt.hash;
      const hash2 = messageAnalysisPrompt.hash;
      expect(hash1).toBe(hash2);
    });

    it('should have valid version format', () => {
      expect(messageAnalysisPrompt.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('contactRolesPrompt', () => {
    it('should have stable system prompt', () => {
      expect(contactRolesPrompt.buildSystemPrompt()).toMatchSnapshot();
    });
  });

  describe('transactionClusteringPrompt', () => {
    it('should have stable system prompt', () => {
      expect(transactionClusteringPrompt.buildSystemPrompt()).toMatchSnapshot();
    });
  });
});
```

### Hybrid Extractor Tests

```typescript
// electron/services/extraction/__tests__/hybridExtractorService.test.ts

import { HybridExtractorService } from '../hybridExtractorService';
import { createMockLLMService, createMockLLMResponse, SAMPLE_MESSAGE_ANALYSIS_RESPONSE } from '../../llm/__tests__/testUtils';

describe('HybridExtractorService', () => {
  let service: HybridExtractorService;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      getConfig: jest.fn().mockResolvedValue({
        llm_enabled: true,
        openai_api_key: 'test-key',
      }),
    };
    service = new HybridExtractorService(mockConfigService);
  });

  describe('analyzeMessages', () => {
    it('should run pattern matching when useLLM is false', async () => {
      const messages = [{
        id: '1',
        subject: 'Test',
        body: 'Test body',
        sender: 'test@test.com',
        recipients: ['r@test.com'],
        date: '2024-01-01',
      }];

      const result = await service.analyzeMessages(messages, {
        usePatternMatching: true,
        useLLM: false,
      });

      expect(result[0].extractionMethod).toBe('pattern');
    });

    it('should include LLM results when useLLM is true', async () => {
      // This test would need more mocking setup
      // Simplified for template
    });
  });

  describe('extract (full pipeline)', () => {
    it('should fall back to pattern on LLM error', async () => {
      mockConfigService.getConfig.mockRejectedValue(new Error('Config error'));

      const result = await service.extract(
        [{ id: '1', subject: 'Test', body: 'closing escrow property', sender: 'a@b.com', recipients: [], date: '2024-01-01' }],
        [],
        [],
        { usePatternMatching: true, useLLM: true }
      );

      expect(result.success).toBe(true);
      expect(result.extractionMethod).toBe('pattern');
    });
  });
});
```

### Confidence Aggregator Tests

```typescript
// electron/services/extraction/__tests__/confidenceAggregatorService.test.ts

import { ConfidenceAggregatorService } from '../confidenceAggregatorService';

describe('ConfidenceAggregatorService', () => {
  let service: ConfidenceAggregatorService;

  beforeEach(() => {
    service = new ConfidenceAggregatorService();
  });

  describe('aggregate', () => {
    it('should return high confidence when both methods agree with high scores', () => {
      const result = service.aggregate(85, 0.9, true);
      expect(result.level).toBe('high');
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('should apply agreement bonus when methods agree', () => {
      const withAgreement = service.aggregate(70, 0.7, true);
      const withoutAgreement = service.aggregate(70, 0.7, false);
      expect(withAgreement.score).toBeGreaterThan(withoutAgreement.score);
    });

    it('should handle LLM only (pattern null)', () => {
      const result = service.aggregate(null, 0.8, true);
      expect(result.components.pattern).toBeNull();
      expect(result.score).toBeLessThan(0.8); // Penalty applied
    });

    it('should handle pattern only (LLM null)', () => {
      const result = service.aggregate(80, null, true);
      expect(result.components.llm).toBeNull();
      expect(result.score).toBeLessThan(0.8); // Penalty applied
    });

    it('should return low confidence when both null', () => {
      const result = service.aggregate(null, null, true);
      expect(result.level).toBe('low');
      expect(result.score).toBe(0);
    });

    it('should normalize pattern score from 0-100 to 0-1', () => {
      const result = service.aggregate(100, null, true);
      expect(result.components.pattern).toBe(1);
    });
  });

  describe('scoreToLevel', () => {
    it('should return high for scores >= 0.8', () => {
      expect(service.scoreToLevel(0.8)).toBe('high');
      expect(service.scoreToLevel(0.95)).toBe('high');
    });

    it('should return medium for scores >= 0.5 and < 0.8', () => {
      expect(service.scoreToLevel(0.5)).toBe('medium');
      expect(service.scoreToLevel(0.79)).toBe('medium');
    });

    it('should return low for scores < 0.5', () => {
      expect(service.scoreToLevel(0.49)).toBe('low');
      expect(service.scoreToLevel(0)).toBe('low');
    });
  });

  describe('meetsThreshold', () => {
    it('should return true when score meets level', () => {
      expect(service.meetsThreshold(0.85, 'high')).toBe(true);
      expect(service.meetsThreshold(0.6, 'medium')).toBe(true);
      expect(service.meetsThreshold(0.3, 'low')).toBe(true);
    });

    it('should return false when score below level', () => {
      expect(service.meetsThreshold(0.7, 'high')).toBe(false);
      expect(service.meetsThreshold(0.4, 'medium')).toBe(false);
    });
  });
});
```

### Important Details

- Create shared test utilities for mock responses
- Use Jest snapshots for prompt stability testing
- Mock all external dependencies
- Test error paths and edge cases
- Verify fallback behavior extensively

## Integration Notes

- Imports from: All TASK-315-323 implementations
- Exports: Test files (no runtime exports)
- Used by: CI pipeline
- Depends on: All implementation tasks complete

## Do / Don't

### Do:
- Create reusable mock utilities
- Use descriptive test names
- Test all error paths
- Verify fallback behavior
- Use snapshots for prompts

### Don't:
- Call real LLM APIs in tests
- Skip edge cases
- Create flaky tests
- Leave TODO comments in tests
- Test implementation details

## When to Stop and Ask

- If any implementation differs from task specifications
- If mock utilities need shared types not exported
- If coverage tools report issues
- If snapshot tests are too brittle

## Testing Expectations (MANDATORY)

### Test Coverage Requirements

| File | Minimum Coverage |
|------|-----------------|
| analyzeMessageTool.ts | 80% |
| extractContactRolesTool.ts | 80% |
| clusterTransactionsTool.ts | 80% |
| promptVersionService.ts | 90% |
| hybridExtractorService.ts | 70% |
| extractionStrategyService.ts | 90% |
| confidenceAggregatorService.ts | 95% |

### CI Requirements

This task's PR MUST pass:
- [ ] All new unit tests pass
- [ ] Existing tests still pass
- [ ] Coverage thresholds met
- [ ] Type checking
- [ ] Lint / format checks

**PRs with failing tests WILL BE REJECTED.**

## PR Preparation

- **Title**: `test(ai): add unit tests for AI tools and pipeline [TASK-324]`
- **Labels**: `test`, `ai-mvp`, `phase-2`
- **Depends on**: TASK-315-323 (all implementations)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `test`

**Estimated Totals:**
- **Turns:** 8-10
- **Tokens:** ~35K-45K
- **Time:** ~45-60m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 8 new test files | +4 |
| Files to modify | 1 file (existing tests) | +0.5 |
| Code volume | ~800 lines of tests | +3 |
| Functions/handlers | 50+ test cases | +1.5 |
| Core files touched | No | +0 |
| New patterns | Test utilities | +0.5 |
| Test complexity | Medium (mocking LLM) | +1 |
| Dependencies | All implementations | +0 |

**Confidence:** Medium

**Risk factors:**
- Implementations may differ from specifications
- Mock setup complexity
- Coverage threshold achievement

**Similar past tasks:** Comprehensive test suites (~8-12 turns)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: 2025-12-18*

### Plan-First Protocol

```
Plan Agent Invocations:
- [x] Initial plan created
- [x] Plan reviewed from Engineer perspective
- [x] Plan approved (revisions: 0)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | 1 | ~4K | 5 min |
| Revision(s) | 0 | 0 | 0 min |
| **Plan Total** | 1 | ~4K | 5 min |
```

**Plan Summary:**
Upon analysis, discovered that 8 of 9 test files were already created during TASK-315 through TASK-323 implementation. Only missing deliverable was testUtils.ts shared utilities. Plan adjusted to:
1. Verify existing tests pass and meet coverage targets
2. Create testUtils.ts with shared mock utilities and sample data
3. Run all CI checks and create PR

### Checklist

```
Files created:
- [x] electron/services/llm/__tests__/testUtils.ts (NEW - created this task)
- [x] electron/services/llm/tools/__tests__/analyzeMessageTool.test.ts (PRE-EXISTING from TASK-315)
- [x] electron/services/llm/tools/__tests__/extractContactRolesTool.test.ts (PRE-EXISTING from TASK-316)
- [x] electron/services/llm/tools/__tests__/clusterTransactionsTool.test.ts (PRE-EXISTING from TASK-317)
- [x] electron/services/llm/prompts/__tests__/prompts.test.ts (PRE-EXISTING from TASK-318)
- [x] electron/services/llm/__tests__/promptVersionService.test.ts (PRE-EXISTING from TASK-319)
- [x] electron/services/extraction/__tests__/hybridExtractorService.test.ts (PRE-EXISTING from TASK-320)
- [x] electron/services/extraction/__tests__/extractionStrategyService.test.ts (PRE-EXISTING from TASK-321)
- [x] electron/services/extraction/__tests__/confidenceAggregatorService.test.ts (PRE-EXISTING from TASK-322)

Files modified:
- [x] electron/services/__tests__/transactionService.additional.test.ts (PRE-EXISTING from TASK-323)

Verification:
- [x] npm run type-check passes
- [x] npm run lint passes (0 errors, warnings only)
- [x] npm test passes (271 tests, 100% pass rate)
- [x] Coverage thresholds met (all targets exceeded)
```

### Coverage Results

| File | Target | Actual | Status |
|------|--------|--------|--------|
| analyzeMessageTool.ts | 80% | 83.33% | PASS |
| extractContactRolesTool.ts | 80% | 98% | PASS |
| clusterTransactionsTool.ts | 80% | 93.93% | PASS |
| promptVersionService.ts | 90% | 100% | PASS |
| hybridExtractorService.ts | 70% | 87.43% | PASS |
| extractionStrategyService.ts | 90% | 96.92% | PASS |
| confidenceAggregatorService.ts | 95% | 100% | PASS |
| **Overall** | 70% | 91.91% | PASS |

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | 1 | ~4K | 5 min |
| Implementation (Impl) | 2 | ~8K | 15 min |
| Debugging (Debug) | 1 | ~4K | 5 min |
| **Engineer Total** | 4 | ~16K | 25 min |
```

### Notes

**Planning notes:**
Analysis revealed that the test files specified in this task were already created during the implementation of TASK-315 through TASK-323. Each implementation task included its own unit tests with comprehensive coverage. The only missing component was the testUtils.ts shared utility file.

**Deviations from plan:**
DEVIATION: Most test files were not created in this task - they already existed from prior tasks. This task was effectively a verification and consolidation task rather than a creation task. Created only testUtils.ts as the missing deliverable.

**Design decisions:**
1. Created testUtils.ts with MockLLMService class, factory functions, and sample data
2. Included comprehensive sample responses for MessageAnalysis, ContactRoleExtraction, and ClusterTransactionsOutput
3. Added helper functions like wrapInCodeBlock(), createMalformedJSON(), and createAnalyzedMessage() for common test patterns
4. Maintained backward compatibility - existing tests continue to work with their inline mocks

**Issues encountered:**
1. TypeScript error in initial testUtils.ts - used wrong property name (messageIds vs communicationIds). Fixed by checking the TransactionCluster type definition.
2. No other issues - all tests were already passing with good coverage.

**Reviewer notes:**
1. All 271 tests pass with 91.91% statement coverage
2. The testUtils.ts provides reusable utilities but existing tests are not yet refactored to use it (could be a future enhancement)
3. Coverage exceeds all targets significantly - code is well tested

### Estimate vs Actual Analysis

**REQUIRED: Compare PM estimates to actuals to improve future predictions.**

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 8 | 1 | -7 | 7 test files already existed from implementation tasks |
| Files to modify | 1 | 0 | -1 | transactionService.additional.test.ts already had hybrid tests |
| Code volume | ~800 lines | ~290 lines | -510 | Only created testUtils.ts; existing tests were comprehensive |
| Test cases | 50+ | 271 | +221 | Tests from all prior tasks combined; much more comprehensive than expected |
| Core files touched | No | No | - | - |
| New patterns | Yes | Yes | - | testUtils.ts introduces shared test utilities |
| Test complexity | Medium | Low | - | Only verification and one utility file creation |

**Total Variance:** Est 8-10 turns -> Actual 4 turns (60% under estimate)

**Root cause of variance:**
The tests specified in TASK-324 were already created as part of their respective implementation tasks (TASK-315 through TASK-323). Each implementation PR included unit tests, making this task primarily a verification task.

**Suggestion for similar tasks:**
For future "add unit tests" tasks: (1) Check if tests were already created during implementation tasks, (2) If implementation tasks include their own tests, the separate test task should be reduced to "verify coverage and create shared utilities" rather than "create all tests".

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** int/hybrid-pipeline (after TASK-323 merged)
- **Branch Into:** int/hybrid-pipeline
- **Suggested Branch Name:** feature/TASK-324-ai-unit-tests

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-315-323 (all implementations must be complete)
- **Blocks:** None (final task before int/hybrid-pipeline -> develop merge)

### Shared File Analysis
- Files created:
  - `electron/services/llm/__tests__/testUtils.ts` (new)
  - `electron/services/llm/tools/__tests__/analyzeMessageTool.test.ts` (new)
  - `electron/services/llm/tools/__tests__/extractContactRolesTool.test.ts` (new)
  - `electron/services/llm/tools/__tests__/clusterTransactionsTool.test.ts` (new)
  - `electron/services/llm/prompts/__tests__/prompts.test.ts` (new)
  - `electron/services/llm/__tests__/promptVersionService.test.ts` (new)
  - `electron/services/extraction/__tests__/hybridExtractorService.test.ts` (new)
  - `electron/services/extraction/__tests__/extractionStrategyService.test.ts` (new)
  - `electron/services/extraction/__tests__/confidenceAggregatorService.test.ts` (new)
- Files modified:
  - `electron/services/__tests__/transactionService.test.ts` (add hybrid tests)
- Conflicts with: None (test files only)
- **Resolution:** N/A - sequential task

### Technical Considerations
- Coverage thresholds are reasonable (70-95% depending on complexity)
- Shared test utilities (testUtils.ts) will help consistency
- Snapshot tests for prompts are critical for stability
- Mocking LLM responses avoids API costs in CI
- No implementation changes - test-only task
- Tests must not be flaky

### Quality Gate
- This task is the final quality gate before Phase 2 merges to develop
- All coverage thresholds must be met
- All tests must be deterministic (no flaky tests)
- CI must pass completely before merge

### Additional Notes
- Most files created, but straightforward test patterns
- 8-10 turns is reasonable given the breadth of coverage
- Consider adding test coverage report to PR

---

## SR Engineer Review (SR-Owned)

**REQUIRED: SR Engineer MUST complete this section when reviewing/merging the PR.**

*Review Date: <DATE>*

### SR Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | X | ~XK | X min |
| Feedback/Revisions | X | ~XK | X min |
| **SR Total** | X | ~XK | X min |
```

### Review Summary

**Architecture Compliance:** PASS / FAIL
**Security Review:** PASS / FAIL / N/A
**Test Coverage:** Adequate / Needs Improvement

**Review Notes:**
<Key observations, concerns addressed, approval rationale>

### Merge Information

**PR Number:** #XXX
**Merge Commit:** <hash>
**Merged To:** int/hybrid-pipeline
