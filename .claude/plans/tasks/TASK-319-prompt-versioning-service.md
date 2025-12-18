# Task TASK-319: Prompt Versioning Service

## Goal

Create a service that tracks which prompt version produced each LLM result, enabling accuracy metrics by version and A/B testing of prompt variations.

## Non-Goals

- Do NOT implement full A/B testing framework
- Do NOT create UI for prompt management
- Do NOT store prompts in database (use file-based versioning)
- Do NOT implement automatic prompt rollback
- Do NOT modify existing LLM provider services

## Deliverables

1. New file: `electron/services/llm/promptVersionService.ts`
2. Update file: `electron/services/llm/tools/types.ts` (add version tracking fields)

## Acceptance Criteria

- [ ] `getCurrentVersion(promptName)` returns current version info for any registered prompt
- [ ] `recordUsage(promptName, resultId, outcome?)` logs prompt usage with result
- [ ] `getVersionHistory(promptName)` returns version history with dates
- [ ] `getAccuracyByVersion(promptName)` calculates accuracy metrics from logged outcomes
- [ ] Version info includes: name, version, hash, createdAt
- [ ] Usage records stored in memory with optional persistence callback
- [ ] All registered prompts from TASK-318 are accessible
- [ ] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// electron/services/llm/promptVersionService.ts
import { ALL_PROMPTS, PromptMetadata } from './prompts';

export interface PromptVersion {
  name: string;
  version: string;
  hash: string;
  createdAt: string;
}

export interface PromptUsageRecord {
  id: string;
  promptName: string;
  promptVersion: string;
  promptHash: string;
  resultId: string;
  timestamp: string;
  outcome?: 'correct' | 'incorrect' | 'unknown';
  feedbackScore?: number; // 1-5 user rating
}

export interface VersionAccuracyMetrics {
  version: string;
  hash: string;
  totalUsages: number;
  correctCount: number;
  incorrectCount: number;
  unknownCount: number;
  accuracyRate: number | null; // null if no feedback
  averageFeedbackScore: number | null;
}

export class PromptVersionService {
  private prompts: Map<string, PromptMetadata>;
  private usageRecords: PromptUsageRecord[];
  private persistCallback?: (records: PromptUsageRecord[]) => Promise<void>;

  constructor() {
    this.prompts = new Map();
    this.usageRecords = [];

    // Register all prompts from TASK-318
    ALL_PROMPTS.forEach(prompt => {
      this.prompts.set(prompt.name, prompt);
    });
  }

  /**
   * Set a callback for persisting usage records
   */
  setPersistCallback(callback: (records: PromptUsageRecord[]) => Promise<void>): void {
    this.persistCallback = callback;
  }

  /**
   * Get current version info for a prompt
   */
  getCurrentVersion(promptName: string): PromptVersion | null {
    const prompt = this.prompts.get(promptName);
    if (!prompt) return null;

    return {
      name: prompt.name,
      version: prompt.version,
      hash: prompt.hash,
      createdAt: prompt.createdAt,
    };
  }

  /**
   * Get all registered prompt names
   */
  getRegisteredPrompts(): string[] {
    return [...this.prompts.keys()];
  }

  /**
   * Record a prompt usage
   */
  async recordUsage(
    promptName: string,
    resultId: string,
    outcome?: 'correct' | 'incorrect' | 'unknown'
  ): Promise<void> {
    const version = this.getCurrentVersion(promptName);
    if (!version) {
      console.warn(`[PromptVersionService] Unknown prompt: ${promptName}`);
      return;
    }

    const record: PromptUsageRecord = {
      id: this.generateId(),
      promptName,
      promptVersion: version.version,
      promptHash: version.hash,
      resultId,
      timestamp: new Date().toISOString(),
      outcome,
    };

    this.usageRecords.push(record);

    // Persist if callback set
    if (this.persistCallback) {
      try {
        await this.persistCallback(this.usageRecords);
      } catch (error) {
        console.error('[PromptVersionService] Failed to persist:', error);
      }
    }
  }

  /**
   * Update outcome for a previously recorded usage
   */
  updateOutcome(
    resultId: string,
    outcome: 'correct' | 'incorrect',
    feedbackScore?: number
  ): void {
    const record = this.usageRecords.find(r => r.resultId === resultId);
    if (record) {
      record.outcome = outcome;
      if (feedbackScore !== undefined) {
        record.feedbackScore = feedbackScore;
      }
    }
  }

