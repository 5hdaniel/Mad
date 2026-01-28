# TASK-1103: Unify Chat/Group Chat Card Components

**Backlog ID:** BACKLOG-286
**Sprint:** SPRINT-040
**Phase:** 2 (UI Polish - Sequential)
**Branch:** `feature/task-1103-unify-chat-cards`
**Estimated Tokens:** ~35K (component refactor, apply 1.0x multiplier)
**Token Cap:** 140K (4x estimate)

---

## SR Engineer Pre-Implementation Review

**Review Date:** 2026-01-16 | **Status:** APPROVED

### Branch Information
- **Branch From:** develop (after TASK-1102 merged)
- **Branch Into:** develop
- **Suggested Branch Name:** `feature/task-1103-unify-chat-cards`

### Execution Classification
- **Parallel Safe:** No - Phase 2 task, runs last
- **Depends On:** TASK-1100, TASK-1101, TASK-1102
- **Blocks:** None (final task in sprint)

### Shared File Analysis
- **Files Created:** None
- **Files Modified:** `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- **Conflicts With:** None

### Technical Considerations

1. **Current Component Analysis:** Reviewed MessageThreadCard.tsx (478 lines):
   - Component handles both 1:1 and group chats via `isGroup` flag (line 164)
   - Individual chat: Lines 252-279 (badge already present)
   - Group chat: Lines 221-251 (needs badge + preview additions)
   - Utility functions at bottom should NOT be modified

2. **Preview Text Implementation:** The `previewText` variable already exists (lines 168-171):
   ```tsx
   const previewText = lastMessage
     ? (lastMessage.body_text || lastMessage.body_plain || lastMessage.body || "")?.slice(0, 60)
     : "";
   ```
   Just needs to render in the group chat section (same as individual).

3. **Badge Pattern:** Individual chat badge (lines 286-288):
   ```tsx
   <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
     {messages.length} {messages.length === 1 ? "message" : "messages"}
   </span>
   ```
   Add similar gray badge to group chat section for message count.

4. **Hover State:** Current card container (line 191):
   ```tsx
   <div className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden"
   ```
   Add: `hover:bg-gray-50 transition-colors`

5. **"Also includes:" Text:** Task mentions removing this prefix. Current (line 240):
   ```tsx
   Also includes: {formatParticipantNames(...)}
   ```
   Change to just: `{formatParticipantNames(...)}`

### Recommendations

1. **Minimal Changes:** Keep modifications to the JSX structure minimal:
   - Add message count badge to group chat section
   - Add preview text rendering to group chat section
   - Add hover state to container div
   - Update "Also includes:" text
   - Do NOT refactor utility functions

2. **Test Updates:** The existing tests at `MessageThreadCard.test.tsx` need updates:
   - Add test for message badge in group chat
   - Add test for preview text in group chat
   - Add test for hover class presence

3. **Token Estimate:** 35K is appropriate for:
   - 1 file modified with careful changes
   - Test file updates needed
   - Medium complexity due to conditional rendering

### Potential Risk

**Preview Text Availability:** Group chats may have messages where `body_text`, `body_plain`, and `body` are all empty (e.g., attachment-only messages). Ensure preview text handles this gracefully - the existing code already handles empty strings.

---

## Objective

Unify the individual chat card and group chat card into a single `ThreadCard` component with consistent styling for both variants. Currently, these cards have visual inconsistencies in avatar style, badge placement, message count display, and color schemes.

---

## Context

### Current State

The `MessageThreadCard` component (`src/components/transactionDetailsModule/components/MessageThreadCard.tsx`) already handles both individual and group chats with conditional rendering. However, there are visual inconsistencies:

**Individual Chat Card:**
- Avatar: Letter initial with green gradient background
- Badge: Green pill on right showing message count
- Preview: Shows last message text

**Group Chat Card:**
- Avatar: Purple group icon (no initial)
- Badge: Purple "X people" inline after title
- Info: Date range + message count as text (no badge)
- No preview text

### Goal

Create visual consistency between the two card types while preserving their distinct identities (1:1 vs group).

---

## Requirements

### Must Do:

1. **Unify badge styling:**
   - Both individual and group chats should use badges for counts
   - Individual: Green badge "X messages"
   - Group: Purple badge "X people" (keep distinction) + Gray badge "X messages"

2. **Unify message count display:**
   - Both should show message count in a badge format
   - Individual: `[X messages]` (green, already present)
   - Group: Add `[X messages]` (gray/neutral) in addition to people badge

3. **Unify avatar sizing:**
   - Both should use the same avatar size (w-10 h-10, already consistent)
   - Keep the color distinction: green for 1:1, purple for group

4. **Add preview text to group chats:**
   - Show last message preview for group chats (same as individual)
   - Format: Truncated to 60 chars with ellipsis

5. **Unify hover states:**
   - Both cards should have the same hover effect
   - Background: `hover:bg-gray-50`
   - Transition: `transition-colors`

6. **Preserve existing functionality:**
   - View button opens conversation modal
   - Unlink button removes thread from transaction
   - Contact name resolution via contactNames map

### Design Decision (Per BACKLOG-286)

| Aspect | Individual | Group |
|--------|------------|-------|
| Avatar | Green gradient with initial | Purple with group icon |
| Primary badge | Green "X messages" | Purple "X people" |
| Secondary badge | - | Gray "X messages" |
| Preview | Last message (60 chars) | Last message (60 chars) |
| Date range | - | Date range text |

### Must NOT Do:

- Do NOT change the component's prop interface
- Do NOT modify groupMessagesByThread or other utility functions
- Do NOT change the ConversationViewModal behavior
- Do NOT remove any existing functionality (View, Unlink)

---

## Acceptance Criteria

- [ ] Individual and group chat cards have consistent spacing/padding
- [ ] Both cards show message count in badge format
- [ ] Group chat shows preview text (last message)
- [ ] Both cards have same hover effect
- [ ] Avatar sizes are consistent (w-10 h-10)
- [ ] Color distinction preserved (green for 1:1, purple for group)
- [ ] View button works for both card types
- [ ] Unlink button works for both card types
- [ ] Contact name resolution still works
- [ ] Existing tests pass
- [ ] New tests added for unified styling
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Files to Modify

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` - Main component

