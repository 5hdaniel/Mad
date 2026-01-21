# TASK-1156: Redesign Text Conversation Cards (Date Range, No Preview)

**Backlog ID:** BACKLOG-356
**Sprint:** SPRINT-048
**Phase:** 2 (Track C - Transaction Details, After TASK-1152)
**Branch:** `feature/task-1156-text-card-redesign`
**Estimated Turns:** 6-10
**Estimated Tokens:** 15K-22K

---

## Objective

Redesign the Text Conversation cards in the transaction details view to be cleaner and more informative. Remove the message preview, add date range, and update the button styling.

---

## Context

**Current card design:**
```
GianCarlo
+14243335133
75 messages
"Last message preview text..."
[View]
```

**Expected card design:**
```
GianCarlo (+14243335133)    Jan 1, 2026 - Jan 6, 2026    View Full ->
```

The current design shows too much information that isn't useful at a glance. Users care about who the conversation is with and what time period it covers, not the last message preview.

---

## Requirements

### Must Do:
1. Remove last message preview text
2. Remove message count (can keep in detail or remove entirely)
3. Put phone number inline with name in parentheses
4. Add date range showing first to last message dates
5. Update "View" button to "View Full ->"

### Must NOT Do:
- Change the ConversationViewModal (that's TASK-1157)
- Modify how threads are grouped
- Change the click behavior

---

## Acceptance Criteria

- [ ] Contact name with phone in parentheses on same line
- [ ] Date range (first message - last message) displayed
- [ ] No message preview text
- [ ] No message count visible (or minimal)
- [ ] "View Full ->" button styling

---

## Files to Modify

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` - Card layout redesign (lines 206-380)

## Files to Read (for context)

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` - Current implementation (523 lines)
- `src/components/transactionDetailsModule/components/TransactionMessagesTab.tsx` - How cards are used

---

## Technical Notes

### Current Card Layout (lines 243-365)
```tsx
<div className="bg-gray-50 px-4 py-3 flex items-center gap-3">
  {/* Avatar */}
  {/* Contact name/info */}
  {/* Preview text */}
  {/* View button + Unlink button */}
</div>
```

### Target Card Layout
```tsx
<div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
  <div className="flex items-center gap-2">
    {/* Avatar (keep) */}
    <span className="font-semibold">
      {contactName}
      <span className="font-normal text-gray-500 text-sm ml-1">
        ({phoneNumber})
      </span>
    </span>
  </div>
  <div className="flex items-center gap-4">
    <span className="text-sm text-gray-500">
      {firstDate} - {lastDate}
    </span>
    <button className="text-blue-600 hover:text-blue-800">
      View Full ->
    </button>
    {/* Unlink button if needed */}
  </div>
</div>
```

### Date Range Helper (already exists)
```tsx
const getDateRange = (): string => {
  if (messages.length === 0) return "";
  const first = messages[0];
  const last = messages[messages.length - 1];
  const firstDate = new Date(first.sent_at || first.received_at || 0);
  const lastDate = new Date(last.sent_at || last.received_at || 0);
  // Format and return
};
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes - Update existing MessageThreadCard tests
- **Existing tests to update:** `MessageThreadCard.test.tsx` - Update snapshots/assertions

### Manual Testing
- [ ] View Messages tab - cards show new layout
- [ ] Verify name (phone) format
- [ ] Verify date range shows correctly
- [ ] Verify no preview text visible
- [ ] Click "View Full ->" - modal opens correctly

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(ui): redesign text conversation cards with date range`
- **Branch:** `feature/task-1156-text-card-redesign`
- **Target:** `int/sprint-ui-export-and-details`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from int/sprint-ui-export-and-details
- [ ] Noted start time: ___
- [ ] Read task file completely

Implementation:
- [ ] Code complete
- [ ] Tests pass locally (npm test)
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics (see template)
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified for next task
```

### Results

- **Before**: Cards show preview text, message count, multi-line layout
- **After**: Cards show name(phone), date range, compact single line
- **Actual Turns**: X (Est: 6-10)
- **Actual Tokens**: ~XK (Est: 15-22K)
- **Actual Time**: X min
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- TASK-1152 is not yet merged (tab reorganization)
- Existing tests fail significantly
- You need to modify thread grouping logic
- You encounter blockers not covered in the task file
