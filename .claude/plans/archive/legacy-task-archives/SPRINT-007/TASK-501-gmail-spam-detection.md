# TASK-501: Gmail Spam Detection Utility

## Metrics Tracking (REQUIRED)

**BEFORE starting implementation, record:**
- Planning Start Time: ___

**AFTER completion, report:**
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Create a utility function to detect Gmail spam/trash emails based on labels already captured during fetch.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 1 (Spam Filtering)
- **Dependencies**: None
- **Estimated Turns**: 15

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-501-gmail-spam-detection
```

**Note:** Integration branch `int/cost-optimization` must be created from `develop` first.

## Technical Specification

### Current State

Gmail fetch service already captures labels (line 368 in `gmailFetchService.ts`):
```typescript
labels: message.labelIds || []  // ["INBOX", "SPAM", "TRASH", etc.]
```

### Implementation

**File:** `electron/services/llm/spamFilterService.ts` (NEW)

```typescript
/**
 * Spam Filter Service
 * Filters out spam/junk emails before LLM processing
 */

// Gmail spam labels to filter
const GMAIL_SPAM_LABELS = ['SPAM', 'TRASH'];

// Gmail promotional/social labels (optional, configurable)
const GMAIL_SKIP_LABELS = ['CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL'];

export interface SpamFilterResult {
  isSpam: boolean;
  reason?: string;
  labels?: string[];
}

/**
 * Check if a Gmail email should be filtered (is spam/trash)
 */
export function isGmailSpam(labels: string[]): SpamFilterResult {
  const spamLabel = labels.find(l => GMAIL_SPAM_LABELS.includes(l));
  if (spamLabel) {
    return {
      isSpam: true,
      reason: `Gmail label: ${spamLabel}`,
      labels
    };
  }
  return { isSpam: false, labels };
}

/**
 * Check if Gmail email is promotional/social (optional filter)
 */
export function isGmailPromotional(labels: string[]): SpamFilterResult {
  const skipLabel = labels.find(l => GMAIL_SKIP_LABELS.includes(l));
  if (skipLabel) {
    return {
      isSpam: true,
      reason: `Gmail category: ${skipLabel}`,
      labels
    };
  }
  return { isSpam: false, labels };
}
```

### Unit Tests

**File:** `electron/services/__tests__/spamFilterService.test.ts`

```typescript
describe('spamFilterService', () => {
  describe('isGmailSpam', () => {
    it('should detect SPAM label', () => {
      const result = isGmailSpam(['INBOX', 'SPAM']);
      expect(result.isSpam).toBe(true);
      expect(result.reason).toContain('SPAM');
    });

    it('should detect TRASH label', () => {
      const result = isGmailSpam(['TRASH']);
      expect(result.isSpam).toBe(true);
    });

    it('should pass normal emails', () => {
      const result = isGmailSpam(['INBOX', 'IMPORTANT']);
      expect(result.isSpam).toBe(false);
    });

    it('should handle empty labels', () => {
      const result = isGmailSpam([]);
      expect(result.isSpam).toBe(false);
    });
  });

  describe('isGmailPromotional', () => {
    it('should detect CATEGORY_PROMOTIONS', () => {
      const result = isGmailPromotional(['CATEGORY_PROMOTIONS']);
      expect(result.isSpam).toBe(true);
    });

    it('should pass primary emails', () => {
      const result = isGmailPromotional(['INBOX', 'CATEGORY_PRIMARY']);
      expect(result.isSpam).toBe(false);
    });
  });
});
```

## Acceptance Criteria

- [ ] `isGmailSpam()` function created and exported
- [ ] Detects SPAM and TRASH labels correctly
- [ ] Optional promotional filter available
- [ ] Unit tests pass with >90% coverage
- [ ] TypeScript types properly defined
- [ ] No changes to existing fetch behavior

## Files to Create/Modify

| File | Action |
|------|--------|
| `electron/services/llm/spamFilterService.ts` | CREATE |
| `electron/services/llm/__tests__/spamFilterService.test.ts` | CREATE |

**Note:** Test file location updated per SR Engineer review to match service location pattern.

## Guardrails

- DO NOT modify `gmailFetchService.ts` in this task
- DO NOT add any database schema changes
- DO NOT integrate with extraction pipeline yet (TASK-503)

## Definition of Done

- [ ] Code complete and compiles
- [ ] Unit tests written and passing
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] PR created targeting `int/cost-optimization`
- [ ] Metrics recorded in this file

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [x] Approved as-is

### Branch Information
- **Branch From:** `develop` (then rebase to `int/cost-optimization` after integration branch created)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-501-gmail-spam-detection`

### Execution Classification
- **Parallel Safe:** Yes - can run in parallel with TASK-502
- **Depends On:** None
- **Blocks:** TASK-503 (integration task)

### Technical Notes

1. **File path verified:** Line 368 reference is accurate - `gmailFetchService.ts` line 368 shows `labels: message.labelIds || []`

2. **Test location correction:** The task specifies `electron/services/__tests__/spamFilterService.test.ts` but this is a new `llm/` subdirectory service. Recommend placing test at `electron/services/llm/__tests__/spamFilterService.test.ts` to match service location pattern (see existing `electron/services/llm/__tests__/*.test.ts`).

3. **Interface alignment:** The `SpamFilterResult` interface looks good. Consider adding an optional `provider?: 'gmail' | 'outlook'` field for unified logging across TASK-501/502.

4. **Implementation is clean and correct.** The `isGmailSpam` and `isGmailPromotional` functions follow existing patterns.

### Risk Notes

- **Low risk:** This is a pure utility function with no database or API dependencies.
- No hidden complexity identified.

### Dependencies

Confirmed: No dependencies. Can start immediately after `int/cost-optimization` branch is created.

### Shared File Analysis
- Files created: New files only, no conflicts possible
- No merge conflict risk with TASK-502 (different provider)

### Recommended Changes

1. **Minor:** Update test file path to `electron/services/llm/__tests__/spamFilterService.test.ts`
2. **Optional:** Add `provider` field to `SpamFilterResult` for better observability
