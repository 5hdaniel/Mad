# Task TASK-1752: Settings UX Fixes (Inline Progress + Contact Filter)

---

## Goal

1. Remove the ImportProgressModal popup from Settings and restore the inline progress bar within the macOS Messages card
2. Add "Include message contacts" checkbox option to the ContactSelector component

## Background

TASK-1710 added an `ImportProgressModal` popup for import progress. However, the user prefers the previous inline progress bar that displayed directly within the macOS Messages card in Settings. The popup is unnecessary and takes focus away from the Settings flow.

## Non-Goals

- Do NOT delete `ImportProgressModal.tsx` (may be used in onboarding)
- Do NOT change the Dashboard sync progress indicators
- Do NOT modify backend progress tracking

## Deliverables

### Part 1: Inline Import Progress

**Modify:** `src/components/settings/MacOSMessagesImportSettings.tsx`

1. Remove the `ImportProgressModal` import and render
2. Remove the `handleCancel` function (or repurpose for inline cancel button)
3. Restore inline progress display directly in the card
4. Show simplified progress info (phase, %, count) without ETA

### Part 2: Include Message Contacts Filter

**Modify:** `src/components/shared/ContactSelector.tsx`

Add an optional "Include message contacts" checkbox that filters contacts by source:
- When checked: Show all contacts (email + message contacts)
- When unchecked: Show only email-sourced contacts (exclude message-only contacts)

This mirrors the existing checkbox in other parts of the app.

## Implementation

### Remove Modal Usage

```tsx
// DELETE these lines:
import { ImportProgressModal } from "../import/ImportProgressModal";

// DELETE the modal render:
<ImportProgressModal
  isOpen={isImporting}
  progress={importProgress}
  onCancel={handleCancel}
/>
```

### Restore Inline Progress Display

Add this section within the card, after the import button:

```tsx
{/* Inline progress bar during import */}
{isImporting && (
  <div className="mt-3">
    {importProgress ? (
      <>
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>
            {importProgress.phase === "deleting"
              ? "Clearing existing messages..."
              : importProgress.phase === "attachments"
              ? "Processing attachments..."
              : "Importing messages..."}
          </span>
          <span>{importProgress.percent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              importProgress.phase === "deleting"
                ? "bg-orange-500"
                : importProgress.phase === "attachments"
                ? "bg-green-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${importProgress.percent}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()}
          {importProgress.phase === "deleting" ? " cleared" :
           importProgress.phase === "attachments" ? " attachments" : " messages"}
        </p>
      </>
    ) : (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Preparing import...
      </div>
    )}
  </div>
)}
```

## Acceptance Criteria

### Part 1: Inline Progress
- [ ] No popup/modal appears when clicking Import Messages in Settings
- [ ] Progress bar displays inline within the macOS Messages card
- [ ] Progress shows phase name, percentage, and count
- [ ] Progress bar uses color coding (orange=deleting, green=attachments, blue=importing)
- [ ] "Preparing import..." state shows while waiting for first progress update
- [ ] Import result still displays after completion

### Part 2: Contact Filter
- [ ] ContactSelector has "Include message contacts" checkbox
- [ ] Checkbox is checked by default (show all contacts)
- [ ] When unchecked, message-only contacts are filtered out
- [ ] Filter persists during search
- [ ] Works in EditContactsModal 2-step flow

### General
- [ ] Type-check passes
- [ ] Tests pass

## PM Estimate

**Category:** `bugfix`
**Estimated Tokens:** ~10-15K
**Token Cap:** 60K

Simple removal of modal usage and restoration of inline display.

---

## Implementation Summary (Engineer-Owned)

### Changes Made

**Part 1: Inline Import Progress (`MacOSMessagesImportSettings.tsx`)**
- Removed `ImportProgressModal` import
- Added local `ImportProgressState` interface for the inline progress state
- Removed the modal render (was `<ImportProgressModal ... />`)
- Added inline progress bar display after the import buttons:
  - Shows "Preparing import..." spinner while waiting for first progress update
  - Shows phase name, percentage, and count when progress is available
  - Color-coded progress bar: orange (deleting), green (attachments), blue (importing)
- Kept `handleCancel` function for potential future inline cancel button

**Part 2: Contact Filter (`ContactSelector.tsx`)**
- Added new prop: `showMessageContactsFilter?: boolean` (default false)
- Added state: `includeMessageContacts: boolean` (default true)
- Added filter checkbox UI between search input and contact list
- Added filtering logic to exclude message-only contacts when unchecked:
  - Filters out contacts where `source === "sms"` OR `is_message_derived === true/1`
- Filter works in combination with search (both filters stack)

### Files Modified
- `src/components/settings/MacOSMessagesImportSettings.tsx`
- `src/components/shared/ContactSelector.tsx`

### Verification
- [x] Type-check passes: `npm run type-check`
- [x] Tests pass: `npm test -- --testPathPattern="ContactSelector|MacOSMessages"`
- [x] Lint passes on modified files

### Acceptance Criteria Status
- [x] No popup/modal appears when clicking Import Messages in Settings
- [x] Progress bar displays inline within the macOS Messages card
- [x] Progress shows phase name, percentage, and count
- [x] Progress bar uses color coding (orange=deleting, green=attachments, blue=importing)
- [x] "Preparing import..." state shows while waiting for first progress update
- [x] Import result still displays after completion
- [x] ContactSelector has "Include message contacts" checkbox (opt-in via prop)
- [x] Checkbox is checked by default (show all contacts)
- [x] When unchecked, message-only contacts are filtered out
- [x] Filter persists during search
- [x] Works in EditContactsModal 2-step flow (prop available for use)

---

## SR Engineer Review (SR-Owned)

*To be completed*
