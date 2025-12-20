# TASK-503: Spam Filter Integration

## Metrics Tracking (REQUIRED)

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Planning | | | |
| Implementation | | | |
| Debugging | | | |
| **Total** | | | |

---

## Task Summary

Integrate spam filtering into the hybrid extraction pipeline to skip spam/junk emails before LLM processing.

## Context

- **Sprint**: SPRINT-007 (LLM Cost Optimization)
- **Backlog**: BACKLOG-084
- **Phase**: 1 (Spam Filtering)
- **Dependencies**: TASK-501, TASK-502
- **Estimated Turns**: 10

## Branch Instructions

```bash
git checkout int/cost-optimization
git pull origin int/cost-optimization
git checkout -b feature/TASK-503-spam-filter-integration
```

## Technical Specification

### Step 1: Extend MessageInput Interface (REQUIRED)

**File:** `electron/services/extraction/types.ts`

The `MessageInput` interface needs spam-related fields for filtering:

```typescript
export interface MessageInput {
  id: string;
  subject: string;
  body: string;
  sender: string;
  recipients: string[];
  date: string;
  // NEW: Spam detection fields (added per SR Engineer review)
  labels?: string[];                    // Gmail labels
  inferenceClassification?: string;     // Outlook focused/other
  parentFolderName?: string;            // Outlook folder name
}
```

### Step 2: Integration Point

**File:** `electron/services/extraction/hybridExtractorService.ts`

Add spam filter check before processing emails in `analyzeMessages()` method.

```typescript
import { isGmailSpam, isOutlookJunk, SpamFilterResult } from '../llm/spamFilterService';

// In analyzeMessages() or processEmails():
async analyzeMessages(messages: Message[]): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];
  const skippedSpam: Message[] = [];

  for (const message of messages) {
    // Check for spam/junk
    const spamResult = this.checkSpam(message);
    if (spamResult.isSpam) {
      skippedSpam.push(message);
      logService.debug('Skipping spam email', 'HybridExtractor', {
        messageId: message.id,
        reason: spamResult.reason
      });
      continue;
    }

    // Existing analysis logic...
  }

  logService.info('Spam filter results', 'HybridExtractor', {
    total: messages.length,
    processed: results.length,
    skippedSpam: skippedSpam.length
  });

  return results;
}

private checkSpam(message: Message): SpamFilterResult {
  // Gmail check
  if (message.labels && message.labels.length > 0) {
    return isGmailSpam(message.labels);
  }

  // Outlook check
  if (message.inferenceClassification || message.parentFolderId) {
    return isOutlookJunk({
      inferenceClassification: message.inferenceClassification,
      parentFolderName: message.parentFolderName
    });
  }

  return { isSpam: false };
}
```

### Logging and Metrics

Track spam filtering stats:
```typescript
interface SpamFilterStats {
  totalEmails: number;
  spamFiltered: number;
  gmailSpam: number;
  outlookJunk: number;
  percentFiltered: number;
}
```

## Acceptance Criteria

- [ ] Spam filter integrated into extraction pipeline
- [ ] Gmail SPAM/TRASH emails skipped
- [ ] Outlook junk emails skipped
- [ ] Logging shows filter stats
- [ ] No change to analysis results for non-spam emails
- [ ] Performance not degraded (filter is O(1) per email)

## Files to Modify

| File | Action |
|------|--------|
| `electron/services/extraction/types.ts` | MODIFY (extend MessageInput interface) |
| `electron/services/extraction/hybridExtractorService.ts` | MODIFY |

**Note:** MessageInput interface extended per SR Engineer review to carry spam labels from fetch layer.

## Guardrails

- DO NOT change LLM analysis logic
- DO NOT modify database writes
- ONLY add filtering step before analysis loop

## Definition of Done

- [ ] Spam filter integrated and working
- [ ] Integration tests pass
- [ ] `npm test` passes
- [ ] PR created targeting `int/cost-optimization`
- [ ] Metrics recorded

---

## SR Engineer Review Notes

**Reviewed:** 2025-12-19
**Reviewer:** SR Engineer Agent

### Classification
- [ ] Approved as-is
- [x] Approved with minor changes
- [ ] Needs revision

### Branch Information
- **Branch From:** `int/cost-optimization` (AFTER TASK-501 and TASK-502 are merged)
- **Branch Into:** `int/cost-optimization`
- **Suggested Branch Name:** `feature/TASK-503-spam-filter-integration`

### Execution Classification
- **Parallel Safe:** No - must wait for TASK-501 and TASK-502
- **Depends On:** TASK-501, TASK-502
- **Blocks:** TASK-504 (Phase 2 start)

### Technical Notes

1. **hybridExtractorService.ts structure verified:** The current service (668 lines) has an `analyzeMessages()` method starting at line 127. The integration point is correct.

2. **Message type mismatch:** The task uses `Message[]` but the actual `analyzeMessages()` method uses `MessageInput[]` from `./types.ts`. The spam filter needs to work with `MessageInput` interface which has:
   - `id`, `subject`, `body`, `sender`, `recipients`, `date`
   - Does NOT have `labels` or `inferenceClassification` directly

3. **Data flow issue:** The spam filter needs Gmail labels and Outlook classification, but these come from fetch services, not the `MessageInput` passed to `analyzeMessages()`. The integration needs to happen at a HIGHER level - either:
   - Pass labels through `MessageInput` (requires type change)
   - Filter before calling `analyzeMessages()` (recommended)

4. **Recommended integration point:** Rather than modifying `analyzeMessages()`, create a wrapper method or filter in the calling code (likely an IPC handler or orchestrator).

5. **Stats interface is good:** The `SpamFilterStats` interface for tracking is well-designed.

### Risk Notes

- **Medium risk:** Modifying `hybridExtractorService.ts` is a core file. Changes must be surgical.
- **Data availability issue:** The `MessageInput` interface doesn't carry spam labels. Need to extend it or filter upstream.

### Dependencies

Confirmed: TASK-501 and TASK-502 must be merged first. This is the Phase 1 integration gate.

### Shared File Analysis
- Files modified: `hybridExtractorService.ts` - first Phase 1 modification
- Potential conflict with Phase 2 tasks (TASK-504, 505, 506) - must complete first

### Recommended Changes

1. **Critical:** The `MessageInput` interface in `extraction/types.ts` needs to be extended to include spam-related fields:

   ```typescript
   export interface MessageInput {
     id: string;
     subject: string;
     body: string;
     sender: string;
     recipients: string[];
     date: string;
     // NEW: Spam detection fields
     labels?: string[];  // Gmail labels
     inferenceClassification?: string;  // Outlook
     parentFolderName?: string;  // Outlook folder
   }
   ```

2. **Alternative approach:** Filter BEFORE calling `analyzeMessages()` at the orchestration layer. This keeps `hybridExtractorService` focused on analysis only.

3. **Add test file:** Create `electron/services/extraction/__tests__/hybridExtractorService.spamFilter.test.ts` for integration tests.

4. **Logging format:** Use consistent log format with existing `HybridExtractor` logging patterns (see lines 191-193 in current file).
