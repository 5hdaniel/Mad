# SPRINT-017: Metrics Workflow Test

**Status:** READY TO START
**Created:** 2026-01-03
**Target:** develop

---

## Executive Summary

Minimal single-task sprint to validate the new auto-captured metrics workflow (BACKLOG-137/138).

### Sprint Goal

Fix a UI bug while testing that:
1. Engineer records `agent_id` when Task tool returns
2. SubagentStop hook captures metrics automatically
3. Metrics appear in `.claude/metrics/tokens.jsonl`
4. New PR template format works correctly

---

## Task List

| ID | Title | Category | Est Tokens | Token Cap |
|----|-------|----------|------------|-----------|
| TASK-921 | Fix duplicate Back/Continue buttons on SecureStorageStep | fix/ui | ~15K | 60K |

---

## TASK-921: Fix Duplicate Navigation Buttons

### Bug Description

On macOS onboarding, the Secure Storage Setup screen shows "Back" and "Continue" buttons **twice**.

**Root Cause Analysis:**
- `OnboardingFlow.tsx` renders `NavigationButtons` in the shell (lines 204-215)
- `SecureStorageStep.tsx` ALSO renders its own Back/Continue buttons (lines 209-222)
- The step's `meta.navigation` config (`showBack: true, continueLabel: "Continue"`) already tells the shell what to render

### Fix

Remove the duplicate navigation buttons from `SecureStorageStep.tsx` since the shell handles navigation based on step metadata.

### Files to Modify

| File | Action |
|------|--------|
| `src/components/onboarding/steps/SecureStorageStep.tsx` | Remove lines 209-222 (the navigation buttons div) |

### Acceptance Criteria

- [ ] Only one set of Back/Continue buttons visible on Secure Storage screen
- [ ] Clicking Back navigates to Phone Type selection
- [ ] Clicking Continue triggers `SECURE_STORAGE_SETUP` action with `dontShowAgain` value
- [ ] Checkbox "Don't show this explanation again" still functions
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes

---

## Metrics Validation Checklist

After task completion, verify:

- [ ] Engineer recorded `agent_id` in task file
- [ ] `grep "<agent_id>" .claude/metrics/tokens.jsonl` returns data
- [ ] PR uses new template format (Agent ID section, `| Metric | Value |` table)
- [ ] CI `Validate PR Metrics` check passes

---

## Testing Plan

| Test | Method |
|------|--------|
| Visual verification | Run `npm run dev`, navigate to Secure Storage step |
| Button count | Confirm exactly 2 buttons (Back + Continue) |
| Navigation | Test Back goes to Phone Type, Continue proceeds |
| Checkbox | Toggle "Don't show again", verify value passed to action |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Removing wrong code | Low | Medium | Clear line numbers identified, small change |
| Breaking navigation | Low | High | Shell already handles nav via metadata |

---

## End-of-Sprint Validation

- [ ] Bug fixed and verified visually
- [ ] PR merged to develop
- [ ] Auto-captured metrics recorded
- [ ] Workflow documentation validated
