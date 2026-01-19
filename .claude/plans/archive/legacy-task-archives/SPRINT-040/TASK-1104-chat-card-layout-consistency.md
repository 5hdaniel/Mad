# TASK-1104: Chat Card Layout Consistency

**Backlog ID:** N/A (discovered during testing)
**Sprint:** SPRINT-040
**Phase:** 2 (UI Polish - Sequential, after TASK-1103)
**Branch:** `fix/task-1104-chat-card-layout-consistency`
**Estimated Tokens:** ~20K (targeted layout changes)
**Token Cap:** 80K (4x estimate)

---

## SR Engineer Pre-Implementation Review

**Review Date:** PENDING | **Status:** PENDING

### Branch Information
- **Branch From:** develop (after TASK-1103 merged)
- **Branch Into:** develop
- **Suggested Branch Name:** `fix/task-1104-chat-card-layout-consistency`

### Execution Classification
- **Parallel Safe:** No - modifies same file as TASK-1103
- **Depends On:** TASK-1103 (both modify MessageThreadCard.tsx)
- **Blocks:** None

### Shared File Analysis
- **Files Modified:** `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- **Conflicts With:** TASK-1103 (must run after 1103 merges)

### Technical Considerations

**Awaiting SR Engineer review before implementation.**

---

## Objective

Fix layout inconsistencies between individual and group chat cards in MessageThreadCard.tsx:

1. **Date range missing on individual chats** - Group chats show date range ("Jan 3 - Jan 9"), individual chats don't
2. **Message count badge position inconsistent** - Individual chats show badge on RIGHT (near View button), group chats show badge on LEFT (inline with title)

---

## Context

### Current State (as of develop)

**Individual Chat Card Layout:**
```
[Avatar] [Contact Name]                    [X messages badge] [View] [Unlink]
         [Phone Number]
         [Preview text...]
```

**Group Chat Card Layout:**
```
[Avatar] [Group Chat] [X people] [X messages]                 [View] [Unlink]
         [Participant names]
         [Jan 3 - Jan 9]
         [Preview text...]
```

### Issues

1. **Date Range:** Individual chats have no date range at all, but group chats do. This is inconsistent - users should see when a conversation spans multiple dates for both types.

2. **Message Count Badge Position:**
   - Individual: Badge is in the RIGHT column (flex-shrink-0 area with buttons)
   - Group: Badge is inline with title in the LEFT column (min-w-0 flex-1 area)

   This makes the cards look visually different and harder to scan.

### Goal

Make both card types have the same layout structure:
- Title row with badges (including message count)
- Subtitle info (phone/participants)
- Date range (if messages span multiple dates)
- Preview text

---

## Requirements

### Must Do:

1. **Add date range to individual chats:**
   - Use the existing `getDateRange()` function (already in component)
   - Display in same position as group chats (after phone number, before preview)
   - Only show if date range is meaningful (different dates, not empty)

2. **Move individual chat message badge to LEFT:**
   - Move badge from the right button area to inline with contact name
   - Match the position of the group chat message badge
   - Keep the green color for individual chats (vs gray for group)

3. **Preserve all existing functionality:**
   - View button still opens modal
   - Unlink button still works
   - Contact name resolution unchanged

### Target Layout (Both Card Types):

```
[Avatar] [Title] [Badge(s)]                                   [View] [Unlink]
         [Subtitle info]
         [Date range if applicable]
         [Preview text...]
```

### Must NOT Do:

- Do NOT change the component's prop interface
- Do NOT modify utility functions (getDateRange, getThreadParticipants, etc.)
- Do NOT change modal behavior
- Do NOT change badge colors (green for individual, gray for group messages)

---

## Acceptance Criteria

- [ ] Individual chats show date range (same position as group chats)
- [ ] Individual chat message badge is inline with contact name (LEFT side)
- [ ] Group chat layout unchanged (already correct position)
- [ ] Visual consistency between both card types
- [ ] View button works for both card types
- [ ] Unlink button works for both card types
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Files to Modify

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`

## Files to Read (for context)

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` - Current implementation
- `src/components/transactionDetailsModule/components/__tests__/MessageThreadCard.test.tsx` - Existing tests

---

## Implementation Notes

### Current Individual Chat Section (lines 261-289)

```tsx
) : (
  <>
    {/* 1:1 chat header */}
    <h4
      className="font-semibold text-gray-900 truncate"
      data-testid="thread-contact-name"
    >
      {contactName || phoneNumber}
    </h4>
    {contactName && phoneNumber && (
      <p
        className="text-sm text-gray-500 truncate"
        data-testid="thread-phone-number"
      >
        {phoneNumber}
      </p>
    )}
    {/* Preview of last message */}
    {previewText && (
      <p
        className="text-sm text-gray-400 truncate mt-1"
        data-testid="thread-preview"
      >
        {previewText}
        {previewText.length >= 60 ? "..." : ""}
      </p>
    )}
  </>
)}
```

### Changes Needed:

1. **Wrap title in flex container with badge (like group chat):**
```tsx
<div className="flex items-center gap-2 flex-wrap">
  <h4 className="font-semibold text-gray-900 truncate" data-testid="thread-contact-name">
    {contactName || phoneNumber}
  </h4>
  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
    {messages.length} {messages.length === 1 ? "message" : "messages"}
  </span>
</div>
```

2. **Add date range after phone number:**
```tsx
{/* Date range */}
<p className="text-xs text-gray-400 mt-1">{getDateRange()}</p>
```

3. **Remove the message badge from the RIGHT side (lines 292-298):**
```tsx
{/* Message count badge - only for 1:1 chats (group chats show inline) */}
{!isGroup && (
  <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
    {messages.length} {messages.length === 1 ? "message" : "messages"}
  </span>
)}
```
^ This block should be REMOVED since badge will now be inline.

---

## Testing Expectations

### Unit Tests

**Update existing tests to verify:**
1. Individual chat message badge is rendered inline with title (not in button area)
2. Individual chat shows date range
3. Both card types have consistent layout structure

**Add test:**
- `renders date range for individual chat`
- `renders message badge inline with title for individual chat`

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `fix(ui): consistent layout for individual and group chat cards`
- **Branch:** `fix/task-1104-chat-card-layout-consistency`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Agent ID

**Record this immediately when starting:**
```
Engineer Agent ID: <agent_id from session>
```

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
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

- **Before**: Individual chats missing date range, message badge on right; Group chats have date range, badge on left
- **After**: Both card types have consistent layout with badge inline and date range displayed
- **Actual Tokens**: ~XK (Est: 20K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- TASK-1103 changes the structure significantly (review merged code first)
- Date range logic needs modification (it doesn't - use as-is)
- Unsure about badge color consistency
- Encounter blockers not covered in the task file
