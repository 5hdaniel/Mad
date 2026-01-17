# Task TASK-1106: Chat Card Final Refinements

---

## WORKFLOW REQUIREMENT

**This task MUST be implemented via the `engineer` agent.**

Direct implementation is PROHIBITED. The correct workflow is:

1. PM creates this task file
2. PM invokes `engineer` agent with `subagent_type="engineer"`
3. Engineer agent implements, tracks metrics, creates PR
4. PM invokes `senior-engineer-pr-lead` agent for PR review
5. SR Engineer approves and merges

If you are reading this task file and about to implement it yourself, **STOP**.
Use the Task tool to spawn the engineer agent instead.

---

**Backlog ID:** N/A (follow-up from TASK-1105)
**Sprint:** SPRINT-040
**Phase:** 2 (UI Polish - Sequential, after TASK-1105)
**Branch:** `fix/task-1106-chat-card-final-refinements`
**Estimated Tokens:** ~10K (targeted UI tweaks)
**Token Cap:** 40K (4x estimate)

---

## SR Engineer Pre-Implementation Review

**Review Date:** PENDING | **Status:** PENDING

### Branch Information
- **Branch From:** develop (after TASK-1105 merged)
- **Branch Into:** develop
- **Suggested Branch Name:** `fix/task-1106-chat-card-final-refinements`

### Execution Classification
- **Parallel Safe:** No - modifies MessageThreadCard.tsx
- **Depends On:** TASK-1105 (both modify same file)
- **Blocks:** None

### Shared File Analysis
- **Files Modified:** `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`
- **Conflicts With:** TASK-1105 (must run after 1105 merges)

### Technical Considerations

**Awaiting SR Engineer review before implementation.**

---

## Goal

Two refinements to group chat cards that were missed in TASK-1105:

1. **Remove message count badge** - The green "X messages" pill should be removed from group chat cards (it was kept but should have been removed per user feedback)

2. **Move participant names inline with group chat name** - Instead of appearing at the bottom, participant names should appear on the same line as "Group Chat:" with dynamic truncation based on viewport width

## Non-Goals

- Do NOT change the component's prop interface
- Do NOT modify utility functions
- Do NOT change modal behavior
- Do NOT change avatar styling
- Do NOT modify individual (1:1) chat cards
- Do NOT change the View/Unlink button functionality

## Deliverables

1. Update: `src/components/transactionDetailsModule/components/MessageThreadCard.tsx`

## Acceptance Criteria

- [ ] Message count badge is NOT displayed on group chat cards
- [ ] Participant names appear on the same line as "Group Chat:" label
- [ ] Format: "Group Chat: Name1, Name2, Name3 +X more"
- [ ] Names use same font styling as current participant list (text-xs text-gray-500)
- [ ] Names truncate with "+X more" when viewport is narrow
- [ ] Truncation is dynamic - fits as many names as viewport allows
- [ ] Hover tooltip still shows all participant names
- [ ] Date range appears below the name/participants line
- [ ] Preview text appears below date range
- [ ] `npm test` passes
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Context

### Current Layout (after TASK-1105)

**Group Chat:**
```
[Avatar] Group Chat [X messages]               [View] [X]
         Date range
         Preview
         Participants: Name1, Name2, +3 more
```

### Target Layout (this task)

**Group Chat:**
```
[Avatar] Group Chat: Name1, Name2, Name3 +2 more    [View] [X]
         Date range
         Preview
```

### Changes Required

1. **Remove message count badge from group chats:**
   - Delete the green badge showing "X messages" from group chat header
   - Only applies to group chats (individual chats can keep their badge)

2. **Move participant names inline:**
   - Remove the separate participant line at the bottom
   - Add participant names after "Group Chat:" on the same line
   - Colon separator between "Group Chat" and names
   - Use flexbox or CSS to allow dynamic truncation
   - Keep the hover tooltip showing all names

---

## Implementation Notes

### Remove Message Count Badge (Group Chats Only)

Find and remove this span from the GROUP CHAT section (around lines 231-237):
```tsx
<span
  className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full"
  data-testid="group-message-count-badge"
>
  {messages.length} {messages.length === 1 ? "message" : "messages"}
</span>
```

**Important:** Keep the badge on individual/1:1 chats - only remove from group chats.

### Move Participant Names Inline

Current structure (two separate elements):
```tsx
<h4 className="font-semibold text-gray-900" data-testid="thread-contact-name">
  Group Chat
</h4>
// ... badge ...
// ... later at bottom:
<p className="text-xs text-gray-500 mt-1 truncate" data-testid="thread-participants" ...>
  {formatParticipantNames(participants, contactNames)}
</p>
```

New structure (combined on one line):
```tsx
<div className="flex items-baseline gap-1 min-w-0 flex-1">
  <h4 className="font-semibold text-gray-900 flex-shrink-0" data-testid="thread-contact-name">
    Group Chat:
  </h4>
  <span
    className="text-xs text-gray-500 truncate"
    data-testid="thread-participants"
    title={formatParticipantNames(participants, contactNames, 999)}
  >
    {formatParticipantNames(participants, contactNames)}
  </span>
</div>
```

