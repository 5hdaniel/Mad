# Task TASK-1052: User Verification and Deployment

---

## WORKFLOW REQUIREMENT

**This task is a USER CHECKPOINT - requires user involvement.**

This task cannot be completed by an engineer agent alone. It requires:

1. User to run the reimport on their actual database
2. User to verify the results meet expectations
3. User to approve for merge to develop

---

## Goal

Verify the deterministic message parsing refactor works correctly on real user data. User must confirm garbage text is eliminated before the project branch is merged to develop.

## Non-Goals

- Do NOT make code changes (all code complete in previous tasks)
- Do NOT run automated tests (already done)
- Do NOT merge without user approval

## Deliverables

1. User-completed verification checklist
2. Screenshots or logs of diagnostic results
3. User approval for merge

## User Verification Process

### Step 1: Build and Test Locally

```bash
# Pull the project branch
git checkout project/deterministic-message-parsing
git pull

# Build the application
npm run build

# Start the app
npm run dev
```

### Step 2: Run Reimport

1. Open the app
2. Go to Settings > Messages
3. Click "Reimport All Messages" (or equivalent)
4. Wait for import to complete

### Step 3: Run Diagnostics

Open DevTools (Cmd+Shift+I) and run:

```javascript
const userId = "22db6971-3d7e-49d0-9171-a67b235e85f6";

// Full health report
const health = await window.api.system.diagnosticMessageHealth(userId);
console.log("Health Report:", health);

// Check for garbage - should be 0
console.log("Garbage text count:", health.garbageTextCount);
console.log("Health percentage:", health.healthPercentage);
```

### Step 4: Verify Specific Chats

Check the previously-affected chats:

```javascript
// Check macos-chat-2004
const chat2004 = await window.api.messages.getThreadMessages("macos-chat-2004");
console.log("Chat 2004 messages:", chat2004.slice(0, 5));

// Check macos-chat-2742
const chat2742 = await window.api.messages.getThreadMessages("macos-chat-2742");
console.log("Chat 2742 messages:", chat2742.slice(0, 5));
```

### Step 5: Visual Verification

1. Navigate to a transaction with linked messages
2. Open the Messages tab
3. Verify messages display correctly (no Chinese characters in English messages)
4. Verify "[Unable to parse message]" placeholder appears where appropriate

## Verification Checklist

**User must complete ALL items:**

- [ ] App builds and runs without errors
- [ ] Reimport completes successfully
- [ ] `diagnosticMessageHealth` returns garbageTextCount = 0
- [ ] `diagnosticMessageHealth` returns healthPercentage > 95%
- [ ] macos-chat-2004 messages are readable or show placeholder
- [ ] macos-chat-2742 messages are readable or show placeholder
- [ ] No Chinese/CJK characters appear in English conversations
- [ ] Legitimate non-English messages (if any) still display correctly
- [ ] Message linking to transactions still works
- [ ] Thread grouping displays correctly

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Garbage Text Count | 35,834 | 0 |
| Health Percentage | 87.5% | >95% |
| Unparseable (placeholder) | 0 | <5,000 (estimate) |
| NULL thread_id | 48,514 | 48,514 (unchanged - data issue) |

## Acceptance Criteria

- [ ] User has completed all verification steps
- [ ] User confirms garbage text is eliminated
- [ ] User approves for merge to develop
- [ ] No regressions reported in message display
- [ ] All CI checks pass on project branch

## User Approval Section

**User Verification Date:** _____________

**Verified By:** _____________

### Verification Results

**Garbage Text Count (from diagnosticMessageHealth):** _______

**Health Percentage:** _______

**Chat 2004 Status:** [ ] Readable / [ ] Placeholder / [ ] Still garbage

**Chat 2742 Status:** [ ] Readable / [ ] Placeholder / [ ] Still garbage

### Issues Found (if any)

_____________________________________________________________

_____________________________________________________________

### Approval

- [ ] **APPROVED** - Merge project branch to develop
- [ ] **NOT APPROVED** - Issues need to be addressed

**Signature:** _____________

**Date:** _____________

---

## Post-Verification Steps (PM/SR Engineer)

After user approval:

1. **Create final PR**
   ```bash
   gh pr create --base develop --head project/deterministic-message-parsing \
     --title "feat: deterministic message parsing (SPRINT-036)" \
     --body "$(cat <<'EOF'
   ## Summary
   - Refactored message parser from heuristic to deterministic format detection
   - Eliminated garbage text (35,834 messages -> 0)
   - Added clear fallback for unparseable messages

   ## User Verification
   - User completed verification checklist on [DATE]
   - Garbage text count: 0
   - Health percentage: >95%

   ## Test Plan
   - [x] Comprehensive test suite (TASK-1051)
   - [x] User verification on real data (TASK-1052)
   - [x] CI green

   ## Tasks Included
   - TASK-1046: Deterministic format detection
   - TASK-1047: Binary plist parser refactor
   - TASK-1048: Typedstream parser refactor
   - TASK-1049: Parser integration
   - TASK-1050: Thread ID validation
   - TASK-1051: Comprehensive test suite
   - TASK-1052: User verification

   Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

2. **SR Engineer Review** - Final review of entire project branch

3. **Merge to develop**
   ```bash
   gh pr merge <PR-NUMBER> --merge
   ```

4. **Create phase retro report**

5. **Archive task files**
   ```bash
   git mv .claude/plans/tasks/TASK-104*.md .claude/plans/tasks/archive/
   git mv .claude/plans/tasks/TASK-105*.md .claude/plans/tasks/archive/
   git commit -m "chore: archive completed SPRINT-036 tasks"
   ```

---

## PM Estimate (PM-Owned)

**Category:** `docs` (verification/documentation task)

**Estimated Tokens:** ~8K-12K (PM work only; user work is manual)

**Token Cap:** 48K (4x upper estimate)

**Note:** This task is primarily user work with minimal PM/SR overhead.

---

## Implementation Summary (PM-Owned for this task)

*Completed: <DATE>*

### Verification Status

| Item | Status | Notes |
|------|--------|-------|
| User notified | [ ] | |
| Reimport completed | [ ] | |
| Diagnostics run | [ ] | |
| Chats verified | [ ] | |
| Approval received | [ ] | |

### Final Metrics

**User-Reported Results:**
- Garbage text count: ______
- Health percentage: ______
- Issues found: ______

**Project Branch Status:**
- All tasks merged to project branch: [ ]
- CI green: [ ]
- Ready for develop merge: [ ]

### Merge Information

**Final PR Number:** #XXX
**Merged To:** develop
**Merge Date:** <DATE>
