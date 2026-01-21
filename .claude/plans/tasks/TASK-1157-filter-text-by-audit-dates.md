# TASK-1157: Filter Text Preview by Audit Dates with Toggle

**Backlog ID:** BACKLOG-357
**Sprint:** SPRINT-048
**Phase:** 3 (Track C - Transaction Details, After TASK-1156)
**Branch:** `feature/task-1157-filter-text-dates`
**Estimated Turns:** 8-12
**Estimated Tokens:** 18K-26K

---

## Objective

When viewing the preview of a text conversation, by default only show messages that fall within the transaction's audit date range. Provide a toggle to allow viewing the entire conversation history if needed.

---

## Context

Text conversations often span years, but the audit only covers a specific period. Users need to:
1. Focus on messages within the audit period by default
2. Optionally see the full conversation for context
3. Understand how many messages are filtered out

**Expected UI:**
```
+---------------------------------------------+
| Conversation with GianCarlo                 |
| [x] Show audit period only (Jan 1 - Jan 6)  |
| Showing 15 of 75 messages                   |
+---------------------------------------------+
| [Messages within date range...]             |
+---------------------------------------------+
```

---

## Requirements

### Must Do:
1. Add toggle: "Show audit period only" (checked by default)
2. Filter messages to transaction date range when toggle is on
3. Show count: "Showing X of Y messages" when filtered
4. Display date range in toggle label
5. Persist toggle state during session (not across sessions)
6. Use transaction `started_at` and `closed_at` for filtering

### Must NOT Do:
- Change the MessageThreadCard component (done in TASK-1156)
- Modify message storage or fetching logic
- Make the toggle state persist across app restarts

---

## Acceptance Criteria

- [ ] Default filter to transaction date range (toggle on)
- [ ] Toggle to show/hide full conversation
- [ ] Shows count of filtered vs total messages
- [ ] Date range displayed in toggle label
- [ ] Toggling works correctly and rerenders messages
- [ ] Messages outside range are hidden when toggle is on

---

## Files to Modify

- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Add filter toggle and logic

## Files to Read (for context)

- `src/components/transactionDetailsModule/components/modals/ConversationViewModal.tsx` - Current implementation (509 lines)
- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` - How messages are passed

---

## Technical Notes

### Transaction Dates
The ConversationViewModal needs access to transaction dates. Check if they're passed through props or need to be added.

### Filter Logic
```tsx
const [showAuditPeriodOnly, setShowAuditPeriodOnly] = useState(true);

// Get transaction dates from props or context
const startDate = transaction?.started_at ? new Date(transaction.started_at) : null;
const endDate = transaction?.closed_at ? new Date(transaction.closed_at) : null;

// Filter messages
const filteredMessages = useMemo(() => {
  if (!showAuditPeriodOnly || !startDate || !endDate) {
    return sortedMessages;
  }
  return sortedMessages.filter(msg => {
    const msgDate = new Date(msg.sent_at || msg.received_at || 0);
    return msgDate >= startDate && msgDate <= endDate;
  });
}, [sortedMessages, showAuditPeriodOnly, startDate, endDate]);
```

### Toggle UI
```tsx
<div className="bg-gray-100 px-4 py-2 flex items-center justify-between">
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={showAuditPeriodOnly}
      onChange={(e) => setShowAuditPeriodOnly(e.target.checked)}
      className="rounded text-green-500"
    />
    <span className="text-sm text-gray-700">
      Show audit period only ({formatDateRange(startDate, endDate)})
    </span>
  </label>
  <span className="text-xs text-gray-500">
    Showing {filteredMessages.length} of {sortedMessages.length} messages
  </span>
</div>
```

### Props Update
May need to add `transaction` prop to ConversationViewModal:
```tsx
interface ConversationViewModalProps {
  messages: MessageLike[];
  contactName?: string;
  phoneNumber: string;
  contactNames?: Record<string, string>;
  transaction?: Transaction;  // Add this
  onClose: () => void;
}
```

---

## Testing Expectations

### Unit Tests
- **Required:** Yes - Test filter logic
- **New tests to write:** Test message filtering by date range
- **Existing tests to update:** `ConversationViewModal.test.tsx`

### Manual Testing
- [ ] Open conversation modal - toggle is checked, messages filtered
- [ ] Verify "Showing X of Y" count is accurate
- [ ] Toggle off - all messages appear
- [ ] Toggle on - only audit period messages
- [ ] Test with no transaction dates (should show all)

### CI Requirements
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## PR Preparation

- **Title:** `feat(ui): add audit date filter toggle to conversation modal`
- **Branch:** `feature/task-1157-filter-text-dates`
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

- **Before**: Modal shows all messages, no filtering
- **After**: Modal filters by audit dates, toggle to show all
- **Actual Turns**: X (Est: 8-12)
- **Actual Tokens**: ~XK (Est: 18-26K)
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
- TASK-1152 and TASK-1156 are not yet merged
- Transaction object is not accessible in modal context
- You need to modify MessageThreadCard to pass transaction
- You encounter blockers not covered in the task file
