# Task TASK-951: Manual Platform Validation

---

## WORKFLOW REQUIREMENT

**This task is a manual validation task.** It requires human testing on physical devices.

---

## Goal

Validate the state machine implementation on both macOS and Windows platforms before proceeding with legacy code removal.

## Non-Goals

- Do NOT implement any code changes
- Do NOT proceed to TASK-952 if any test fails

## Deliverables

1. Validation report documenting pass/fail for each test case
2. Screenshots or logs for any failures
3. GO/NO-GO decision for legacy code removal

## Test Cases

### macOS Platform

- [ ] **New user flow**: Fresh install → Terms → Phone selection → Email connect → Permissions → Dashboard
- [ ] **Returning user (immediate)**: Logout → Login → Dashboard (no flicker/cycling)
- [ ] **Returning user (app restart)**: Close app → Open app → Dashboard (no flicker/cycling)
- [ ] **App restart with pending OAuth**: Mid-onboarding restart → Resume at correct step
- [ ] **Feature flag toggle**: Disable via localStorage → Verify legacy path works
- [ ] **No navigation loops**: Rapid clicking through onboarding doesn't cause loops
- [ ] **No database errors**: No "Database not initialized" errors in console

### Windows Platform

- [ ] **New user flow**: Fresh install → Terms → Phone selection → Email connect → Dashboard
- [ ] **Returning user (immediate)**: Logout → Login → Dashboard (no flicker/cycling)
- [ ] **Returning user (app restart)**: Close app → Open app → Dashboard (no flicker/cycling)
- [ ] **App restart with pending OAuth**: Mid-onboarding restart → Resume at correct step
- [ ] **Feature flag toggle**: Disable via localStorage → Verify legacy path works
- [ ] **No navigation loops**: Rapid clicking through onboarding doesn't cause loops
- [ ] **No database errors**: No "Database not initialized" errors in console

### Edge Cases

- [ ] **Quick action during startup**: Click buttons rapidly during app load
- [ ] **Network disconnect during OAuth**: Verify error recovery
- [ ] **Switch between iPhone/Android selection**: Verify correct steps shown

## Acceptance Criteria

- [ ] All macOS test cases pass
- [ ] All Windows test cases pass
- [ ] No regressions from Phase 2
- [ ] GO decision documented for TASK-952

## Validation Report Template

```markdown
# TASK-951 Validation Report

**Date:** YYYY-MM-DD
**Tester:** [Name]

## macOS Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| New user flow | PASS/FAIL | |
| Returning user (immediate) | PASS/FAIL | |
| ... | | |

## Windows Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| ... | | |

## Decision

- [ ] **GO** - Proceed to TASK-952 (legacy removal)
- [ ] **NO-GO** - Issues found, document and fix first
```

## PR Preparation

**No PR for this task** - Deliverable is a validation report.

---

## PM Estimate (PM-Owned)

**Category:** `test` (manual)

**Estimated Tokens:** ~10K (coordination only)

**Token Cap:** 40K

---

## SR Engineer Pre-Implementation Review

**Status:** APPROVED

This is a gating task for legacy code removal. Must be completed by human testers, not automated agents.

---

## Implementation Summary (Engineer-Owned)

*To be filled after manual testing*
