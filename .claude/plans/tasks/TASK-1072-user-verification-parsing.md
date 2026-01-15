# Task TASK-1072: User Verification for Deterministic Parsing

---

## WORKFLOW REQUIREMENT

**This task requires USER interaction, not engineer agent.**

This is a verification task where the user needs to:
1. Run the application with their real data
2. Check that messages display correctly
3. Report any remaining issues

PM should facilitate this verification directly with the user.

---

## Goal

Confirm with the user that the message parsing improvements from SPRINT-036 and TASK-1071 work correctly on their real data. This is a human verification step that cannot be automated.

## Non-Goals

- Do NOT run automated tests (that's already done)
- Do NOT access user's private data
- Do NOT make code changes unless user reports issues
- Do NOT skip this verification step

## Deliverables

1. User confirmation that messages display correctly
2. Documentation of any issues found (if any)
3. Follow-up backlog items created (if issues found)

## Acceptance Criteria

- [ ] User has run the application with their real data
- [ ] User confirms no garbage text appears in messages
- [ ] User confirms messages are readable and make sense
- [ ] Any issues found are documented as backlog items

## Verification Process

### Step 1: User Launches Application

```bash
# Build and run the application
npm run dev
```

### Step 2: User Checks Message Display

**Areas to verify:**

1. **Messages tab** - Open conversations and scroll through messages
2. **Search results** - Search for messages and check display
3. **Attachments** - Check messages with images/files show correctly
4. **Long threads** - Check conversations with many messages

### Step 3: Report Findings

**If NO issues found:**
- User confirms "Messages display correctly, no garbage text"
- Task is complete

**If issues found:**
Document:
- Screenshot of the issue
- Which conversation/message shows the problem
- Any pattern (e.g., "only messages from X", "only with attachments")

### Step 4: Create Follow-up (if needed)

If user reports issues, PM will create new backlog items with:
- Description of the issue
- Sample data (anonymized if needed)
- Priority based on severity

## Verification Checklist for User

Please check each item and report results:

```
[ ] Opened Messages tab and viewed multiple conversations
[ ] No Chinese/Japanese garbage characters in English messages
[ ] Messages with attachments display correctly
[ ] Searched for messages and results look correct
[ ] No "Unable to parse message" fallbacks for messages that should be readable
[ ] Group chat messages display correctly
[ ] Individual chat messages display correctly
```

## Expected Results

**Good (parsing working):**
- Messages show readable text
- No strange characters mixed with English
- Attachments show file info or preview

**Bad (still has issues):**
- Chinese/Japanese characters in English messages (garbage text)
- `Unable to parse message content` for messages that should be readable
- Missing text where there should be content

## Integration Notes

- Depends on: TASK-1071 (garbage text fix must be merged first)
- User verification cannot be parallelized with TASK-1071
- This is the final validation step for SPRINT-036 and SPRINT-038

## Do / Don't

### Do:

- Wait for TASK-1071 to merge before asking user to verify
- Provide clear instructions to the user
- Document any issues found
- Create follow-up backlog items if needed

### Don't:

- Don't skip user verification
- Don't assume automated tests are sufficient
- Don't access user's private data directly
- Don't close this task without user confirmation

## When to Stop and Ask

- If user reports issues that seem unrelated to parsing
- If user cannot reproduce issues in dev mode
- If issues are found, before creating new tasks

## Testing Expectations (MANDATORY)

### Unit Tests

- Required: No (verification task)

### Coverage

- Coverage impact: None (no code changes unless issues found)

### CI Requirements

This task's PR (if any) MUST pass:
- [x] Unit tests
- [x] Type checking
- [x] Lint / format checks

---

## PM Estimate (PM-Owned)

**Category:** `test`

**Estimated Tokens:** ~5K-15K

**Token Cap:** 60K (4x upper estimate)

> Most of this task is user interaction, not agent work.

**Estimation Assumptions:**

| Factor | Assumption | Impact |
|--------|------------|--------|
| User communication | Instructions and follow-up | +5K |
| Issue documentation | If issues found | +5K |
| Follow-up tasks | If issues found | +5K |

**Confidence:** High (verification is straightforward)

**Risk factors:**
- User may find unexpected issues requiring additional work

**Similar past tasks:** Test/verification category: 0.9x multiplier applied = ~10K

---

## Verification Summary (User-Owned)

**REQUIRED: User should complete this section.**

*Verification Date: <DATE>*

### User Checklist

```
Verification completed:
- [ ] Opened Messages tab and viewed multiple conversations
- [ ] No garbage text observed
- [ ] Attachments display correctly
- [ ] Search results look correct
- [ ] Group chats work properly
- [ ] Individual chats work properly
```

### User Findings

**Overall Status:** PASS / ISSUES FOUND

**Details:**
<User describes what they observed>

### Issues Found (if any)

| Issue # | Description | Conversation/Message | Screenshot |
|---------|-------------|---------------------|------------|
| 1 | <description> | <identifier> | <attached> |

### User Confirmation

```
I confirm that I have verified the message parsing improvements:
- [ ] All messages display correctly OR
- [ ] Issues documented above for follow-up

User: _______________
Date: _______________
```

---

## SR Engineer Review Notes (Pre-Implementation)

**Review Date:** 2026-01-15 | **Status:** APPROVED

### Execution Classification
- **Parallel Safe:** NO - must wait for TASK-1071
- **Depends On:** TASK-1071 (garbage text fix)
- **Blocks:** None

### Technical Considerations
- This is a USER verification task, not an engineer task
- No code changes expected unless user reports issues
- Test data reference: `.claude/plans/test-data/message-parsing-test-data.md`
- Affected chats to verify: macos-chat-2004, macos-chat-2742, etc.

### SR Risk Assessment
- **Risk Level:** LOW
- Verification only, no code changes expected
- May discover new issues requiring backlog items

---

## Follow-up Actions (PM-Owned)

**Based on user verification:**

| Issue | Backlog ID | Priority | Sprint |
|-------|------------|----------|--------|
| - | - | - | - |

### Closure Notes

<PM documents resolution and closes task>
