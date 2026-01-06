# Task TASK-413: E2E Auto-Detection Flow Test

## Goal

Create end-to-end test for the complete auto-detection flow: email import → detection → review → confirmation, verifying the entire user journey.

## Non-Goals

- Do NOT test failure scenarios (TASK-414)
- Do NOT test with real LLM APIs
- Do NOT modify implementation code

## Deliverables

1. New file: `tests/e2e/autoDetection.test.ts`

## Acceptance Criteria

- [ ] Test detects transaction from email batch
- [ ] Test shows detected transaction in pending review
- [ ] Test allows user to confirm transaction
- [ ] Test allows user to edit before confirming
- [ ] Test allows user to reject with reason
- [ ] Test records feedback for all actions
- [ ] All CI checks pass

## Implementation Notes

```typescript
// tests/e2e/autoDetection.test.ts
import { test, expect } from '@playwright/test';

test.describe('Auto-Detection E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: login, mock LLM responses
    await page.goto('/');
    await setupMockLLM(page);
    await login(page, testUser);
  });

  test('detects transaction from email batch', async ({ page }) => {
    // Import test emails
    await importEmails(page, mockRealEstateEmails);

    // Trigger scan
    await page.click('[data-testid="scan-button"]');

    // Wait for detection
    await expect(page.locator('.transaction-card')).toBeVisible();
    await expect(page.locator('.badge-ai')).toBeVisible();
  });

  test('shows detected transaction in pending review', async ({ page }) => {
    await importAndScan(page, mockRealEstateEmails);

    // Check pending filter
    await page.click('[data-testid="filter-pending"]');
    await expect(page.locator('.transaction-card')).toHaveCount(1);
    await expect(page.locator('.badge-warning')).toContainText('Pending Review');
  });

  test('allows user to confirm transaction', async ({ page }) => {
    await importAndScan(page, mockRealEstateEmails);

    // Click approve
    await page.click('[data-testid="btn-approve"]');

    // Verify status changed
    await expect(page.locator('.badge-warning')).not.toBeVisible();

    // Verify feedback recorded
    const feedback = await getFeedback(page, 'transaction');
    expect(feedback).toContainEqual(expect.objectContaining({
      feedback_type: 'transaction_approved',
    }));
  });

  test('allows user to edit before confirming', async ({ page }) => {
    await importAndScan(page, mockRealEstateEmails);

    // Click edit
    await page.click('[data-testid="btn-edit"]');

    // Verify modal opens with pre-filled data
    await expect(page.locator('.audit-modal')).toBeVisible();
    await expect(page.locator('[name="propertyAddress"]')).toHaveValue('123 Main St');

    // Make changes and save
    await page.fill('[name="propertyAddress"]', '456 Oak Ave');
    await page.click('[data-testid="save-transaction"]');

    // Verify feedback recorded with corrections
    const feedback = await getFeedback(page, 'transaction');
    expect(feedback).toContainEqual(expect.objectContaining({
      feedback_type: 'transaction_edited',
    }));
  });

  test('allows user to reject with reason', async ({ page }) => {
    await importAndScan(page, mockRealEstateEmails);

    // Click reject
    await page.click('[data-testid="btn-reject"]');

    // Enter reason in modal
    await expect(page.locator('.reject-modal')).toBeVisible();
    await page.fill('[name="rejectReason"]', 'Not a real estate transaction');
    await page.click('[data-testid="confirm-reject"]');

    // Verify status changed
    await page.click('[data-testid="filter-rejected"]');
    await expect(page.locator('.transaction-card')).toHaveCount(1);

    // Verify feedback recorded
    const feedback = await getFeedback(page, 'transaction');
    expect(feedback).toContainEqual(expect.objectContaining({
      feedback_type: 'transaction_rejected',
    }));
  });

  test('records feedback for all actions', async ({ page }) => {
    await importAndScan(page, mockRealEstateEmails);

    // Perform multiple actions
    await page.click('[data-testid="btn-approve"]');

    // Verify feedback recorded with model version
    const feedback = await getFeedback(page, 'transaction');
    expect(feedback[0]).toHaveProperty('model_version');
    expect(feedback[0]).toHaveProperty('prompt_version');
  });
});

// Helper functions
async function importAndScan(page, emails) {
  await importEmails(page, emails);
  await page.click('[data-testid="scan-button"]');
  await page.waitForSelector('.transaction-card');
}

async function getFeedback(page, type) {
  return await page.evaluate(async (t) => {
    return await window.api.feedback.getAll(t);
  }, type);
}
```

## Integration Notes

- Imports from: Playwright test framework
- Used by: CI pipeline
- Depends on: TASK-411, TASK-412

## Testing Expectations (MANDATORY)

### E2E Requirements
- Tests must be deterministic
- Use proper waits, avoid flaky selectors
- Mock LLM responses, don't call real APIs

### CI Requirements
- [ ] All E2E tests pass
- [ ] Tests complete in <60s

## PR Preparation

- **Title**: `test(e2e): add auto-detection flow test [TASK-413]`
- **Labels**: `test`, `e2e`, `ai-mvp`, `phase-3`
- **Depends on**: TASK-411, TASK-412

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `test`
**Estimated Totals:** 3 turns, ~12K tokens, ~20m
**Confidence:** Medium

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after TASK-411, 412)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-413-e2e-auto-detection

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-411, TASK-412
- **Blocks:** TASK-414

---

## Implementation Summary (Engineer-Owned)

**Completed Date:** 2025-12-18

### Files Created
- `tests/e2e/autoDetection.test.tsx` - E2E test suite for auto-detection flow

### Implementation Notes
1. Created comprehensive E2E test file with 10 tests covering all acceptance criteria
2. Adapted task requirements from Playwright to Jest+RTL (project uses Jest, not Playwright)
3. Tests use mocked `window.api` calls as per existing test patterns
4. All tests pass deterministically

### Acceptance Criteria Verification
- [x] Test detects transaction from email batch - `should detect transaction from email batch via scan`
- [x] Test shows detected transaction in pending review - `should show detected transaction in pending review filter`
- [x] Test allows user to confirm transaction - `should allow user to confirm transaction`
- [x] Test allows user to edit before confirming - `should allow user to edit transaction before confirming`
- [x] Test allows user to reject with reason - `should allow user to reject with reason`
- [x] Test records feedback for all actions - multiple tests verify feedback recording

### Deviations from Task File
- Task file specified Playwright syntax but project uses Jest+RTL
- Adapted test approach to match existing project patterns

### Engineer Checklist
- [x] All acceptance criteria met
- [x] Tests pass (`npm test`)
- [x] Type check passes (`npm run type-check`)
- [x] Lint passes (`npm run lint`)

### Engineer Metrics
- Planning: 1 turn, ~10K tokens, ~8 min
- Implementation: 5 turns, ~25K tokens, ~35 min
- Debugging: 3 turns, ~12K tokens, ~20 min
- **Total:** 9 turns, ~47K tokens, ~63 min

**Estimated vs Actual:** Est 3 turns, 12K tokens -> Actual 9 turns, ~47K tokens (mock isolation issues required debugging)