## Files to Read (for context)

- `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` - Current implementation
- `src/components/transactionDetailsModule/components/__tests__/MessageThreadCard.test.tsx` - Existing tests

---

## Implementation Notes

### Current Group Chat Rendering (to modify)

```tsx
{isGroup ? (
  <>
    {/* Group chat header */}
    <div className="flex items-center gap-2 flex-wrap">
      <h4 className="font-semibold text-gray-900">Group Chat</h4>
      <span className="... bg-purple-100 text-purple-700 ...">
        {participants.length} people
      </span>
    </div>
    {/* Participant names */}
    <p className="text-xs text-gray-500 mt-1">
      Also includes: {formatParticipantNames(...)}
    </p>
    {/* Date range and message count */}
    <div className="flex items-center gap-3 mt-1">
      <span className="text-xs text-gray-500">{getDateRange()}</span>
      <span className="text-xs text-gray-400">*</span>
      <span className="text-xs text-gray-500">
        {messages.length} messages
      </span>
    </div>
  </>
) : (
```

### Target Group Chat Rendering

```tsx
{isGroup ? (
  <>
    {/* Group chat header */}
    <div className="flex items-center gap-2 flex-wrap">
      <h4 className="font-semibold text-gray-900">Group Chat</h4>
      <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
        {participants.length} people
      </span>
      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
        {messages.length} {messages.length === 1 ? "message" : "messages"}
      </span>
    </div>
    {/* Participant names */}
    <p className="text-xs text-gray-500 mt-1">
      {formatParticipantNames(participants, contactNames)}
    </p>
    {/* Date range */}
    <p className="text-xs text-gray-400 mt-1">{getDateRange()}</p>
    {/* Preview text (NEW) */}
    {previewText && (
      <p className="text-sm text-gray-400 truncate mt-1">
        {previewText}{previewText.length >= 60 ? "..." : ""}
      </p>
    )}
  </>
) : (
```

### Changes Summary

1. **Group chat badges:** Add gray message count badge next to purple people badge
2. **Group chat preview:** Add previewText rendering (same as individual)
3. **Remove "Also includes:" prefix:** Just show participant names
4. **Simplify date range:** Move to own line
5. **Add hover state to card container:**
   ```tsx
   <div className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden hover:bg-gray-50 transition-colors">
   ```

---

## Testing Expectations

### Unit Tests

**Required:** Yes, update existing tests

**Existing tests to update:**
- Verify group chat rendering includes message count badge
- Verify group chat rendering includes preview text

**New tests to write:**
1. `renders message count badge for group chat`
2. `renders preview text for group chat`
3. `both card types have hover state class`

### CI Requirements
- [ ] `npm test` passes
- [ ] Tests run 3x without flakiness

---

## PR Preparation

- **Title:** `ui(messages): unify individual and group chat card styling`
- **Branch:** `feature/task-1103-unify-chat-cards`
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

- **Before**: Inconsistent styling between individual and group chat cards
- **After**: Unified styling with consistent badges, hover states, and preview text
- **Actual Tokens**: ~XK (Est: 35K)
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The current MessageThreadCard test structure is unclear
- You're unsure about the exact badge styling/colors
- You find issues with the contactNames resolution
- You encounter blockers not covered in the task file
