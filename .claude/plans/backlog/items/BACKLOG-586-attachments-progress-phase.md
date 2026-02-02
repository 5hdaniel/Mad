# BACKLOG-586: Add attachments progress phase to sync status indicator

## Problem
During message import, the sync progress bar shows two phases:
1. Messages (0-100%) - e.g., 680K messages
2. Attachments (0-100%) - e.g., 63K attachments

When messages complete at 100%, the progress resets to 0% for attachments. This is confusing UX - users think the sync restarted or failed.

## Recommended Solution: Combined Weighted Progress (Backend Change)

**SR Engineer Review:** Attachments are part of the messages import operation, not a separate sync. Adding a 4th pill would break the clean 3-sync-type architecture.

### Implementation
Backend calculates weighted overall progress in `macOSMessagesImportService.ts`:

```typescript
// Based on actual data: 680K messages, 63K attachments
// Weight: messages = 90%, attachments = 10%
const MESSAGE_WEIGHT = 0.90;
const ATTACHMENT_WEIGHT = 0.10;

// During message import phase:
const overallPercent = Math.round(messagePercent * MESSAGE_WEIGHT);

// During attachment phase:
const overallPercent = Math.round(
  MESSAGE_WEIGHT * 100 + // Messages complete (90%)
  (attachmentPercent * ATTACHMENT_WEIGHT) // Attachments in progress (0-10%)
);
```

### Why This Approach
| Criterion | Separate Pill | Combined Progress | Phase Indicator |
|-----------|--------------|-------------------|-----------------|
| Backend alignment | Misaligned | **Perfect** | Partial |
| UI consistency | Breaks 3-pill pattern | **Maintains pattern** | OK |
| Implementation | High (new SyncType) | **Low (backend only)** | Medium |
| UX | Confusing | **Smooth 0-100%** | Cognitive load |

### Files to Modify
- `electron/services/macOSMessagesImportService.ts` - modify `storeMessages()` and `storeAttachments()` progress callbacks

## Acceptance Criteria
- [ ] User sees smooth 0-100% progress without reset
- [ ] No frontend changes required
- [ ] Progress accurately reflects overall import work

## Related
- SPRINT-068: Unified Sync State Architecture
- `MacOSMessagesImportService.ts`
