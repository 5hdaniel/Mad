# TASK-1004: Fix Dashboard Unnecessary Vertical Scroll

**Backlog ID:** BACKLOG-155
**Sprint:** SPRINT-028
**Phase:** Phase 1 - UI Fix (Quick Win)
**Branch:** `fix/TASK-1004-dashboard-scroll`
**Estimated Tokens:** ~10K
**Token Cap:** 40K

---

## Objective

Fix the dashboard page so it doesn't allow vertical scrolling when content fits within the viewport. Currently, users can scroll up and down even when all content is visible.

---

## Context

The dashboard page has unnecessary scroll bounce/movement. When content height is smaller than viewport height, the page should not scroll. This is a UX polish issue that makes the app feel less polished.

---

## Requirements

### Must Do:
1. Identify the root cause of the unnecessary scroll
2. Fix the overflow behavior so no scroll when content fits
3. Ensure scroll still works when content exceeds viewport
4. Test across different screen sizes

### Must NOT Do:
- Break scrolling when content actually needs it
- Affect other pages' scroll behavior
- Make significant layout changes

---

## Acceptance Criteria

- [ ] Dashboard has no vertical scrollbar when content fits viewport
- [ ] Dashboard scrolls normally when content exceeds viewport
- [ ] No scroll bounce when content fits
- [ ] Works on both macOS and Windows
- [ ] Other pages unaffected

---

## Investigation Steps

1. Check dashboard container CSS for overflow properties
2. Inspect computed height of dashboard vs viewport
3. Look for hidden elements adding to document height
4. Check AppShell/layout wrapper overflow settings
5. Test with DevTools to identify which element is causing scroll

---

## Potential Causes

1. **Container height issues** - Parent container may have `overflow-y: auto` or `scroll` when it should be `hidden` or conditional
2. **Flex/grid layout gaps** - Flexbox or grid containers might be creating extra space
3. **Body/html overflow** - Global styles may be forcing scroll behavior
4. **Electron-specific** - Chromium in Electron may handle overflow differently
5. **Content pushing beyond viewport** - Hidden elements or margins creating extra height

---

## Files to Investigate

- `src/components/Dashboard/` - Dashboard components
- `src/components/AppShell.tsx` - Main layout wrapper
- `src/App.tsx` - Root component styles
- `src/index.css` or global styles - Body/html overflow rules

---

## Testing Expectations

### Manual Testing
- [ ] Dashboard fits in viewport - no scroll
- [ ] Add enough content to exceed viewport - scroll works
- [ ] No scroll bounce on normal-sized dashboard
- [ ] Test on different window sizes
- [ ] Other pages (Transactions, Messages, etc.) still scroll normally

### CI Requirements
- [ ] `npm test` passes
- [ ] No TypeScript errors
- [ ] No ESLint errors

---

## PR Preparation

- **Title:** `fix(dashboard): remove unnecessary vertical scroll`
- **Branch:** `fix/TASK-1004-dashboard-scroll`
- **Target:** `develop`

---

## Implementation Summary (Engineer-Owned)

**REQUIRED: Complete this section before creating PR.**
**See: `.claude/docs/ENGINEER-WORKFLOW.md` for full workflow**

*Completed: <DATE>*

### Metrics (Auto-Captured)

| Metric | Value |
|--------|-------|
| Agent ID | `<from Task tool output>` |
| Total Tokens | `<from tokens.jsonl>` |
| Duration | `<seconds>` |
| API Calls | `<count>` |

**Retrieve metrics:** `grep "<agent_id>" .claude/metrics/tokens.jsonl | jq '.'`

### Engineer Checklist

```
Pre-Work:
- [ ] Created branch from develop
- [ ] Recorded agent_id: ___
- [ ] Read task file completely

Investigation:
- [ ] Identified root cause: ___
- [ ] Identified file(s) to change: ___

Implementation:
- [ ] Fix implemented
- [ ] Tested on multiple screen sizes
- [ ] Type check passes (npm run type-check)
- [ ] Lint passes (npm run lint)

PR Submission:
- [ ] This summary section completed
- [ ] PR created with Engineer Metrics
- [ ] CI passes (gh pr checks --watch)
- [ ] SR Engineer review requested

Completion:
- [ ] SR Engineer approved and merged
- [ ] PM notified
```

### Results

- **Root Cause**: [describe what was causing the scroll]
- **Fix Applied**: [describe the fix]
- **PR**: [URL after PR created]

### Notes

**Deviations from plan:**
[If you deviated, explain what and why]

**Issues encountered:**
[Document any challenges]

---

## Guardrails

**STOP and ask PM if:**
- The fix affects other pages unexpectedly
- The root cause is more complex than expected
- You need to modify global styles significantly
