# BACKLOG-748: Merge Duplicate 1:1 Chats (iCloud Email vs Phone Number for Same Contact)

**Created**: 2026-02-20
**Priority**: Medium
**Area**: service + ui
**Status**: Pending

---

## Description

When a contact uses both a phone number and an iCloud email address interchangeably for iMessage, the app imports them as two separate 1:1 conversation threads. The auditor sees what appears to be two distinct contacts or two duplicated conversations, when in reality it is one person and one ongoing conversation thread.

**Example — current behavior:**

| Conversation list entry | Handle |
|-------------------------|--------|
| Madison (1:1) | +15551234567 |
| Madison (1:1) | madison.jones@icloud.com |

Both rows refer to the same contact. The auditor must manually recognize and reconcile them.

**Desired behavior:**

A single unified "Madison (1:1)" thread containing all messages regardless of which handle the contact used at send time.

---

## Scope

- **Settings UI**: add a toggle/option (e.g., under Contacts or Import settings) allowing the user to enable "Merge iCloud email and phone number threads for the same contact"
- **Service layer**: when the setting is enabled, at import or display time, detect and merge 1:1 conversation threads that share the same resolved contact but differ only in handle format (email vs phone)
- **Conversation list**: merged thread shows as a single entry with the contact's name
- **Conversation view**: messages from both handles appear in chronological order in one unified view
- **Export**: merged thread is exported as a single conversation
- Out of scope: group chats (handle merging in group contexts is more complex and lower value)
- Out of scope: contacts where no phone-number match exists for the iCloud email handle (no merge candidate)

---

## Acceptance Criteria

- [ ] Settings: a user-facing toggle exists to enable/disable iCloud email + phone number thread merging
- [ ] When enabled: 1:1 threads that resolve to the same contact (one via phone, one via iCloud email) are merged into a single entry in the conversation list
- [ ] Merged thread: messages from both handles appear in chronological order in the unified thread
- [ ] Merged thread: exported (PDF, folder) as one conversation, not two
- [ ] When disabled: behavior is unchanged from current (two separate threads shown)
- [ ] No contact with only one handle type is affected
- [ ] No group chats are affected
- [ ] Setting persists across app restarts

---

## Technical Notes

- Contact matching: use the existing contact resolution logic (probably in `macOSMessagesImportService.ts` or `contactHandlers.ts`) to determine whether two handles map to the same contact record
- Merging strategy options: (a) merge at import time before storing threads, or (b) merge at display/query time as a virtual thread — implementation team to decide; display-time merging is lower risk since it doesn't alter stored data
- Handle format detection: `identifier.includes('@')` reliably identifies iCloud email handles vs phone number handles (stored as `+1XXXXXXXXXX`)
- Setting storage: follow existing settings persistence pattern (likely `userPreferences` or the settings service)
- Related service files to investigate: `macOSMessagesImportService.ts`, `conversationHandlers.ts`, `contactHandlers.ts`

---

## Estimated Effort

~40K tokens — moderate complexity: settings UI toggle, contact-resolution lookup, thread merge logic, conversation list display update, export integration. Display-time merge approach would be closer to the lower end; import-time merge would be higher.

---

## Priority Rationale

Medium — the duplicate threads are confusing in an audit context (auditor may assume they are missing messages or reviewing a different person). Not a data-loss risk, but creates meaningful UX friction and audit accuracy concerns. Lower urgency than critical data issues.

---

## Related

- BACKLOG-747: Mask iCloud Email Identifier in 1:1 Chat Exports — sibling item; both deal with the iCloud-email-vs-phone duality. BACKLOG-747 handles the export display side; this item handles the conversation import/list side.
- BACKLOG-514: Fix thread deduplication during message import — related but distinct. BACKLOG-514 addresses threads with different `thread_id`s due to import logic errors; this item addresses threads that are genuinely separate because the contact used two different handles.
- BACKLOG-068: Contact Deduplication — related; contact matching logic may be reusable here.
- `macOSMessagesImportService.ts`
- `conversationHandlers.ts`
- `contactHandlers.ts`