  /**
   * Get version history for a prompt (from usage records)
   */
  getVersionHistory(promptName: string): Array<{
    version: string;
    hash: string;
    firstUsed: string;
    lastUsed: string;
    usageCount: number;
  }> {
    const versionMap = new Map<string, {
      version: string;
      hash: string;
      firstUsed: string;
      lastUsed: string;
      usageCount: number;
    }>();

    this.usageRecords
      .filter(r => r.promptName === promptName)
      .forEach(record => {
        const key = record.promptHash;
        const existing = versionMap.get(key);

        if (!existing) {
          versionMap.set(key, {
            version: record.promptVersion,
            hash: record.promptHash,
            firstUsed: record.timestamp,
            lastUsed: record.timestamp,
            usageCount: 1,
          });
        } else {
          existing.lastUsed = record.timestamp;
          existing.usageCount++;
        }
      });

    return [...versionMap.values()].sort((a, b) =>
      new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  }

  /**
   * Get accuracy metrics by version
   */
  getAccuracyByVersion(promptName: string): Map<string, VersionAccuracyMetrics> {
    const metricsMap = new Map<string, VersionAccuracyMetrics>();

    this.usageRecords
      .filter(r => r.promptName === promptName)
      .forEach(record => {
        const key = record.promptHash;
        let metrics = metricsMap.get(key);

        if (!metrics) {
          metrics = {
            version: record.promptVersion,
            hash: record.promptHash,
            totalUsages: 0,
            correctCount: 0,
            incorrectCount: 0,
            unknownCount: 0,
            accuracyRate: null,
            averageFeedbackScore: null,
          };
          metricsMap.set(key, metrics);
        }

        metrics.totalUsages++;

        if (record.outcome === 'correct') metrics.correctCount++;
        else if (record.outcome === 'incorrect') metrics.incorrectCount++;
        else metrics.unknownCount++;
      });

    // Calculate accuracy rates
    metricsMap.forEach(metrics => {
      const ratedCount = metrics.correctCount + metrics.incorrectCount;
      if (ratedCount > 0) {
        metrics.accuracyRate = metrics.correctCount / ratedCount;
      }

      // Calculate average feedback score
      const recordsWithFeedback = this.usageRecords.filter(
        r => r.promptHash === metrics.hash && r.feedbackScore !== undefined
      );
      if (recordsWithFeedback.length > 0) {
        const sum = recordsWithFeedback.reduce((s, r) => s + (r.feedbackScore || 0), 0);
        metrics.averageFeedbackScore = sum / recordsWithFeedback.length;
      }
    });

    return metricsMap;
  }

  /**
   * Get usage statistics summary
   */
  getUsageStats(): {
    totalUsages: number;
    byPrompt: Record<string, number>;
    recentUsages: PromptUsageRecord[];
  } {
    const byPrompt: Record<string, number> = {};

    this.usageRecords.forEach(r => {
      byPrompt[r.promptName] = (byPrompt[r.promptName] || 0) + 1;
    });

    return {
      totalUsages: this.usageRecords.length,
      byPrompt,
      recentUsages: this.usageRecords.slice(-10), // Last 10
    };
  }

  /**
   * Clear usage records (for testing or reset)
   */
  clearUsageRecords(): void {
    this.usageRecords = [];
  }

  /**
   * Load usage records (for persistence recovery)
   */
  loadUsageRecords(records: PromptUsageRecord[]): void {
    this.usageRecords = records;
  }

  private generateId(): string {
    return `pv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const promptVersionService = new PromptVersionService();
```

### Tool Integration Example

```typescript
// In tools, after getting LLM response:
import { promptVersionService } from '../promptVersionService';
import { messageAnalysisPrompt } from '../prompts';

// After successful analysis:
await promptVersionService.recordUsage(
  messageAnalysisPrompt.name,
  resultId, // unique ID for this result
  'unknown' // outcome unknown until user feedback
);

// Return version with result:
return {
  success: true,
  data: {
    ...analysis,
    promptVersion: messageAnalysisPrompt.hash,
  },
  // ...
};
```

### Important Details

- Keep usage records in memory with optional persistence callback
- Support loading records from external storage
- Track both outcome (correct/incorrect) and feedback score
- Calculate accuracy only from rated results (ignore unknown)
- Singleton pattern for global access

## Integration Notes

- Imports from: `electron/services/llm/prompts/index.ts`
- Exports to: `electron/services/llm/tools/*.ts`, `electron/services/extraction/hybridExtractorService.ts`
- Used by: All AI tools for usage tracking
- Depends on: TASK-318 (prompt templates with metadata)

## Do / Don't

### Do:
- Use singleton pattern for global access
- Allow external persistence via callback
- Track all usage even without outcome
- Calculate metrics lazily on request
- Support clearing/loading for testing

### Don't:
- Store prompts in database (file-based only)
- Implement complex A/B testing logic
- Block on persistence failures
- Require outcome for every usage
- Modify prompt templates from this service

## When to Stop and Ask

- If TASK-318 prompts have different structure than expected
- If persistence needs are more complex (database storage)
- If A/B testing needs more sophisticated randomization
- If memory usage becomes a concern with many records

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - `promptVersionService.test.ts`:
    - Test getCurrentVersion returns correct info
    - Test recordUsage adds record
    - Test updateOutcome modifies existing record
    - Test getVersionHistory groups correctly
    - Test getAccuracyByVersion calculates correctly
    - Test accuracy with no feedback returns null
    - Test clearUsageRecords works
    - Test loadUsageRecords works
    - Test persist callback is called

### Coverage

- Coverage impact:
  - Target 90%+ for this service

### Integration / Feature Tests

- Required scenarios:
  - Full flow: record -> update outcome -> check accuracy
  - Multiple versions tracked separately

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Integration tests (if applicable)
- [ ] Coverage checks
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `feat(llm): add prompt versioning service [TASK-319]`
- **Labels**: `llm`, `ai-mvp`, `phase-1`
- **Depends on**: TASK-318 (prompt templates)

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `service`

**Estimated Totals:**
- **Turns:** 4-5
- **Tokens:** ~15K-20K
- **Time:** ~20-30m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 1 new file | +1 |
| Files to modify | 1 file (types.ts) | +0.5 |
| Code volume | ~200 lines | +1.5 |
| Functions/handlers | 8 methods | +1 |
| Core files touched | No (electron main/preload unchanged) | +0 |
| New patterns | Simple tracking service | +0 |
| Test complexity | Low (no mocking needed) | +1 |
| Dependencies | 0 new dependencies | +0 |

**Confidence:** High

**Risk factors:**
- Memory management with large usage history
- Persistence callback complexity

**Similar past tasks:** Configuration tracking services (~4 turns)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: You MUST complete this section before opening your PR.**
**PRs will be REJECTED if this section is incomplete.**

*Completed: <DATE>*

### Plan-First Protocol

```
Plan Agent Invocations:
- [ ] Initial plan created
- [ ] Plan reviewed from Engineer perspective
- [ ] Plan approved (revisions: X)

Plan Agent Metrics:
| Activity | Turns | Tokens (est.) | Time |
|----------|-------|---------------|------|
| Initial Plan | X | ~XK | X min |
| Revision(s) | X | ~XK | X min |
| **Plan Total** | X | ~XK | X min |
```

### Checklist

```
Files created:
- [ ] electron/services/llm/promptVersionService.ts

Files modified:
- [ ] electron/services/llm/tools/types.ts (if needed)

Features implemented:
- [ ] getCurrentVersion working
- [ ] recordUsage working
- [ ] updateOutcome working
- [ ] getVersionHistory working
- [ ] getAccuracyByVersion working
- [ ] Persist callback support

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes (if applicable)
```

### Engineer Metrics

```
| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning (Plan) | X | ~XK | X min |
| Implementation (Impl) | X | ~XK | X min |
| Debugging (Debug) | X | ~XK | X min |
| **Engineer Total** | X | ~XK | X min |
```

### Notes

**Planning notes:**
<Key decisions from planning phase, revisions if any>

**Deviations from plan:**
<If you deviated from the approved plan, explain what and why. Use "DEVIATION:" prefix.>
<If no deviations, write "None">

**Design decisions:**
<Document any design decisions you made and the reasoning>

**Issues encountered:**
<Document any issues or challenges and how you resolved them>

**Reviewer notes:**
<Anything the reviewer should pay attention to>

### Estimate vs Actual Analysis

**REQUIRED: Compare PM estimates to actuals to improve future predictions.**

| Factor | PM Assumed | Actual | Delta | Why Different? |
|--------|------------|--------|-------|----------------|
| Files to create | 1 | X | +/- X | <reason> |
| Files to modify | 1 | X | +/- X | <reason> |
| Code volume | ~200 lines | ~X lines | +/- X | <reason> |
| Functions/handlers | 8 | X | +/- X | <reason> |
| Core files touched | No | Yes/No | - | <reason if changed> |
| New patterns | No | Yes/No | - | <reason if changed> |
| Test complexity | Low | Low/Med/High | - | <reason if changed> |

**Total Variance:** Est 4-5 turns -> Actual Z turns (X% over/under)

**Root cause of variance:**
<1-2 sentence explanation of why estimate was off>

**Suggestion for similar tasks:**
<What should PM estimate differently next time?>

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information (SR Engineer decides)
- **Branch From:** int/ai-tools (after TASK-318 merged)
- **Branch Into:** int/ai-tools
- **Suggested Branch Name:** feature/TASK-319-prompt-versioning

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-318 (prompt templates)
- **Blocks:** TASK-320 (hybrid extractor - last Phase 1 dependency)

### Shared File Analysis
- Files created:
  - `electron/services/llm/promptVersionService.ts` (new)
- Files modified:
  - `electron/services/llm/tools/types.ts` (add version tracking fields if needed)
- Conflicts with: None (sequential dependency)
- **Resolution:** N/A - sequential task

### Technical Considerations
- Singleton pattern appropriate for global access
- In-memory storage with optional persistence callback is flexible
- Accuracy metrics calculated lazily (good for performance)
- Supports future A/B testing without implementing it now
- No database schema changes required
- Memory usage could grow with usage history - consider adding max records limit
- No core file modifications

### Additional Notes
- This completes Phase 1 of the sprint
- After this merges to int/ai-tools, SR Engineer should review full Phase 1
- Then merge int/ai-tools to develop before Phase 2 begins

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
**Merged To:** int/ai-tools