### Dynamic Truncation

The `formatParticipantNames` function already handles "+X more" truncation. To make it more dynamic based on viewport:

Option A (Simple - recommended): Keep the current fixed truncation (3 names max) but let CSS `truncate` class handle overflow:
- The container will clip the text
- Tooltip shows full list on hover

Option B (Advanced): Calculate available width and adjust maxShow dynamically:
- Would require useRef + ResizeObserver
- More complex, may not be worth the effort for this quick fix

**Recommendation:** Use Option A (simple CSS truncation) for this task.

### Remove Bottom Participant Line

After moving participants inline, remove the standalone participant paragraph that currently appears at the bottom of group chat cards.

---

## Integration Notes

- Imports from: None (self-contained changes)
- Exports to: None (component interface unchanged)
- Used by: Transaction details view via MessageThreadList
- Depends on: TASK-1105 (must be merged first)

## Do / Don't

### Do:

- Keep the `data-testid` attributes for testing
- Maintain the hover tooltip with full participant list
- Use flexbox for the inline layout
- Keep consistent spacing patterns

### Don't:

- Remove the message count badge from individual/1:1 chats
- Change the avatar component/styling
- Add complex resize observers (keep it simple)
- Break the existing tests

## When to Stop and Ask

- If the flexbox layout causes text to wrap unexpectedly
- If tests fail and you're unsure how to update them
- If the tooltip stops working after restructuring
- If you need to modify formatParticipantNames function signature

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: Maybe (update if existing tests assert on removed badge or participant position)
- New tests to write: None
- Existing tests to update:
  - Update any tests that assert group message count badge exists
  - Update snapshot tests if they exist

### Coverage

- Coverage impact: Should not decrease

### CI Requirements

This task's PR MUST pass:
- [ ] Unit tests
- [ ] Type checking
- [ ] Lint / format checks

**PRs without tests when required WILL BE REJECTED.**

## PR Preparation

- **Title**: `fix(ui): finalize chat card layout - inline participant names`
- **Labels**: `ui`, `enhancement`
- **Depends on**: TASK-1105 (must be merged first)

---

## PM Estimate (PM-Owned)

**Category:** `ui`

**Estimated Tokens:** ~10K

**Token Cap:** 40K (4x estimate)

> If you reach this cap, STOP and report to PM. See `.claude/docs/shared/token-cap-workflow.md`.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| Files to create | 0 new files | +0K |
| Files to modify | 1 file (MessageThreadCard.tsx) | +7K |
| Code volume | ~15-20 lines modified | +2K |
| Test complexity | Low (minimal test updates) | +1K |

**Confidence:** High

**Risk factors:**
- Flexbox layout may need tweaking for proper truncation
- May need to update tests if they assert on removed elements

**Similar past tasks:** TASK-1105 (~12K actual, similar scope)

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Completed: [DATE]*

### Agent ID

**Record this immediately when Task tool returns:**
```
Engineer Agent ID: [PENDING]
```

### Checklist

```
Files created:
- [ ] None expected

Files modified:
- [ ] src/components/transactionDetailsModule/components/MessageThreadCard.tsx

Features implemented:
- [ ] Removed message count badge from group chat cards
- [ ] Moved participant names inline with "Group Chat:" label
- [ ] Dynamic truncation with "+X more" pattern
- [ ] Maintained hover tooltip for full participant list

Verification:
- [ ] npm run type-check passes
- [ ] npm run lint passes
- [ ] npm test passes
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Will be captured when session completes

| Metric | Value |
|--------|-------|
| **Total Tokens** | [PENDING] |
| Duration | [PENDING] |
| API Calls | [PENDING] |

### Notes

**Planning notes:**
[PENDING]

**Deviations from plan:**
[PENDING]

**Design decisions:**
[PENDING]

**Issues encountered:**
[PENDING]

---

## SR Engineer Review (SR-Owned)

**REQUIRED: Record your agent_id immediately when the Task tool returns.**

*Review Date: 2026-01-17*

### Agent ID

```
SR Engineer Agent ID: sr-engineer-1106-review
```

### Metrics (Auto-Captured)

**From SubagentStop hook** - Run: `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

| Metric | Value |
|--------|-------|
| **Total Tokens** | ~8K (estimated) |
| Duration | ~5 minutes |
| API Calls | ~15 |

### Review Summary

**Architecture Compliance:** PASS - Changes isolated to feature component, no entry file impact, component interface unchanged
**Security Review:** N/A (UI-only changes)
**Test Coverage:** PASS - Tests updated appropriately, 38 tests passing

**Review Notes:**
- Clean, focused implementation matching acceptance criteria
- Message count badge correctly removed from group chats only (1:1 chats retain badge)
- Inline participant layout uses proper flexbox with `items-baseline` for text alignment
- CSS `truncate` class provides viewport-based overflow handling
- Test assertions updated from positive to negative checks appropriately
- Removed duplicate participant paragraph reduces DOM nodes slightly

### Merge Information

**PR Number:** #447
**Merge Commit:** 488c573b7ac50c4ed27377f6a3ca17d70e65044b
**Merged To:** develop
**Merged At:** 2026-01-17T22:36:47Z
