# BACKLOG-077: AI MVP Phase 4 - User Feedback Loop

**Priority:** Medium
**Type:** Backend / Frontend
**Sprint:** SPRINT-006
**Estimated Effort:** 8 turns (~1h)
**Dependencies:** BACKLOG-076 (Hybrid Pipeline)

---

## Description

Enable users to correct AI mistakes and capture feedback for algorithm improvement. This phase creates the feedback capture system that records user corrections for future learning.

---

## Tasks

### F01: Create Feedback Service
**Estimated:** 3 turns
**File:** `electron/services/feedbackService.ts`

Captures and stores user corrections:

```typescript
interface FeedbackService {
  recordTransactionFeedback(
    detectedTransactionId: string,
    action: 'confirm' | 'reject' | 'merge',
    corrections?: {
      propertyAddress?: string;
      transactionType?: string;
      addCommunications?: string[];
      removeCommunications?: string[];
    }
  ): Promise<void>;

  recordRoleFeedback(
    transactionId: string,
    contactId: string,
    originalRole: string,
    correctedRole: string
  ): Promise<void>;

  recordCommunicationFeedback(
    communicationId: string,
    wasRelevant: boolean,
    correctTransactionId?: string
  ): Promise<void>;

  getFeedbackStats(userId: string): Promise<FeedbackStats>;
}
```

**Note:** Uses existing `user_feedback` table with extended feedback types.

**Acceptance Criteria:**
- [ ] Feedback saved to user_feedback table
- [ ] Original prediction stored for comparison
- [ ] Model/prompt version tracked
- [ ] Stats calculation works

### F02: Create Feedback Handlers
**Estimated:** 2 turns
**File:** `electron/feedback-handlers.ts`

IPC handlers for recording feedback:
- `feedback:record-transaction` - User confirms/rejects detected transaction
- `feedback:record-role` - User corrects contact role
- `feedback:record-relevance` - User marks communication relevant/irrelevant
- `feedback:get-stats` - Get accuracy stats

**Acceptance Criteria:**
- [ ] Handlers registered in main.ts
- [ ] Preload bridge methods added
- [ ] Error responses formatted correctly

### F03: Update FeedbackLearningService
**Estimated:** 3 turns
**File:** `electron/services/feedbackLearningService.ts`

Extend existing service to analyze LLM-specific feedback:
- Track accuracy by model/provider
- Track accuracy by prompt version
- Detect systematic errors (e.g., always wrong about escrow officers)
- Generate improvement suggestions

```typescript
interface LLMFeedbackAnalysis {
  accuracyByProvider: Map<string, number>;
  accuracyByPromptVersion: Map<string, number>;
  systematicErrors: Array<{
    pattern: string;
    frequency: number;
    suggestion: string;
  }>;
}
```

**Acceptance Criteria:**
- [ ] Accuracy tracked per provider
- [ ] Accuracy tracked per prompt version
- [ ] Systematic errors identified
- [ ] Analysis available via API

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/services/feedbackService.ts` | Main feedback capture |
| `electron/feedback-handlers.ts` | IPC handlers |

## Files to Modify

| File | Changes |
|------|---------|
| `electron/services/feedbackLearningService.ts` | Add LLM-specific analysis |
| `electron/main.ts` | Register feedback handlers |
| `electron/preload.ts` | Add feedback bridge methods |

---

## Integration with Existing Feedback System

The existing `user_feedback` table will be used with extended feedback types:

**Current feedback_type values:**
- `correction`
- `confirmation`
- `rejection`

**Extended feedback_type values (add):**
- `transaction_approved` - User approved AI-detected transaction
- `transaction_rejected` - User rejected AI-detected transaction
- `transaction_edited` - User edited before approving
- `contact_role_corrected` - User changed suggested role
- `communication_unlinked` - User removed comm from transaction
- `communication_added` - User added comm to transaction

---

## Quality Gate: Feedback Loop Ready

Before marking complete, verify:
- [ ] Feedback recorded on approve/reject
- [ ] Original prediction stored with feedback
- [ ] Model/prompt version tracked
- [ ] Stats calculation returns correct values
- [ ] FeedbackLearningService identifies patterns

---

## Metrics Tracking

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| Implementation | - | - | - |
| PR Review | - | - | - |
| Debugging/Fixes | - | - | - |
| **Total** | - | - | - |

*Fill in after completion*
