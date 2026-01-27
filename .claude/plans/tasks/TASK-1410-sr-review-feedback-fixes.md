# Task: TASK-1410 - Address SR Engineer Review Feedback for BACKLOG-510/513

**Sprint**: SPRINT-061 - Communication Display Fixes
**Type**: Fix / Test Coverage
**Priority**: Medium
**Status**: Ready
**Backlog Items**: BACKLOG-510, BACKLOG-513

---

## Branch Information

**Branch From**: `project/sprint-061-communication-display-fixes`
**Branch Into**: `project/sprint-061-communication-display-fixes`
**Branch Name**: `fix/task-1410-sr-review-feedback`

---

## Context

SR Engineer review identified two cleanup items after the main BACKLOG-510/513 implementation passed user testing:

1. **`formatCommunicationCounts()` sync issue**: The helper function is exported but the UI uses inline JSX with different labels. This creates maintenance confusion.

2. **Missing test coverage**: The `extractPhoneFromThread()` function in `MessageThreadCard.tsx` lacks tests for user identifier exclusion logic.

**Current State**: Changes from BACKLOG-510/513 are in the working directory (not committed). User testing passed - counters and contact names display correctly. This task is cleanup/test coverage before the final commit.

---

## Acceptance Criteria

### AC1: Resolve formatCommunicationCounts Sync Issue
- [ ] Either update `formatCommunicationCounts()` to use labels matching the UI ("Text threads", "Email threads")
- [ ] OR remove the function if it's unused
- [ ] Document decision in Implementation Summary

### AC2: Add Test Coverage for extractPhoneFromThread
- [ ] Add test case: User's outbound `from` field being correctly excluded
- [ ] Add test case: User's inbound `to` field being correctly excluded
- [ ] Add test case: `chat_members` fallback when `from`/`to` are "unknown"
- [ ] Tests pass: `npm test`

### AC3: Validation Passes
- [ ] `npm run type-check` passes with no errors
- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes with no failures

### AC4: Commit and PR Created
- [ ] All BACKLOG-510/513 changes committed with descriptive message
- [ ] PR created targeting `project/sprint-061-communication-display-fixes`
- [ ] PR description references BACKLOG-510 and BACKLOG-513

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/components/transaction/components/TransactionCard.tsx` | Review/fix formatCommunicationCounts usage |
| `src/components/transaction/components/TransactionListCard.tsx` | Review/fix formatCommunicationCounts usage |
| `src/components/transactionDetailsModule/components/MessageThreadCard.tsx` | Source of extractPhoneFromThread function |

### Files to Create/Update (Tests)

| File | Purpose |
|------|---------|
| `src/components/transactionDetailsModule/components/__tests__/MessageThreadCard.test.tsx` | Add extractPhoneFromThread tests |

### extractPhoneFromThread Test Cases

```typescript
// Test 1: User's outbound 'from' excluded
// When user sends a message, their phone number is in 'from'
// Should extract the recipient phone, not the user's phone

// Test 2: User's inbound 'to' excluded
// When user receives a message, their phone number is in 'to'
// Should extract the sender phone, not the user's phone

// Test 3: chat_members fallback
// When 'from' and 'to' are both "unknown", fall back to chat_members
// Should extract phone from chat_members array
```

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| BACKLOG-510/513 implementation | Complete | Changes in working directory |
| User testing | Passed | Counters and contact names verified |

---

## Estimated Effort

- **Estimated Tokens**: ~15K
- **Category**: Fix + Test (1.2x multiplier)
- **Complexity**: Low - straightforward cleanup and test additions

---

## Implementation Notes

### formatCommunicationCounts Analysis

Current function (if exists):
```typescript
export function formatCommunicationCounts(counts: { text: number; email: number }) {
  // Check what labels this uses vs what UI actually renders
}
```

UI currently renders inline:
- "X Text threads"
- "Y Email threads"

**Decision needed**:
- If function uses different labels, update to match UI
- If function is completely unused, remove it
- If function is used elsewhere, ensure consistency

### extractPhoneFromThread Logic

The function should:
1. Given a message thread and user identifier
2. Extract the "other party" phone number (not the user's)
3. Handle edge cases where from/to are "unknown"
4. Fall back to chat_members when needed

---

## Implementation Summary

**Status**: Not Started

### Changes Made
<!-- Engineer fills this section after implementation -->

### Files Modified
<!-- List actual files changed -->

### Test Results
<!-- Paste relevant test output -->

### Decisions Made
<!-- Document any implementation decisions -->

---

## PR Checklist

- [ ] Branch created from project branch
- [ ] All acceptance criteria met
- [ ] Type-check passes
- [ ] Lint passes
- [ ] Tests pass (including new tests)
- [ ] Commit message follows conventional commit format
- [ ] PR created with proper description
- [ ] Ready for SR Engineer review
