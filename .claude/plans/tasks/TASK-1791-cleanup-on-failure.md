# TASK-1791: Fix Backup Cleanup on Attachment Persistence Failure

**Backlog ID:** BACKLOG-594
**Sprint:** SPRINT-068 (Follow-up / Post-Review)
**Phase:** Post-Implementation Bug Fix
**Branch:** Follow branch pattern from current work
**Estimated Tokens:** ~8K
**Priority:** MEDIUM

---

## Objective

Prevent backup cleanup when attachment persistence fails midway, enabling users to retry extraction without requiring a full re-sync of the iPhone backup.

---

## Context

**Current Implementation (Issue):**
- Backup is cleaned up even if `storeAttachments()` or subsequent persistence fails
- Files are deleted from storage before confirmation that persistence succeeded
- If persistence fails midway, user cannot retry extraction
- User must re-sync entire iPhone backup to re-attempt attachment import

**Impact:**
- Bad user experience: forces full re-sync when persistence has issues
- Wasted bandwidth and time
- Risk of data loss if cleanup happens before persistence is verified

**SR Engineer Recommendation:**
"Only cleanup on full success, or add 'retry from backup' option"

---

## Requirements

### Must Do:
1. Only cleanup backup files after successful persistence confirmation
2. OR add option for user to retry extraction from existing backup without re-sync
3. Verify cleanup happens AFTER all attachments written to storage

### Must NOT Do:
- Delete backup before persistence is complete
- Break existing backup cleanup for successful imports
- Add excessive complexity or UI changes

---

## Acceptance Criteria

- [ ] Backup cleanup only occurs after successful persistence
- [ ] If persistence fails, backup remains available for retry
- [ ] User can retry without full re-sync (implementation choice: auto-retry or manual "retry" button)
- [ ] All existing tests pass
- [ ] No regressions in successful import cleanup

---

## Files to Modify

- `electron/sync-handlers.ts` (lines 366-390 area)
- `electron/services/syncOrchestrator.ts` (cleanup orchestration)
- `electron/services/iPhoneSyncStorageService.ts` (if adding manual retry option)

## Files to Reference

- `electron/services/iPhoneSyncStorageService.ts` (understand persistence flow)
- Error handling patterns in sync pipeline

---

## Testing Expectations

### Manual Testing (Primary)
1. Simulate persistence failure (mock file write error)
2. Verify backup is NOT cleaned up
3. Attempt re-sync / retry
4. Verify extraction succeeds on retry
5. Verify cleanup happens only after full success

### Unit Tests
- **Recommended:** Mock persistence failure and verify cleanup skipped
- **Existing tests:** Must pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

---

## Technical Approach Options

### Option A: Move Cleanup to End of Persistence
```
1. Start sync → extract attachments → store in DB
2. ONLY THEN cleanup backup
3. If error occurs before cleanup → backup persists
```

### Option B: Add Retry Mechanism
```
1. If persistence fails → store error state
2. Add "Retry Attachment Import" option in UI
3. User can click retry to re-attempt from backup
4. Cleanup only after successful retry or user confirms to skip
```

### Recommended: Option A
- Simpler implementation
- Aligns with "single responsibility" principle
- Automatic solution (no UI change)

---

## PR Preparation

- **Title:** `fix(windows): only cleanup iPhone backup after successful persistence`
- **Target:** `develop`
- **Related PR:** #716 (SPRINT-068 original work)

---

## Guardrails

**STOP and ask PM if:**
- Solution requires significant UI changes
- Cannot determine persistence completion reliably
- Estimate exceeds 12K tokens

**OK to simplify if:**
- Option A sufficient (move cleanup to end)
- No need for manual retry UI option

---

## Implementation Status

**STATUS: PENDING**

Awaiting engineer assignment from PM. This is a direct SR Engineer follow-up recommendation from PR #716 review.

