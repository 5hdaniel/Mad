# Task TASK-402: Feedback IPC Handlers Extension

## Goal

Create IPC handlers for recording user feedback from the renderer process, extending the existing feedback system with LLM-specific feedback types.

## Non-Goals

- Do NOT implement the FeedbackService (TASK-401)
- Do NOT implement learning analysis (TASK-403)
- Do NOT create UI components
- Do NOT modify existing feedback handler signatures

## Deliverables

1. New file: `electron/feedback-handlers.ts`
2. Update: `electron/main.ts` (register handlers)
3. Update: `electron/preload.ts` (add bridge methods)

## Acceptance Criteria

- [x] `feedback:record-transaction` handler works
- [x] `feedback:record-role` handler works
- [x] `feedback:record-relevance` handler works
- [x] `feedback:get-stats` handler returns stats
- [x] Preload bridge methods added
- [x] All CI checks pass

## Implementation Notes

### Key Patterns

```typescript
// electron/feedback-handlers.ts
import { ipcMain } from 'electron';
import { getFeedbackService, TransactionFeedback, RoleFeedback, CommunicationFeedback } from './services/feedbackService';

export function registerFeedbackHandlers(): void {
  const feedbackService = getFeedbackService();

  ipcMain.handle('feedback:record-transaction', async (_, userId: string, feedback: TransactionFeedback) => {
    try {
      await feedbackService.recordTransactionFeedback(userId, feedback);
      return { success: true };
    } catch (error) {
      console.error('[Feedback] Error recording transaction feedback:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('feedback:record-role', async (_, userId: string, feedback: RoleFeedback) => {
    try {
      await feedbackService.recordRoleFeedback(userId, feedback);
      return { success: true };
    } catch (error) {
      console.error('[Feedback] Error recording role feedback:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('feedback:record-relevance', async (_, userId: string, feedback: CommunicationFeedback) => {
    try {
      await feedbackService.recordCommunicationFeedback(userId, feedback);
      return { success: true };
    } catch (error) {
      console.error('[Feedback] Error recording relevance feedback:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('feedback:get-stats', async (_, userId: string) => {
    try {
      const stats = await feedbackService.getFeedbackStats(userId);
      return { success: true, data: stats };
    } catch (error) {
      console.error('[Feedback] Error getting stats:', error);
      return { success: false, error: (error as Error).message };
    }
  });
}
```

```typescript
// electron/preload.ts - add to existing contextBridge.exposeInMainWorld
feedback: {
  recordTransaction: (userId: string, feedback: TransactionFeedback) =>
    ipcRenderer.invoke('feedback:record-transaction', userId, feedback),
  recordRole: (userId: string, feedback: RoleFeedback) =>
    ipcRenderer.invoke('feedback:record-role', userId, feedback),
  recordRelevance: (userId: string, feedback: CommunicationFeedback) =>
    ipcRenderer.invoke('feedback:record-relevance', userId, feedback),
  getStats: (userId: string) =>
    ipcRenderer.invoke('feedback:get-stats', userId),
},
```

### Important Details

- Handlers return `{ success: boolean, error?: string, data?: any }` format
- Error handling with logging
- Register in main.ts after app ready

## Integration Notes

- Imports from: `electron/services/feedbackService.ts` (TASK-401)
- Exports to: Renderer process via preload bridge
- Used by: TASK-408 (Approve/Reject UI)
- Depends on: TASK-401 (FeedbackService)

## Do / Don't

### Do:
- Follow existing IPC handler patterns
- Return consistent response format
- Log errors with [Feedback] prefix
- Add TypeScript types to preload

### Don't:
- Modify existing handlers
- Throw unhandled errors
- Skip error wrapping

## When to Stop and Ask

- If FeedbackService API differs from expected
- If preload.ts structure is different
- If main.ts handler registration differs

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Yes
- New tests to write:
  - Handler registration test
  - Success response format
  - Error response format

### CI Requirements

This task's PR MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

## PR Preparation

- **Title**: `feat(feedback): add IPC handlers for feedback [TASK-402]`
- **Labels**: `ipc`, `ai-mvp`, `phase-1`
- **Depends on**: TASK-401

---

## PM Estimate Breakdown (PM-Owned)

**Category:** `ipc`

**Estimated Totals:**
- **Turns:** 2
- **Tokens:** ~8K
- **Time:** ~15m

**Estimation Assumptions:**

| Factor | Assumption | Est. Turns |
|--------|------------|------------|
| Files to create | 1 | +0.5 |
| Files to modify | 2 (main.ts, preload.ts) | +1 |
| Code volume | ~80 lines | +0.5 |
| Core files touched | Yes (main.ts, preload.ts) | +0 |

**Confidence:** High

---

## SR Engineer Review Notes

**Review Date:** 2025-12-18 | **Status:** APPROVED

### Branch Information
- **Branch From:** int/ai-polish (after TASK-401)
- **Branch Into:** int/ai-polish
- **Suggested Branch Name:** feature/TASK-402-feedback-handlers

### Execution Classification
- **Parallel Safe:** No
- **Depends On:** TASK-401
- **Blocks:** TASK-406, TASK-408

---

## Implementation Summary (Engineer-Owned)

*To be completed by engineer*

---

## SR Engineer Review (SR-Owned)

**SR Review Date:** 2025-12-18 | **Status:** MERGED

### SR Engineer Metrics

| Phase | Turns | Tokens | Time |
|-------|-------|--------|------|
| PR Review | 1 | ~8K | ~10 min |
| **SR Total** | 1 | ~8K | ~10 min |

### Review Summary

**Architecture Compliance:** PASS
- IPC handlers correctly defined in `electron/feedback-handlers.ts`
- Uses proper `ipcMain.handle()` pattern with delegation to `FeedbackService`
- Consistent error handling with `{ success, error }` response format
- Preload bridge methods properly typed under `feedback` namespace

**Security Assessment:** PASS
- No sensitive data exposure
- Proper error message sanitization
- userId parameter properly passed through

**Test Coverage:** PASS
- 15 new test cases covering all 4 handlers
- Tests cover success, error, and edge cases

**Code Quality:**
- 99 lines added to feedback-handlers.ts
- 65 lines added to preload.ts
- 254 lines of tests

### Merge Information

- **PR:** #171
- **Commit:** f476c225cd1fb452d4f6a373f44d2612bf2229f0
- **Merged To:** int/ai-polish
- **Merge Type:** Traditional merge
