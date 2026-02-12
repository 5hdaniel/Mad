# SPRINT-081: Sync UX & Settings Polish (Retroactive)

**Status:** Completed
**Created:** 2026-02-11
**Completed:** 2026-02-12
**Branch:** feature/sync-messages-toast-guidance
**Target:** develop (via PR)

---

## Sprint Goal

Track UX improvements and bug fixes made during the current session on branch `feature/sync-messages-toast-guidance`. All work was done inline (no formal agent workflow). Scope expanded during user testing to include auto-linking fixes and SyncStatusIndicator behavior change.

## Scope

### In Scope (Final)

| Backlog | Title | Category | Priority | Status |
|---------|-------|----------|----------|--------|
| BACKLOG-674 | Settings message import routes through SyncOrchestrator | enhancement | Medium | **Deferred** |
| BACKLOG-675 | Settings loading state spinner prevents flash of defaults | ui | Low | Completed |
| BACKLOG-676 | TransactionMessagesTab sync button shows toast guidance | ui | Low | Completed |
| BACKLOG-677 | Text message auto-linking inference gate removal and phone matching fix | fix | Medium | Completed |
| BACKLOG-678 | Summary sync button runs auto-link for phone-only contacts | fix | Medium | Completed |
| BACKLOG-679 | SyncStatusIndicator auto-dismiss removed -- manual dismiss only | enhancement | Low | Completed |

**Completed:** 5 of 6 items
**Deferred:** 1 item (BACKLOG-674)

### Out of Scope

- Force Re-import and cap-override flows (remain direct IPC, intentionally)
- Email sync orchestrator changes
- Any backend/main process changes

---

## Item Details

### BACKLOG-674: Settings Message Import via SyncOrchestrator -- DEFERRED

**Status:** Deferred (reverted)
**Reason:** "Import already in progress" error during testing. The orchestrator routing was reverted. Needs further investigation into why the orchestrator rejects the request.

**Original change:** Routed Settings "Import Messages" button through `useSyncOrchestrator().requestSync()` instead of direct IPC, plus extended SyncStatusIndicator auto-dismiss from 5s to 15s.

**Outcome:** Reverted to direct IPC. Moved back to Pending in backlog for future sprint.

### BACKLOG-675: Settings Loading State Spinner -- COMPLETED

**File:** `src/components/Settings.tsx`

Settings now shows a centered spinner with "Loading settings..." text while preferences load asynchronously. This prevents the flash of default/hardcoded values (scanLookback=9, autoSync=true, exportFormat="pdf", etc.) that appeared before saved values loaded.

**Testing result:** Passed user testing with no additional changes needed.

### BACKLOG-676: TransactionMessagesTab Toast Guidance (Scope Expanded) -- COMPLETED

**Files:** `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx`, `src/components/TransactionDetails.tsx`

**Original plan:** Show a toast guiding users to Settings for macOS Messages import.

**Actual implementation (expanded scope):** The "Sync Messages" button was incorrectly calling `handleSyncCommunications` (the email fetch handler via `syncAndFetchEmails`), which showed "No contact emails found, running local auto-link only". This was misleading for message sync.

**Fix applied:**
- Created a NEW separate `handleSyncMessages` handler in `TransactionDetails.tsx` that calls `resyncAutoLink` (phone + email based matching, no provider fetch)
- Added separate `syncingMessages` state so it does not interfere with email sync
- Shows message-appropriate toasts:
  - "X message threads linked" (success with results)
  - "No contacts assigned" (when transaction has no contacts to match against)
  - "No new messages found" (when matching runs but finds nothing new)
- `TransactionMessagesTab` now calls `onSyncMessages` (the new handler) instead of `onSyncCommunications`

### BACKLOG-677: Text Message Auto-Linking Fix -- COMPLETED

**File:** `src/services/autoLinkService.ts`

**Problem:** Text messages were not being auto-linked because an inference gate blocked matching, and phone number matching logic had a bug.

**Fix applied:**
- Removed the inference gate that prevented auto-linking from running
- Fixed phone number matching to correctly identify contacts

### BACKLOG-678: Summary Sync Button Auto-Links Phone-Only Contacts -- COMPLETED

**File:** `src/main/transaction-handlers.ts`

**Problem:** The summary sync button did not trigger auto-link for contacts that only had phone numbers (no email). This meant text message threads were not linked when using the sync button.

**Fix applied:**
- Updated transaction-handlers.ts so the summary sync operation also runs auto-link for phone-only contacts

### BACKLOG-679: SyncStatusIndicator Auto-Dismiss Removed -- COMPLETED

**File:** `src/components/dashboard/SyncStatusIndicator.tsx`

**Problem:** The SyncStatusIndicator auto-dismissed on a timer, which meant users could miss sync status information (especially when returning from a modal like Settings).

**Fix applied:**
- Removed the auto-dismiss timer entirely
- Users now dismiss the indicator manually
- This replaces the earlier attempt (in BACKLOG-674) to extend the timer from 5s to 15s -- manual dismiss is more reliable

---

## Files Modified (All Items)

| File | Backlog | Change Summary |
|------|---------|----------------|
| `src/components/Settings.tsx` | BACKLOG-675 | Added loading spinner while preferences load |
| `src/components/TransactionDetails.tsx` | BACKLOG-676 | New `handleSyncMessages` handler + `syncingMessages` state |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | BACKLOG-676 | Wired to new `onSyncMessages` prop |
| `src/services/autoLinkService.ts` | BACKLOG-677 | Removed inference gate; fixed phone matching logic |
| `src/main/transaction-handlers.ts` | BACKLOG-678 | Summary sync triggers auto-link for phone-only contacts |
| `src/components/dashboard/SyncStatusIndicator.tsx` | BACKLOG-679 | Removed auto-dismiss timer (manual dismiss only) |

**Note:** BACKLOG-674 changes were reverted (Settings import orchestrator routing + original auto-dismiss timer extension).

## Progress Tracking

| Backlog | Status | Notes |
|---------|--------|-------|
| BACKLOG-674 | Deferred | Reverted -- "Import already in progress" error; needs investigation |
| BACKLOG-675 | Completed | User-tested and confirmed |
| BACKLOG-676 | Completed | User-tested and confirmed; scope expanded from toast to full handler rewrite |
| BACKLOG-677 | Completed | User-tested and confirmed; inference gate removal + phone matching fix |
| BACKLOG-678 | Completed | User-tested and confirmed; summary sync now auto-links phone-only contacts |
| BACKLOG-679 | Completed | User-tested and confirmed; manual dismiss replaces auto-dismiss timer |

---

## Validation Checklist (End of Sprint)

- [ ] ~~Settings "Import Messages" triggers SyncOrchestrator~~ (DEFERRED -- reverted)
- [x] Settings shows spinner while preferences load (no flash of defaults)
- [x] TransactionMessagesTab "Sync Messages" shows a helpful toast instead of doing nothing
- [x] Text message auto-linking works (inference gate removed, phone matching fixed)
- [x] Summary sync button auto-links phone-only contacts
- [x] SyncStatusIndicator requires manual dismiss (no auto-dismiss)
- [ ] All changes committed and PR created
- [ ] CI passes
- [ ] PR merged to develop
