# Task TASK-412: Feedback Loop Integration Tests

## Goal

Create integration tests for the feedback recording and learning system, verifying correct storage, stats calculation, and pattern detection.

## Non-Goals

- Do NOT test UI components
- Do NOT modify implementation code
- Do NOT test individual unit functions

## Deliverables

1. New file: `electron/services/__tests__/feedbackService.integration.test.ts`

## Acceptance Criteria

- [ ] Test feedback saves correctly with all fields
- [ ] Test stats calculation returns accurate values
- [ ] Test learning service identifies patterns
- [ ] Test feedback types properly categorized
- [ ] Test accuracy calculation by provider
- [ ] All CI checks pass

## Implementation Notes

```typescript
// electron/services/__tests__/feedbackService.integration.test.ts
describe('Feedback Integration', () => {
  let feedbackService: FeedbackService;
  let learningService: FeedbackLearningService;

  beforeEach(async () => {
    // Setup test database
    feedbackService = getFeedbackService();
    learningService = getFeedbackLearningService();
  });

  it('records transaction approval with corrections', async () => {
    await feedbackService.recordTransactionFeedback('user1', {
      detectedTransactionId: 'tx1',
      action: 'confirm',
      corrections: { propertyAddress: '123 Main St' },
      modelVersion: 'gpt-4o-mini',
    });

    const stats = await feedbackService.getFeedbackStats('user1');
    expect(stats.transactionEdits).toBe(1);
  });

  it('records transaction rejection with reason', async () => {
    await feedbackService.recordTransactionFeedback('user1', {
      detectedTransactionId: 'tx2',
      action: 'reject',
      corrections: { reason: 'Not a real estate transaction' },
    });

    const stats = await feedbackService.getFeedbackStats('user1');
    expect(stats.transactionRejections).toBe(1);
  });

  it('records role correction with evidence', async () => {
    await feedbackService.recordRoleFeedback('user1', {
      transactionId: 'tx1',
      contactId: 'contact1',
      originalRole: 'buyer_agent',
      correctedRole: 'seller_agent',
    });

    const stats = await feedbackService.getFeedbackStats('user1');
    expect(stats.roleCorrections).toBe(1);
  });

  it('calculates accuracy by provider', async () => {
    // Record multiple feedback items with different providers
    await feedbackService.recordTransactionFeedback('user1', {
      detectedTransactionId: 'tx1',
      action: 'confirm',
      modelVersion: 'openai:gpt-4o-mini',
    });
    await feedbackService.recordTransactionFeedback('user1', {
      detectedTransactionId: 'tx2',
      action: 'reject',
      modelVersion: 'anthropic:claude-3-haiku',
    });

    const analysis = await learningService.getLLMFeedbackAnalysis('user1');
    expect(analysis.accuracyByProvider['openai:gpt-4o-mini'].rate).toBe(1);
    expect(analysis.accuracyByProvider['anthropic:claude-3-haiku'].rate).toBe(0);
  });

  it('identifies systematic errors', async () => {
    // Record multiple rejections with same reason
    for (let i = 0; i < 5; i++) {
      await feedbackService.recordTransactionFeedback('user1', {
        detectedTransactionId: `tx${i}`,
        action: 'reject',
        corrections: { reason: 'Escrow officer emails misclassified' },
      });
    }

    const analysis = await learningService.getLLMFeedbackAnalysis('user1');
    expect(analysis.systematicErrors.length).toBeGreaterThan(0);
    expect(analysis.systematicErrors[0].pattern).toContain('Escrow');
  });
});
```

## Integration Notes

- Imports from: `feedbackService.ts`, `feedbackLearningService.ts`
- Used by: CI pipeline
- Depends on: Phase 2 complete (TASK-401-403 merged)

## Testing Expectations (MANDATORY)

### Coverage
- Target 80%+ coverage on feedback services

### CI Requirements
- [ ] All integration tests pass
- [ ] No flaky tests

## PR Preparation

- **Title**: `test(feedback): add feedback loop integration tests [TASK-412]`
- **Labels**: `test`, `ai-mvp`, `phase-3`
- **Depends on**: Phase 2 complete

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `test`
**Estimated Totals:** 3 turns, ~12K tokens, ~20m
**Confidence:** High

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after Phase 2)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-412-feedback-integration-tests

### Execution Classification
- **Parallel Safe:** Yes (with TASK-411)
- **Depends On:** Phase 2 complete
- **Blocks:** TASK-413

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer*
