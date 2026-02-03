# TASK-1789: Extract User Account from iPhone Backup

**Backlog ID:** BACKLOG-592
**Sprint:** SPRINT-068
**Phase:** Phase 4 - Polish
**Branch:** `sprint/SPRINT-068-windows-ios-contacts` (existing PR #716)
**Estimated Tokens:** ~10K
**Priority:** LOW (can be deferred if sprint runs long)

---

## Objective

Replace the hardcoded "me" sender identifier with the actual user phone number or Apple ID extracted from the iPhone backup.

---

## Context

**macOS behavior:**
- Reads `account_login` from chat.db
- Uses actual phone number or Apple ID for user's sent messages
- User's messages display with correct identifier

**Windows current state:**
- Hardcodes "me" string for all outbound messages
- Generic sender label instead of actual identifier
- Cosmetic inconsistency with macOS

---

## Requirements

### Must Do:
1. Find user's phone/Apple ID in iPhone backup data
2. Use this identifier instead of hardcoded "me"
3. Apply consistently to all user's sent messages

### Must NOT Do:
- Break message direction detection (is_from_me logic)
- Spend excessive time on this low-priority task
- Block higher priority tasks

---

## Acceptance Criteria

- [ ] User's sent messages show actual phone number or Apple ID
- [ ] Matches macOS display behavior
- [ ] Direction detection (is_from_me) still works correctly
- [ ] Existing tests pass

---

## Files to Modify

- `electron/services/iPhoneSyncStorageService.ts`

## Files to Reference

- macOS `account_login` extraction logic
- iPhone backup structure for user account info

---

## Testing Expectations

### Manual Testing (Primary)
1. Import iPhone backup
2. View a conversation with sent messages
3. Verify sent messages show user's phone number, not "me"

### Unit Tests
- **Required:** No, low priority task
- **Existing tests:** Must pass

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes

---

## Technical Notes

### Potential Sources for User Account

1. **Backup manifest** - May contain Apple ID
2. **Chat database** - `account_login` column in certain tables
3. **Preferences plist** - User's phone number settings

### Fallback Behavior

If user account cannot be extracted, fall back to "me" to avoid breaking the import.

---

## PR Preparation

- **Title:** `fix(windows): extract user account from iPhone backup`
- **Branch:** `sprint/SPRINT-068-windows-ios-contacts`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**STATUS: DEFERRED**

*Deferred: 2026-02-02*

### Reason for Deferral

This is a low-priority cosmetic issue. The sprint focused on fixing critical functionality:
- Auto-link messages (TASK-1785) - COMPLETED
- Group chat sender names (TASK-1786) - COMPLETED
- participants_flat fix (TASK-1787) - COMPLETED
- Attachment extraction (TASK-1788) - COMPLETED

The "me" sender identifier is a cosmetic display issue that does not affect functionality. All core features are now working. This task is deferred to a future sprint.

### Notes

- Messages are correctly marked as sent (is_from_me = 1)
- Direction detection works correctly
- Only the display label shows "me" instead of user's phone number
- Does not affect user's ability to audit transactions

---

## Guardrails

**STOP and ask PM if:**
- Cannot find user account in backup structure
- Would require significant refactoring
- Estimate exceeds 15K tokens

**OK to defer if:**
- Higher priority tasks (1785-1788) taking longer than expected
- Sprint budget running low
