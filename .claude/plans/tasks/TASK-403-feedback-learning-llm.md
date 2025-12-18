# Task TASK-403: FeedbackLearningService LLM Analysis

## Goal

Extend the existing FeedbackLearningService to analyze LLM-specific feedback, tracking accuracy by provider and prompt version, and identifying systematic errors for improvement.

## Non-Goals

- Do NOT implement automatic prompt tuning
- Do NOT modify FeedbackService (TASK-401)
- Do NOT create IPC handlers (TASK-402)
- Do NOT implement UI components

## Deliverables

1. Update: `electron/services/feedbackLearningService.ts`
2. Update: `electron/services/__tests__/feedbackLearningService.test.ts`

## Acceptance Criteria

- [x] `getAccuracyByProvider()` returns accuracy per LLM provider
- [x] `getAccuracyByPromptVersion()` returns accuracy per prompt version
- [x] `identifySystematicErrors()` detects patterns in rejections
- [x] `getLLMFeedbackAnalysis()` returns comprehensive analysis
- [x] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// Add to electron/services/feedbackLearningService.ts

export interface LLMFeedbackAnalysis {
  accuracyByProvider: Record<string, { approvals: number; rejections: number; rate: number }>;
  accuracyByPromptVersion: Record<string, { approvals: number; rejections: number; rate: number }>;
  systematicErrors: Array<{
    pattern: string;
    frequency: number;
    suggestion: string;
  }>;
  totalLLMFeedback: number;
  overallAccuracy: number;
}

// Add methods to FeedbackLearningService class:

async getAccuracyByProvider(userId: string): Promise<Record<string, { approvals: number; rejections: number; rate: number }>> {
  const db = getDatabaseService();
  const rows = await db.all(`
    SELECT
      model_version,
      SUM(CASE WHEN feedback_type IN ('transaction_approved', 'transaction_edited') THEN 1 ELSE 0 END) as approvals,
      SUM(CASE WHEN feedback_type = 'transaction_rejected' THEN 1 ELSE 0 END) as rejections
    FROM user_feedback
    WHERE user_id = ? AND model_version IS NOT NULL
    GROUP BY model_version
  `, [userId]);

  const result: Record<string, { approvals: number; rejections: number; rate: number }> = {};
  for (const row of rows) {
    const total = row.approvals + row.rejections;
    result[row.model_version] = {
      approvals: row.approvals,
      rejections: row.rejections,
      rate: total > 0 ? row.approvals / total : 0,
    };
  }
  return result;
}

async getAccuracyByPromptVersion(userId: string): Promise<Record<string, { approvals: number; rejections: number; rate: number }>> {
  // Similar to getAccuracyByProvider but grouped by prompt_version
}

async identifySystematicErrors(userId: string): Promise<Array<{ pattern: string; frequency: number; suggestion: string }>> {
  const db = getDatabaseService();

  // Analyze rejected transactions for common patterns
  const rejections = await db.all(`
    SELECT corrected_value, COUNT(*) as count
    FROM user_feedback
    WHERE user_id = ? AND feedback_type = 'transaction_rejected'
    GROUP BY corrected_value
    HAVING count > 2
    ORDER BY count DESC
    LIMIT 10
  `, [userId]);

  const errors: Array<{ pattern: string; frequency: number; suggestion: string }> = [];

  for (const row of rejections) {
    try {
      const data = JSON.parse(row.corrected_value || '{}');
      if (data.reason) {
        errors.push({
          pattern: data.reason,
          frequency: row.count,
          suggestion: `Review detection logic for: ${data.reason}`,
        });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  return errors;
}

async getLLMFeedbackAnalysis(userId: string): Promise<LLMFeedbackAnalysis> {
  const [byProvider, byPromptVersion, systematicErrors] = await Promise.all([
    this.getAccuracyByProvider(userId),
    this.getAccuracyByPromptVersion(userId),
    this.identifySystematicErrors(userId),
  ]);

  // Calculate totals
  let totalApprovals = 0;
  let totalRejections = 0;
  for (const stats of Object.values(byProvider)) {
    totalApprovals += stats.approvals;
    totalRejections += stats.rejections;
  }

  const totalLLMFeedback = totalApprovals + totalRejections;

  return {
    accuracyByProvider: byProvider,
    accuracyByPromptVersion: byPromptVersion,
    systematicErrors,
    totalLLMFeedback,
    overallAccuracy: totalLLMFeedback > 0 ? totalApprovals / totalLLMFeedback : 0,
  };
}
```

## Integration Notes

- Imports from: `electron/services/databaseService.ts`
- Exports to: Future analytics dashboard
- Used by: TASK-402 (IPC handlers can expose analysis)
- Depends on: TASK-401 (FeedbackService stores the data)

## Do / Don't

### Do:
- Add methods to existing service
- Use SQL aggregation for efficiency
- Handle empty data gracefully

### Don't:
- Replace existing methods
- Create separate service
- Implement complex ML algorithms

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Test accuracy by provider calculation
  - Test accuracy by prompt version
  - Test systematic error detection
  - Test with no feedback data
  - Test with mixed feedback types

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

## PR Preparation

- **Title**: `feat(feedback): add LLM accuracy analysis to FeedbackLearningService [TASK-403]`
- **Labels**: `feedback`, `ai-mvp`, `phase-1`
- **Depends on**: TASK-401

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Estimated Totals:**
- **Turns:** 3
- **Tokens:** ~12K
- **Time:** ~20m

**Confidence:** Medium

**Risk factors:**
- Existing FeedbackLearningService structure unknown

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after TASK-401)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-403-feedback-learning-llm

### Execution Classification
- **Parallel Safe:** No (after TASK-401)
- **Depends On:** TASK-401
- **Blocks:** None directly

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer*

---

## SR Engineer Review (SR-Owned)

*To be completed during PR review*

**SR Review Date:** 2025-12-18 | **Status:** MERGED

### SR Engineer Metrics

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | 1 | ~10K | ~12 min |
| **SR Total** | 1 | ~10K | ~12 min |

### Review Summary

**Architecture Compliance:** PASS
- Methods added to existing `FeedbackLearningService` class (correct pattern)
- Properly exports new interfaces (`AccuracyStats`, `SystematicError`, `LLMFeedbackAnalysis`)
- Uses existing `databaseService.getFeedbackByField()` abstraction
- Implementation correctly adapted to actual schema (JSON in `original_value` vs dedicated columns)

**Security Assessment:** PASS
- No sensitive data exposure
- Error logging properly prefixed with `[FeedbackLearning]`
- Database queries scoped to userId

**Test Coverage:** PASS
- 21 new test cases covering all 4 methods
- Tests cover success, error handling, edge cases, mixed data scenarios

**Code Quality:**
- 261 lines added to service (4 methods + helper)
- 468 lines of tests
- Good use of `Promise.all()` for parallel queries
- Graceful error handling returning empty objects/arrays

**Implementation Adaptation Note:**
Task file suggested SQL with dedicated `model_version`/`prompt_version` columns. Implementation correctly adapted to actual schema where metadata is stored as JSON in `original_value`, using private `_parseMetadata()` helper. This is good engineering judgment.

### Merge Information

- **PR:** #172
- **Commit:** 61005026a89b08addba234ac5c14afbf4ff2d148
- **Merged To:** int/ai-polish
- **Merge Type:** Traditional merge
