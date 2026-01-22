# Task TASK-411: Hybrid Extraction Integration Tests

## Goal

Create comprehensive integration tests for the hybrid extraction pipeline, testing fallback behavior, confidence aggregation, budget enforcement, and strategy selection.

## Non-Goals

- Do NOT test UI components
- Do NOT test with real LLM APIs
- Do NOT modify implementation code

## Deliverables

1. New file: `electron/services/__tests__/hybridExtractor.integration.test.ts`
2. New file: `tests/fixtures/realEstateEmails.ts`
3. New file: `tests/mocks/llmResponses.ts`

## Acceptance Criteria

- [ ] Test pattern → LLM fallback behavior
- [ ] Test confidence aggregation with real scenarios
- [ ] Test budget enforcement blocking requests
- [ ] Test strategy selection logic
- [ ] Test LLM timeout handling
- [ ] Test usage tracking
- [ ] All CI checks pass

## Implementation Notes

```typescript
// electron/services/__tests__/hybridExtractor.integration.test.ts
import { HybridExtractorService } from '../extraction/hybridExtractorService';
import { mockEmails, mockLLMResponses } from '../../../tests/fixtures';

describe('HybridExtractor Integration', () => {
  let service: HybridExtractorService;

  beforeEach(() => {
    service = new HybridExtractorService(mockConfigService);
  });

  it('falls back to pattern when LLM unavailable', async () => {
    mockConfigService.getConfig.mockResolvedValue({ llm_enabled: false });
    const result = await service.extract(mockEmails.realEstate, [], []);
    expect(result.extractionMethod).toBe('pattern');
    expect(result.llmUsed).toBe(false);
  });

  it('uses LLM when budget available', async () => {
    mockConfigService.getConfig.mockResolvedValue({
      llm_enabled: true,
      openai_api_key: 'test-key',
      budget_limit_tokens: 100000,
      tokens_used_this_month: 0,
    });
    const result = await service.extract(mockEmails.realEstate, [], []);
    expect(result.extractionMethod).toBe('hybrid');
    expect(result.llmUsed).toBe(true);
  });

  it('blocks LLM when budget exceeded', async () => {
    mockConfigService.getConfig.mockResolvedValue({
      llm_enabled: true,
      budget_limit_tokens: 1000,
      tokens_used_this_month: 999,
    });
    const result = await service.extract(mockEmails.realEstate, [], []);
    expect(result.extractionMethod).toBe('pattern');
  });

  it('merges pattern + LLM results correctly', async () => {
    // Test confidence aggregation
  });

  it('handles LLM timeout gracefully', async () => {
    mockLLMService.complete.mockRejectedValue(new Error('Timeout'));
    const result = await service.extract(mockEmails.realEstate, [], []);
    expect(result.success).toBe(true);
    expect(result.extractionMethod).toBe('pattern');
  });

  it('tracks usage after successful call', async () => {
    // Verify token usage recorded
  });
});
```

```typescript
// tests/fixtures/realEstateEmails.ts
export const mockEmails = {
  realEstate: [{
    id: '1',
    subject: 'RE: Offer on 123 Main St',
    body: 'Please find attached the offer for $450,000...',
    sender: 'buyer.agent@realty.com',
    recipients: ['seller@email.com'],
    date: '2024-12-18T10:00:00Z',
  }],
  nonRealEstate: [{
    id: '2',
    subject: 'Weekly Newsletter',
    body: 'Check out our latest blog posts...',
    sender: 'newsletter@tech.com',
    recipients: ['reader@email.com'],
    date: '2024-12-18T10:00:00Z',
  }],
};
```

## Integration Notes

- Imports from: All extraction services from SPRINT-005
- Used by: CI pipeline
- Depends on: Phase 2 complete

## Testing Expectations (MANDATORY)

### Coverage
- Target 70%+ coverage on hybrid extraction path

### CI Requirements
- [ ] All integration tests pass
- [ ] No flaky tests

## PR Preparation

- **Title**: `test(extraction): add hybrid extraction integration tests [TASK-411]`
- **Labels**: `test`, `ai-mvp`, `phase-3`
- **Depends on**: Phase 2 complete

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `test`
**Estimated Totals:** 5 turns, ~20K tokens, ~30m
**Confidence:** Medium

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after Phase 2)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-411-hybrid-integration-tests

### Execution Classification
- **Parallel Safe:** Yes (with TASK-412)
- **Depends On:** Phase 2 complete
- **Blocks:** TASK-413

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer*
