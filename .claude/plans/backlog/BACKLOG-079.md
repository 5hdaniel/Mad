# BACKLOG-079: AI MVP Phase 6 - Integration Testing

**Priority:** Medium
**Type:** Testing / QA
**Sprint:** SPRINT-006
**Estimated Effort:** 13 turns (~1.5h)
**Dependencies:** BACKLOG-078 (UI Enhancements)

---

## Description

Comprehensive integration and E2E testing for the AI Transaction Auto-Detection MVP. This phase ensures all components work together and handles failure scenarios gracefully.

---

## Tasks

### I01: Integration Tests for LLM Pipeline
**Estimated:** 5 turns
**File:** `electron/services/__tests__/hybridExtractor.test.ts`

Test the full hybrid extraction pipeline:
- Pattern → LLM fallback behavior
- Confidence aggregation with real scenarios
- Budget enforcement blocking requests
- Strategy selection logic

**Test Scenarios:**
```typescript
describe('HybridExtractor Integration', () => {
  it('falls back to pattern when LLM unavailable');
  it('uses LLM when budget available');
  it('blocks LLM when budget exceeded');
  it('merges pattern + LLM results correctly');
  it('handles LLM timeout gracefully');
  it('tracks usage after successful call');
});
```

**Acceptance Criteria:**
- [ ] All fallback scenarios tested
- [ ] Budget enforcement verified
- [ ] Usage tracking confirmed
- [ ] Error handling covered

### I02: Integration Tests for Feedback Loop
**Estimated:** 3 turns
**File:** `electron/services/__tests__/feedbackService.test.ts`

Test feedback recording and learning:
- Feedback saves correctly with all fields
- Stats calculation returns accurate values
- Learning service identifies patterns
- Feedback types properly categorized

**Test Scenarios:**
```typescript
describe('Feedback Integration', () => {
  it('records transaction approval with corrections');
  it('records transaction rejection with reason');
  it('records role correction with evidence');
  it('calculates accuracy by provider');
  it('identifies systematic errors');
});
```

**Acceptance Criteria:**
- [ ] All feedback types tested
- [ ] Stats calculation verified
- [ ] Pattern detection works

### I03: E2E Test for Auto-Detection Flow
**Estimated:** 3 turns
**File:** `tests/e2e/autoDetection.test.ts`

Full flow test from import to confirmation:

1. Import emails (mock or test data)
2. Run detection (hybrid extraction)
3. Review detected transaction in UI
4. Confirm with edits
5. Verify feedback recorded
6. Verify transaction status updated

**Test Scenarios:**
```typescript
describe('Auto-Detection E2E', () => {
  it('detects transaction from email batch');
  it('shows detected transaction in pending review');
  it('allows user to confirm transaction');
  it('allows user to edit before confirming');
  it('allows user to reject with reason');
  it('records feedback for all actions');
});
```

**Acceptance Criteria:**
- [ ] Full flow works end-to-end
- [ ] UI reflects detection status
- [ ] Feedback recorded correctly
- [ ] Transaction status updates

### T04: E2E Failure Scenario Tests
**Estimated:** 2 turns
**File:** `tests/e2e/llmFailures.test.ts`

Test error handling paths:

**Scenarios:**
```typescript
describe('LLM Failure Handling', () => {
  it('handles API timeout gracefully');
  it('shows error when API key invalid');
  it('shows rate limit exceeded message');
  it('falls back to pattern on malformed response');
  it('retries on transient failure');
  it('displays fallback notification to user');
});
```

**Acceptance Criteria:**
- [ ] Timeout shows user-friendly error
- [ ] Invalid key links to settings
- [ ] Rate limit shows remaining time
- [ ] Malformed response triggers fallback
- [ ] Retry logic works for transient errors

---

## Test Data

### Mock Emails for Testing
Create test fixtures with real estate scenarios:

```typescript
// tests/fixtures/realEstateEmails.ts
export const mockEmails = {
  purchaseOffer: {
    subject: 'RE: Offer on 123 Main St',
    body: 'Please find attached the offer for $450,000...',
    sender: 'buyer.agent@realty.com',
    // ...
  },
  closingNotice: {
    subject: 'Closing Scheduled - 456 Oak Ave',
    body: 'Closing is scheduled for December 20th...',
    sender: 'escrow@titleco.com',
    // ...
  },
  // ... more scenarios
};
```

### Mock LLM Responses
```typescript
// tests/mocks/llmResponses.ts
export const mockAnalysisResponse = {
  isRealEstateRelated: true,
  confidence: 0.92,
  transactionIndicators: {
    type: 'purchase',
    stage: 'pending',
  },
  extractedEntities: {
    addresses: [{ value: '123 Main St', confidence: 0.95 }],
    // ...
  },
};
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/services/__tests__/hybridExtractor.test.ts` | Pipeline integration tests |
| `electron/services/__tests__/feedbackService.test.ts` | Feedback integration tests |
| `tests/e2e/autoDetection.test.ts` | Full E2E flow test |
| `tests/e2e/llmFailures.test.ts` | Failure scenario tests |
| `tests/fixtures/realEstateEmails.ts` | Test email data |
| `tests/mocks/llmResponses.ts` | Mock LLM responses |

---

## Quality Gate: Feature Complete

Before marking AI MVP complete, verify:

### Functional Requirements
- [ ] Detection works on real email data
- [ ] Confirmation flow is intuitive
- [ ] Feedback is recorded accurately
- [ ] Fallback to pattern matching works

### Performance Requirements
- [ ] < 5 seconds for 100 emails
- [ ] UI remains responsive during analysis
- [ ] No memory leaks in long sessions

### Security Requirements
- [ ] API keys never logged or exposed
- [ ] Content sanitization working
- [ ] Consent required before first LLM call

### Reliability Requirements
- [ ] Graceful degradation on LLM failure
- [ ] No data loss on errors
- [ ] Clear error messages for users

---

## Success Metrics Verification

| Metric | Target | Test Method |
|--------|--------|-------------|
| Detection Accuracy | >80% | Sample 50 emails, measure confirmed/(confirmed+rejected) |
| User Confirmation Rate | >70% | Track via feedback stats |
| Avg Corrections/Transaction | <3 | Calculate from feedback data |
| Fallback Rate | <10% | Monitor pattern_only / total_detections |
| Cost per Transaction | <$0.05 | Calculate tokens * rate / transactions |

---

## Launch Checklist

Before declaring AI MVP ready for beta:

### Technical
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Performance benchmarks met
- [ ] Security review completed

### Documentation
- [ ] User guide for AI features
- [ ] API key setup instructions
- [ ] Troubleshooting guide

### Monitoring
- [ ] Usage tracking dashboard
- [ ] Error rate monitoring
- [ ] Accuracy metrics visible

---

## Metrics Tracking

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | - | - | - |
| PR Review | - | - | - |
| Debugging/Fixes | - | - | - |
| **Total** | - | - | - |

*Fill in after completion*
