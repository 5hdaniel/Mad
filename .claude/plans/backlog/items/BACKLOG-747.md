# BACKLOG-747: Mask iCloud Email Identifier in 1:1 Chat Exports

**Created**: 2026-02-20
**Priority**: Medium
**Category**: UI
**Status**: Pending

---

## Description

When a contact uses an Apple ID (iCloud email address) instead of a phone number for iMessage, the raw iCloud email is shown as the contact identifier in 1:1 chat exports. In a real estate audit context this is a privacy concern — the auditor needs to know who the conversation is with and that it was via iMessage/iCloud, but they do not need to see the contact's personal email address.

**Current behavior (iCloud email contact):**
```
Madison Jan 6, 2026, 02:05 PM
madison.jones@icloud.com
```

**Desired behavior:**
```
Madison Jan 6, 2026, 02:05 PM
(via iCloud email)
```

Phone number contacts are unaffected — the goal is specifically to suppress personal iCloud/Apple ID email addresses.

## Scope

- Applies to **1:1 chat exports only** (PDF and any text/folder export formats)
- Group chats: the same masking should apply to iCloud-email identifiers in the sender line, but group chat handling may need a separate review
- Detection: an identifier should be treated as an iCloud email if it contains `@` (i.e., is an email address rather than a phone number)
- iCloud domains to be aware of: `icloud.com`, `me.com`, `mac.com` — but a general `@` check is sufficient since any email-format identifier from iMessage is an Apple ID

## Acceptance Criteria

- [ ] 1:1 exports: when the contact's iMessage handle is an email address, the handle is NOT shown in the export
- [ ] 1:1 exports: "(via iCloud email)" is shown in place of the raw email address
- [ ] 1:1 exports: phone-number handles continue to display as before (no change)
- [ ] Contact name still displays for all messages
- [ ] PDF export format updated
- [ ] Folder/text export format updated (if applicable)
- [ ] Group chats: iCloud email identifiers in sender attribution are masked the same way (stretch — confirm scope at implementation)

## Technical Notes

- The iMessage handle/identifier is stored on the contact or on the chat participant record; check `macOSMessagesImportService.ts` and `conversationHandlers.ts` for where the identifier flows into export rendering
- Export entry points to check: `folderExportService.ts`, `pdfExportService.ts`
- Detection logic: `identifier.includes('@')` is a reliable heuristic since phone numbers in this context are stored as `+1XXXXXXXXXX` format
- Related completed work: BACKLOG-354 removed phone numbers from under each message in 1:1 exports (same area of the codebase)
- Related completed work: BACKLOG-306 hid phone/email in the contact selection modal (different component)

## Estimated Effort

~10K tokens (small targeted change in export service + PDF renderer; needs detection logic + label substitution)

## Priority Rationale

Medium — privacy-sensitive output visible to third parties (auditors, clients). Not a data breach risk since data stays local, but shows personal email addresses in formal audit reports unnecessarily.

## Related

- `folderExportService.ts`
- `pdfExportService.ts`
- `conversationHandlers.ts`
- `macOSMessagesImportService.ts`
- BACKLOG-354: Remove Phone Number Under Each Text in 1:1 Chat Exports (same area)
- BACKLOG-306: Hide Phone/Email in Contact Selection Modal (completed — different component)
- BACKLOG-236: Fix Incomplete PII Masking in LLM Pipeline (completed — different context)
