# SPRINT-081: Sync UX & Settings Polish (Retroactive)

**Status:** Completed
**Created:** 2026-02-11
**Completed:** 2026-02-11
**Branch:** feature/sync-messages-toast-guidance
**Target:** develop (via PR)

---

## Sprint Goal

Track three small UX improvements made during the current session on branch `feature/sync-messages-toast-guidance`. All work was done inline (no formal agent workflow) and is uncommitted on the branch.

## Scope

### In Scope

| Backlog | Title | Category | Priority | Est. Tokens |
|---------|-------|----------|----------|-------------|
| BACKLOG-674 | Settings message import routes through SyncOrchestrator | enhancement | Medium | ~5K |
| BACKLOG-675 | Settings loading state spinner prevents flash of defaults | ui | Low | ~3K |
| BACKLOG-676 | TransactionMessagesTab sync button shows toast guidance | ui | Low | ~5K |

**Total estimated:** ~13K tokens

### Out of Scope

- Force Re-import and cap-override flows (remain direct IPC, intentionally)
- Email sync orchestrator changes
- Any backend/main process changes

---

## Item Details

### BACKLOG-674: Settings Message Import via SyncOrchestrator

**Files:** `src/components/settings/MacOSMessagesImportSettings.tsx`, `src/components/dashboard/SyncStatusIndicator.tsx`

The normal "Import Messages" button in Settings now routes through `useSyncOrchestrator().requestSync()` instead of direct IPC. This means when the user closes Settings, the dashboard shows import progress (the SyncProgress bar picks it up). Force Re-import and cap-override still use direct IPC (inline in Settings). This mirrors the pattern already established in `MacOSContactsImportSettings`.

**Additional fixes during testing:**
- Added `console.log` for debugging orchestrator `requestSync` result
- Extended `SyncStatusIndicator` auto-dismiss timeout from 5s to 15s -- when a fast incremental import completes while the Settings modal still covers the dashboard, the original 5s was too short for the user to see the progress bar after closing Settings

### BACKLOG-675: Settings Loading State Spinner

**File:** `src/components/Settings.tsx`

Settings now shows a centered spinner with "Loading settings..." text while preferences load asynchronously. This prevents the flash of default/hardcoded values (scanLookback=9, autoSync=true, exportFormat="pdf", etc.) that appeared before saved values loaded.

**Testing result:** Passed user testing with no additional changes needed.

### BACKLOG-676: TransactionMessagesTab Toast Guidance (Scope Expanded)

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

---

## Files Modified (All Items)

| File | Backlog | Change Summary |
|------|---------|----------------|
| `src/components/settings/MacOSMessagesImportSettings.tsx` | BACKLOG-674 | Route normal import through SyncOrchestrator |
| `src/components/dashboard/SyncStatusIndicator.tsx` | BACKLOG-674 | Extended auto-dismiss timeout from 5s to 15s |
| `src/components/Settings.tsx` | BACKLOG-675 | Added loading spinner while preferences load |
| `src/components/TransactionDetails.tsx` | BACKLOG-676 | New `handleSyncMessages` handler + `syncingMessages` state |
| `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` | BACKLOG-676 | Wired to new `onSyncMessages` prop |

## Progress Tracking

| Backlog | Status | Notes |
|---------|--------|-------|
| BACKLOG-674 | Completed | Uncommitted; additional fix: SyncStatusIndicator timeout 5s->15s |
| BACKLOG-675 | Completed | Uncommitted; passed user testing, no further changes |
| BACKLOG-676 | Completed | Uncommitted; scope expanded -- new handler + separate state |

---

## Validation Checklist (End of Sprint)

- [x] Settings "Import Messages" triggers SyncOrchestrator (dashboard shows progress after closing Settings)
- [x] Settings shows spinner while preferences load (no flash of defaults)
- [x] TransactionMessagesTab "Sync Messages" shows a helpful toast instead of doing nothing
- [ ] All changes committed and PR created
- [ ] CI passes
- [ ] PR merged to develop
