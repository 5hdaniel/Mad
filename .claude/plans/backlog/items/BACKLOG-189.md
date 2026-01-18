# BACKLOG-189: Configurable Attachment Size Limit

**Created**: 2026-01-10
**Priority**: Low
**Category**: enhancement
**Status**: Pending

---

## Description

Make the maximum attachment size limit configurable in Settings instead of hardcoded at 50MB.

## Current Behavior

- `MAX_ATTACHMENT_SIZE` is hardcoded to 50MB in `macOSMessagesImportService.ts:61`
- Attachments over 50MB are skipped with a warning
- User has no control over this limit

## Expected Behavior

- Settings should include "Max Attachment Size" option
- Options: 50MB, 100MB, 200MB, 500MB, Unlimited
- Preference stored in Supabase user_preferences
- Import service reads from preferences

## Technical Notes

### Files to Modify

1. **Settings.tsx** - Add attachment size dropdown
2. **preference-handlers.ts** - Handle `attachments.maxSizeMB` preference
3. **macOSMessagesImportService.ts** - Read limit from preferences instead of constant

### Default Value

Keep 50MB as default for new users.

## Acceptance Criteria

- [ ] Settings shows max attachment size dropdown
- [ ] Changing setting persists to Supabase
- [ ] Import respects the configured limit
- [ ] "Unlimited" option works (no size check)

## Estimated Tokens

~8,000

---

## Notes

Reported during SPRINT-029 session. User had 51MB attachments being skipped.
