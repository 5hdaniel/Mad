# TASK-1787: Update participants_flat for All Group Members

**Backlog ID:** BACKLOG-591
**Sprint:** SPRINT-068
**Phase:** Phase 2 - Group Chat Support
**Branch:** `sprint/SPRINT-068-windows-ios-contacts` (existing PR #716)
**Estimated Tokens:** ~15K

---

## Objective

Update the Windows import to populate `participants_flat` with ALL group members (comma-separated), not just the direct sender's digits. This enables auto-linking for group chat participants.

---

## Context

**Current Windows behavior (`iPhoneSyncStorageService.ts` lines 278-281):**
```typescript
participants_flat: sender.replace(/\D/g, '') // Only sender's digits
```

**macOS behavior (`macOSMessagesImportService.ts` lines 884-900):**
```typescript
participants_flat: allMembers.map(m => m.replace(/\D/g, '')).join(',') // All members
```

This causes group chat messages to fail auto-linking for participants other than the sender.

---

## Requirements

### Must Do:
1. Collect all group member phone numbers during import
2. Format as comma-separated digits (matching macOS)
3. Store in `participants_flat` column

### Must NOT Do:
- Change format that would break existing macOS data
- Break auto-link query logic (just fix the data)
- Skip 1:1 conversations (they should continue to work)

---

## Acceptance Criteria

- [ ] `participants_flat` contains comma-separated digits for all group members
- [ ] Format matches: `"5551234567,5559876543,5555555555"`
- [ ] Auto-link works for any group member's contact
- [ ] 1:1 conversations continue to work (single number)
- [ ] Existing tests pass

---

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts` (lines 278-281)

## Files to Reference

- `electron/services/macOSMessagesImportService.ts` (lines 884-900)

---

## Testing Expectations

### Manual Testing (Primary)
1. Import iPhone backup with group chat
2. Query database: `SELECT participants_flat FROM communications WHERE is_group = 1 LIMIT 5`
3. Verify comma-separated format
4. Create transaction with one group member
5. Verify auto-link includes group messages

### Unit Tests
- **Required:** No new tests needed if reusing existing logic
- **Existing tests:** Must pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Implementation Notes

This task likely shares code with TASK-1786 (group chat members). Consider implementing together since both require parsing group member list from iPhone backup.

**Coordination with TASK-1786:**
- TASK-1786 populates `chat_members` in JSON for UI display
- TASK-1787 populates `participants_flat` for auto-link queries
- Same source data, different destination columns

---

## PR Preparation

- **Title:** `fix(windows): include all group members in participants_flat`
- **Branch:** `sprint/SPRINT-068-windows-ios-contacts`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**STATUS: COMPLETED**

*Completed: 2026-02-02*

### Results

- **Before**: participants_flat: NULL or sender only
- **After**: participants_flat: properly populated with comma-separated phone digits
- **Actual Tokens**: Covered by main TASK-1785 fix

### Notes

**Finding:** This task was resolved as part of the main participants_flat fix in TASK-1785. The changes to `iPhoneSyncStorageService` ensured that `participants_flat` is properly populated during message persistence. The migration 27c backfilled existing messages.

The participants_flat column now contains comma-separated phone number digits for all participants, enabling auto-link to work correctly for group chat messages.

---

## Guardrails

**STOP and ask PM if:**
- Cannot parse group member list from iPhone backup
- Auto-link query logic needs modification (not just data)
- Changes would affect macOS data format
